import { getEnv } from '@/lib/cloudflare'
import { db } from '@/lib/db'

/**
 * Backups del portal sobre Cloudflare (D1 + R2).
 *
 * - "Preparar" toma una instantánea de la base (JSON) y la guarda en R2.
 * - "Descargar" arma el .tar en streaming: database.json + uploads/<archivo> por cada medio del bucket.
 * - "Importar" acepta el mismo formato que generaba la versión con servidor propio, así que
 *   un backup del servidor anterior restaura la base en D1 y sube los medios a R2.
 */

export const BACKUP_FORMAT = 'ssa-portal-backup'
export const BACKUP_VERSION = 1

const BACKUP_MODELS = [
  'project',
  'publication',
  'chatMessage',
  'leadCapture',
  'contact',
  'adminUser',
  'siteSettings',
  'telegramConfig',
  'telegramIdentity',
  'telegramConversation',
  'mediaAsset',
  'approvalItem',
  'automationLog',
  'visitorSession',
  'visitorEvent',
  'chatConfig',
  'socialConnection',
] as const

type BackupModel = (typeof BACKUP_MODELS)[number]

const ANALYTICS_MODELS: BackupModel[] = ['visitorSession', 'visitorEvent', 'automationLog']

// D1 limita a 100 parámetros por sentencia: Prisma parte los lotes, pero lotes chicos evitan sorpresas.
const CREATE_CHUNK_SIZE = 20
const SYSTEM_PREFIX = '_system/'
const BACKUP_PREFIX = `${SYSTEM_PREFIX}backups/`
const IMPORT_PREFIX = `${SYSTEM_PREFIX}imports/`
const BACKUP_FILE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type BackupPayload = {
  format: string
  version: number
  exportedAt: string
  tables: Record<string, Record<string, unknown>[]>
}

type PrismaDelegate = {
  findMany: () => Promise<Record<string, unknown>[]>
  deleteMany: () => Promise<unknown>
  createMany: (args: { data: Record<string, unknown>[] }) => Promise<unknown>
}

export type BackupStatus = {
  id: string
  status: 'generating' | 'ready' | 'error'
  createdAt: string
  finishedAt?: string
  size?: number
  mediaCount?: number
  includeAnalytics?: boolean
  error?: string
}

export type ImportSummary = {
  exportedAt: string | null
  tables: Record<string, number>
  mediaFiles: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bucket() {
  return getEnv().MEDIA
}

function getDelegate(model: BackupModel) {
  return (db as unknown as Record<BackupModel, PrismaDelegate>)[model]
}

function isValidBackupId(id: string) {
  return /^[a-z0-9-]{8,80}$/.test(id)
}

function createId() {
  return `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

// --- Tar (ustar + GNU @LongLink), sin dependencias ---

function writeString(target: Uint8Array, value: string, offset: number, length: number) {
  target.set(encoder.encode(value).subarray(0, length), offset)
}

function writeOctal(target: Uint8Array, offset: number, length: number, value: number) {
  writeString(target, value.toString(8).padStart(length - 1, '0') + '\0', offset, length)
}

function buildTarHeaderBlock(name: string, size: number, typeFlag: string, prefix = '') {
  const header = new Uint8Array(512)
  writeString(header, name, 0, 100)
  writeOctal(header, 100, 8, 0o644)
  writeOctal(header, 108, 8, 0)
  writeOctal(header, 116, 8, 0)
  writeOctal(header, 124, 12, size)
  writeOctal(header, 136, 12, Math.floor(Date.now() / 1000))
  header.fill(0x20, 148, 156)
  writeString(header, typeFlag, 156, 1)
  writeString(header, 'ustar\0', 257, 6)
  writeString(header, '00', 263, 2)

  if (prefix) {
    writeString(header, prefix, 345, 155)
  }

  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  writeString(header, checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8)
  return header
}

function byteLength(value: string) {
  return encoder.encode(value).length
}

function tarPadding(size: number) {
  const remainder = size % 512
  return remainder > 0 ? new Uint8Array(512 - remainder) : null
}

function createTarEntryBlocks(name: string, size: number): Uint8Array[] {
  if (byteLength(name) <= 100) {
    return [buildTarHeaderBlock(name, size, '0')]
  }

  const slashIndex = name.indexOf('/')

  if (slashIndex !== -1) {
    const prefix = name.slice(0, slashIndex)
    const rest = name.slice(slashIndex + 1)

    if (byteLength(rest) <= 100 && byteLength(prefix) <= 155) {
      return [buildTarHeaderBlock(rest, size, '0', prefix)]
    }
  }

  const nameData = encoder.encode(name + '\0')
  const blocks = [buildTarHeaderBlock('././@LongLink', nameData.length, 'L'), nameData]
  const padding = tarPadding(nameData.length)

  if (padding) {
    blocks.push(padding)
  }

  let truncatedName = name.slice(0, 100)

  while (byteLength(truncatedName) > 100) {
    truncatedName = truncatedName.slice(0, -1)
  }

  blocks.push(buildTarHeaderBlock(truncatedName, size, '0'))
  return blocks
}

function readTarString(block: Uint8Array, offset: number, length: number) {
  const slice = block.subarray(offset, offset + length)
  const end = slice.indexOf(0)
  return decoder.decode(slice.subarray(0, end === -1 ? length : end))
}

// --- Exportación ---

async function writeBackupStatus(status: BackupStatus) {
  await bucket().put(`${BACKUP_PREFIX}${status.id}.status.json`, JSON.stringify(status), {
    httpMetadata: { contentType: 'application/json' },
  })
}

async function readBackupStatus(id: string): Promise<BackupStatus | null> {
  const object = await bucket().get(`${BACKUP_PREFIX}${id}.status.json`)

  if (!object) {
    return null
  }

  try {
    const parsed = (await object.json()) as BackupStatus
    return parsed?.id === id ? parsed : null
  } catch {
    return null
  }
}

async function listMediaObjects() {
  const objects: Array<{ key: string; size: number }> = []
  let cursor: string | undefined

  do {
    const page = await bucket().list({ cursor, limit: 1000 })

    for (const object of page.objects) {
      if (!object.key.startsWith(SYSTEM_PREFIX)) {
        objects.push({ key: object.key, size: object.size })
      }
    }

    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)

  return objects
}

async function cleanupOldBackups() {
  const page = await bucket().list({ prefix: SYSTEM_PREFIX, limit: 1000 })
  const expired = page.objects
    .filter((object) => Date.now() - object.uploaded.getTime() > BACKUP_FILE_MAX_AGE_MS)
    .map((object) => object.key)

  if (expired.length > 0) {
    await bucket().delete(expired)
  }
}

export async function startBackupGeneration(options?: { includeAnalytics?: boolean }) {
  const includeAnalytics = options?.includeAnalytics ?? true
  await cleanupOldBackups().catch(() => undefined)

  const id = createId()
  const createdAt = new Date().toISOString()

  try {
    const tables: Record<string, Record<string, unknown>[]> = {}

    for (const model of BACKUP_MODELS) {
      if (!includeAnalytics && ANALYTICS_MODELS.includes(model)) {
        continue
      }

      tables[model] = await getDelegate(model).findMany()
    }

    const payload: BackupPayload = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: createdAt, tables }
    const database = encoder.encode(JSON.stringify(payload))
    await bucket().put(`${BACKUP_PREFIX}${id}.database.json`, database, { httpMetadata: { contentType: 'application/json' } })

    const media = await listMediaObjects()
    const size =
      [{ key: 'database.json', size: database.length }, ...media.map((item) => ({ key: `uploads/${item.key}`, size: item.size }))].reduce(
        (total, entry) =>
          total + createTarEntryBlocks(entry.key, entry.size).reduce((sum, block) => sum + block.length, 0) + Math.ceil(entry.size / 512) * 512,
        0,
      ) + 1024

    const status: BackupStatus = {
      id,
      status: 'ready',
      createdAt,
      finishedAt: new Date().toISOString(),
      size,
      mediaCount: media.length,
      includeAnalytics,
    }
    await writeBackupStatus(status)
    return status
  } catch (error) {
    const status: BackupStatus = {
      id,
      status: 'error',
      createdAt,
      finishedAt: new Date().toISOString(),
      includeAnalytics,
      error: error instanceof Error ? error.message : 'Error desconocido al generar el backup',
    }
    await writeBackupStatus(status).catch(() => undefined)
    return status
  }
}

export async function listBackups(): Promise<BackupStatus[]> {
  const page = await bucket().list({ prefix: BACKUP_PREFIX, limit: 1000 })
  const ids = page.objects
    .map((object) => object.key.slice(BACKUP_PREFIX.length))
    .filter((key) => key.endsWith('.status.json'))
    .map((key) => key.slice(0, -'.status.json'.length))

  const statuses = await Promise.all(ids.map((id) => readBackupStatus(id)))
  return statuses.filter((status): status is BackupStatus => Boolean(status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function deleteBackup(id: string) {
  if (!isValidBackupId(id)) {
    return false
  }

  await bucket().delete([`${BACKUP_PREFIX}${id}.status.json`, `${BACKUP_PREFIX}${id}.database.json`])
  return true
}

/** Devuelve el .tar del backup como stream (se arma al vuelo leyendo R2). */
export async function openBackupStream(id: string) {
  if (!isValidBackupId(id)) {
    return null
  }

  const status = await readBackupStatus(id)
  const databaseObject = status?.status === 'ready' ? await bucket().get(`${BACKUP_PREFIX}${id}.database.json`) : null

  if (!status || !databaseObject) {
    return null
  }

  const database = new Uint8Array(await databaseObject.arrayBuffer())
  const media = await listMediaObjects()
  const storage = bucket()

  async function* chunks() {
    yield* createTarEntryBlocks('database.json', database.length)
    yield database
    const databasePadding = tarPadding(database.length)

    if (databasePadding) {
      yield databasePadding
    }

    for (const item of media) {
      const object = await storage.get(item.key)

      if (!object) {
        continue
      }

      yield* createTarEntryBlocks(`uploads/${item.key}`, object.size)
      const reader = (object.body as unknown as ReadableStream<Uint8Array>).getReader()

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        yield value
      }

      const padding = tarPadding(object.size)

      if (padding) {
        yield padding
      }
    }

    yield new Uint8Array(1024)
  }

  const iterator = chunks()
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await iterator.next()

      if (done) {
        controller.close()
      } else {
        controller.enqueue(value)
      }
    },
  })

  return { stream, status }
}

// --- Importación ---

function parseBackupPayload(bytes: Uint8Array): BackupPayload {
  let payload: BackupPayload

  try {
    payload = JSON.parse(decoder.decode(bytes)) as BackupPayload
  } catch {
    throw new Error('No se pudo leer database.json del backup.')
  }

  if (payload.format !== BACKUP_FORMAT) {
    throw new Error('El archivo no es un backup de este portal.')
  }

  if (payload.version !== BACKUP_VERSION) {
    throw new Error(`Versión de backup no soportada (${payload.version}). Esta instancia soporta la versión ${BACKUP_VERSION}.`)
  }

  return payload
}

function reviveDates(rows: Record<string, unknown>[]) {
  // JSON pierde el tipo Date; Prisma acepta strings ISO, pero se normalizan por seguridad.
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) ? new Date(value) : value,
      ]),
    ),
  )
}

async function restoreDatabase(payload: BackupPayload) {
  // D1 no admite transacciones interactivas: se restaura tabla por tabla.
  const restoredTables: Record<string, number> = {}

  for (const model of BACKUP_MODELS) {
    const rows = payload.tables?.[model]

    if (!Array.isArray(rows)) {
      continue
    }

    const delegate = getDelegate(model)
    await delegate.deleteMany()
    const revived = reviveDates(rows)

    for (let index = 0; index < revived.length; index += CREATE_CHUNK_SIZE) {
      await delegate.createMany({ data: revived.slice(index, index + CREATE_CHUNK_SIZE) })
    }

    restoredTables[model] = rows.length
  }

  return restoredTables
}

/** Lector secuencial de bytes sobre un ReadableStream. */
class StreamReader {
  private reader: ReadableStreamDefaultReader<Uint8Array>
  private buffer = new Uint8Array(0)
  private done = false

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader()
  }

  private async fill(minimum: number) {
    while (this.buffer.length < minimum && !this.done) {
      const { done, value } = await this.reader.read()

      if (done) {
        this.done = true
        break
      }

      const merged = new Uint8Array(this.buffer.length + value.length)
      merged.set(this.buffer)
      merged.set(value, this.buffer.length)
      this.buffer = merged
    }
  }

  async read(length: number) {
    await this.fill(length)

    if (this.buffer.length < length) {
      return null
    }

    const result = this.buffer.slice(0, length)
    this.buffer = this.buffer.subarray(length)
    return result
  }

  async skip(length: number) {
    let remaining = length

    while (remaining > 0) {
      await this.fill(1)

      if (this.buffer.length === 0) {
        throw new Error('El archivo de backup está corrupto o incompleto.')
      }

      const take = Math.min(remaining, this.buffer.length)
      this.buffer = this.buffer.subarray(take)
      remaining -= take
    }
  }

  /** Copia exactamente `length` bytes a un stream nuevo (para subir a R2 sin cargarlo entero). */
  async pipeTo(length: number, writable: WritableStream<Uint8Array>) {
    const writer = writable.getWriter()
    let remaining = length

    try {
      while (remaining > 0) {
        await this.fill(1)

        if (this.buffer.length === 0) {
          throw new Error('El archivo de backup está corrupto o incompleto.')
        }

        const take = Math.min(remaining, this.buffer.length, 1024 * 1024)
        await writer.write(this.buffer.slice(0, take))
        this.buffer = this.buffer.subarray(take)
        remaining -= take
      }

      await writer.close()
    } catch (error) {
      await writer.abort(error).catch(() => undefined)
      throw error
    }
  }
}

async function importBackupFromStream(stream: ReadableStream<Uint8Array>): Promise<ImportSummary> {
  const reader = new StreamReader(stream)
  const storage = bucket()
  let pendingLongName: string | null = null
  let payload: BackupPayload | null = null
  let restoredTables: Record<string, number> = {}
  let mediaFiles = 0

  while (true) {
    const header = await reader.read(512)

    if (!header || header.every((byte) => byte === 0)) {
      break
    }

    const name = readTarString(header, 0, 100)
    const prefix = readTarString(header, 345, 155)
    const entrySize = parseInt(readTarString(header, 124, 12).trim() || '0', 8)
    const typeFlag = header[156]

    if (Number.isNaN(entrySize) || entrySize < 0) {
      throw new Error('El archivo de backup está corrupto o incompleto.')
    }

    const padding = Math.ceil(entrySize / 512) * 512 - entrySize

    if (typeFlag === 0x4c) {
      const nameBytes = await reader.read(entrySize)

      if (!nameBytes) {
        throw new Error('El archivo de backup está corrupto o incompleto.')
      }

      pendingLongName = decoder.decode(nameBytes).replace(/\0+$/, '')
      await reader.skip(padding)
      continue
    }

    if (typeFlag !== 0x30 && typeFlag !== 0) {
      pendingLongName = null
      await reader.skip(entrySize + padding)
      continue
    }

    const entryName = pendingLongName ?? (prefix ? `${prefix}/${name}` : name)
    pendingLongName = null

    if (entryName === 'database.json') {
      const bytes = await reader.read(entrySize)

      if (!bytes) {
        throw new Error('El archivo de backup está corrupto o incompleto.')
      }

      payload = parseBackupPayload(bytes)
      restoredTables = await restoreDatabase(payload)
      await reader.skip(padding)
      continue
    }

    const key = entryName.startsWith('uploads/') ? entryName.split('/').filter(Boolean).pop() : null

    if (!key || key.startsWith('_')) {
      await reader.skip(entrySize + padding)
      continue
    }

    if (!payload) {
      throw new Error('El archivo no contiene database.json al inicio. ¿Es un backup válido del portal?')
    }

    const { readable, writable } = new FixedLengthStream(entrySize)
    const upload = storage.put(key, readable, {
      httpMetadata: { cacheControl: 'public, max-age=31536000, immutable' },
    })
    await Promise.all([reader.pipeTo(entrySize, writable), upload])
    await reader.skip(padding)
    mediaFiles += 1
  }

  if (!payload) {
    throw new Error('El archivo no contiene database.json. ¿Es un backup válido del portal?')
  }

  return {
    exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : null,
    tables: restoredTables,
    mediaFiles,
  }
}

// --- Subida por fragmentos: cada fragmento es un objeto R2; al terminar se leen en orden. ---

function chunkKey(id: string, offset: number) {
  return `${IMPORT_PREFIX}${id}/${String(offset).padStart(14, '0')}`
}

async function listImportChunks(id: string) {
  const chunks: Array<{ key: string; offset: number; size: number }> = []
  let cursor: string | undefined

  do {
    const page = await bucket().list({ prefix: `${IMPORT_PREFIX}${id}/`, cursor, limit: 1000 })

    for (const object of page.objects) {
      const offset = Number(object.key.split('/').pop())

      if (Number.isFinite(offset)) {
        chunks.push({ key: object.key, offset, size: object.size })
      }
    }

    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)

  return chunks.sort((a, b) => a.offset - b.offset)
}

export async function createImportUpload() {
  await cleanupOldBackups().catch(() => undefined)
  const id = createId()
  await bucket().put(`${IMPORT_PREFIX}${id}/.started`, '')
  return { id }
}

export async function appendImportChunk(id: string, offset: number, data: Uint8Array) {
  if (!isValidBackupId(id)) {
    throw new Error('Identificador de subida inválido')
  }

  if (!(await bucket().head(`${IMPORT_PREFIX}${id}/.started`))) {
    throw new Error('La subida no existe o expiró. Vuelve a iniciar la importación.')
  }

  const chunks = await listImportChunks(id)
  const currentSize = chunks.reduce((total, chunk) => total + chunk.size, 0)

  if (offset < currentSize) {
    return { size: currentSize }
  }

  if (offset > currentSize) {
    throw new Error('Fragmento fuera de orden. Vuelve a iniciar la importación.')
  }

  await bucket().put(chunkKey(id, offset), data)
  return { size: currentSize + data.length }
}

export async function finishImportUpload(id: string): Promise<ImportSummary> {
  if (!isValidBackupId(id)) {
    throw new Error('Identificador de subida inválido')
  }

  const chunks = await listImportChunks(id)
  const storage = bucket()
  let index = 0
  let current: ReadableStreamDefaultReader<Uint8Array> | null = null

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        if (!current) {
          const chunk = chunks[index++]

          if (!chunk) {
            controller.close()
            return
          }

          const object = await storage.get(chunk.key)

          if (!object) {
            controller.error(new Error('Falta un fragmento del backup. Vuelve a subirlo.'))
            return
          }

          current = (object.body as unknown as ReadableStream<Uint8Array>).getReader()
        }

        const { done, value } = await current!.read()

        if (done) {
          current = null
          continue
        }

        controller.enqueue(value)
        return
      }
    },
  })

  try {
    return await importBackupFromStream(stream)
  } finally {
    const keys = [`${IMPORT_PREFIX}${id}/.started`, ...chunks.map((chunk) => chunk.key)]

    for (let start = 0; start < keys.length; start += 1000) {
      await storage.delete(keys.slice(start, start + 1000)).catch(() => undefined)
    }
  }
}
