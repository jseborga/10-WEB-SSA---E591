import { readdir, readFile, stat } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { ensureMediaRoot, saveUploadedFile } from '@/lib/media-storage'

export const BACKUP_FORMAT = 'ssa-portal-backup'
export const BACKUP_VERSION = 1

// Todas las tablas del portal. No hay claves foráneas en el esquema, así que
// el orden de restauración no es crítico, pero se mantiene estable.
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
] as const

type BackupModel = (typeof BACKUP_MODELS)[number]

const ANALYTICS_MODELS: BackupModel[] = ['visitorSession', 'visitorEvent', 'automationLog']

const CREATE_CHUNK_SIZE = 100

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

function getDelegate(client: unknown, model: BackupModel) {
  return (client as Record<BackupModel, PrismaDelegate>)[model]
}

// --- Escritura/lectura de archivos tar (formato ustar, sin dependencias) ---

type TarEntry = {
  name: string
  data: Buffer
}

function writeOctal(header: Buffer, offset: number, length: number, value: number) {
  header.write(value.toString(8).padStart(length - 1, '0') + '\0', offset, 'ascii')
}

function createTarHeader(name: string, size: number) {
  const header = Buffer.alloc(512)

  let fileName = name
  let prefix = ''

  if (Buffer.byteLength(fileName) > 100) {
    const slashIndex = name.indexOf('/')

    if (slashIndex === -1 || Buffer.byteLength(name.slice(slashIndex + 1)) > 100) {
      throw new Error(`Nombre de archivo demasiado largo para el backup: ${name}`)
    }

    prefix = name.slice(0, slashIndex)
    fileName = name.slice(slashIndex + 1)
  }

  header.write(fileName, 0, 'utf8')
  writeOctal(header, 100, 8, 0o644)
  writeOctal(header, 108, 8, 0)
  writeOctal(header, 116, 8, 0)
  writeOctal(header, 124, 12, size)
  writeOctal(header, 136, 12, Math.floor(Date.now() / 1000))
  header.fill(' ', 148, 156)
  header.write('0', 156, 'ascii')
  header.write('ustar\0', 257, 'ascii')
  header.write('00', 263, 'ascii')

  if (prefix) {
    header.write(prefix, 345, 'utf8')
  }

  let checksum = 0

  for (const byte of header) {
    checksum += byte
  }

  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii')

  return header
}

function buildTar(entries: TarEntry[]) {
  const blocks: Buffer[] = []

  for (const entry of entries) {
    blocks.push(createTarHeader(entry.name, entry.data.length))
    blocks.push(entry.data)

    const remainder = entry.data.length % 512

    if (remainder > 0) {
      blocks.push(Buffer.alloc(512 - remainder))
    }
  }

  blocks.push(Buffer.alloc(1024))

  return Buffer.concat(blocks)
}

function readTarString(block: Buffer, offset: number, length: number) {
  const slice = block.subarray(offset, offset + length)
  const end = slice.indexOf(0)
  return slice.subarray(0, end === -1 ? length : end).toString('utf8')
}

function parseTar(buffer: Buffer) {
  const entries: TarEntry[] = []
  let offset = 0

  while (offset + 512 <= buffer.length) {
    const block = buffer.subarray(offset, offset + 512)

    if (block.every((byte) => byte === 0)) {
      break
    }

    const name = readTarString(block, 0, 100)
    const prefix = readTarString(block, 345, 155)
    const size = parseInt(readTarString(block, 124, 12).trim() || '0', 8)

    if (Number.isNaN(size) || size < 0 || offset + 512 + size > buffer.length) {
      throw new Error('El archivo de backup está corrupto o incompleto.')
    }

    const typeFlag = block[156]
    offset += 512

    // Solo archivos regulares (typeflag '0' o NUL)
    if (typeFlag === 0x30 || typeFlag === 0) {
      entries.push({
        name: prefix ? `${prefix}/${name}` : name,
        data: Buffer.from(buffer.subarray(offset, offset + size)),
      })
    }

    offset += Math.ceil(size / 512) * 512
  }

  return entries
}

// --- Exportación ---

export async function exportBackup(options?: { includeAnalytics?: boolean }) {
  const includeAnalytics = options?.includeAnalytics ?? true
  const tables: Record<string, Record<string, unknown>[]> = {}

  for (const model of BACKUP_MODELS) {
    if (!includeAnalytics && ANALYTICS_MODELS.includes(model)) {
      continue
    }

    tables[model] = await getDelegate(db, model).findMany()
  }

  const payload: BackupPayload = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  }

  const entries: TarEntry[] = [
    {
      name: 'database.json',
      data: Buffer.from(JSON.stringify(payload), 'utf8'),
    },
  ]

  const mediaRoot = await ensureMediaRoot()
  const mediaFiles = await readdir(mediaRoot)
  let mediaCount = 0

  for (const fileName of mediaFiles) {
    const filePath = path.join(mediaRoot, fileName)
    const fileStat = await stat(filePath)

    if (!fileStat.isFile()) {
      continue
    }

    entries.push({
      name: `uploads/${fileName}`,
      data: await readFile(filePath),
    })
    mediaCount += 1
  }

  return {
    archive: buildTar(entries),
    tableCounts: Object.fromEntries(Object.entries(tables).map(([model, rows]) => [model, rows.length])),
    mediaCount,
  }
}

// --- Importación ---

export type ImportSummary = {
  exportedAt: string | null
  tables: Record<string, number>
  mediaFiles: number
}

export async function importBackup(archive: Buffer): Promise<ImportSummary> {
  const entries = parseTar(archive)
  const databaseEntry = entries.find((entry) => entry.name === 'database.json')

  if (!databaseEntry) {
    throw new Error('El archivo no contiene database.json. ¿Es un backup válido del portal?')
  }

  let payload: BackupPayload

  try {
    payload = JSON.parse(databaseEntry.data.toString('utf8')) as BackupPayload
  } catch {
    throw new Error('No se pudo leer database.json del backup.')
  }

  if (payload.format !== BACKUP_FORMAT) {
    throw new Error('El archivo no es un backup de este portal.')
  }

  if (payload.version !== BACKUP_VERSION) {
    throw new Error(`Versión de backup no soportada (${payload.version}). Esta instancia soporta la versión ${BACKUP_VERSION}.`)
  }

  const restoredTables: Record<string, number> = {}

  await db.$transaction(
    async (tx) => {
      for (const model of BACKUP_MODELS) {
        const rows = payload.tables?.[model]

        if (!Array.isArray(rows)) {
          continue
        }

        const delegate = getDelegate(tx, model)
        await delegate.deleteMany()

        for (let index = 0; index < rows.length; index += CREATE_CHUNK_SIZE) {
          await delegate.createMany({ data: rows.slice(index, index + CREATE_CHUNK_SIZE) })
        }

        restoredTables[model] = rows.length
      }
    },
    { timeout: 180_000, maxWait: 15_000 },
  )

  await ensureMediaRoot()
  let mediaFiles = 0

  for (const entry of entries) {
    if (!entry.name.startsWith('uploads/')) {
      continue
    }

    const fileName = path.basename(entry.name)

    if (!fileName) {
      continue
    }

    await saveUploadedFile(fileName, entry.data)
    mediaFiles += 1
  }

  return {
    exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : null,
    tables: restoredTables,
    mediaFiles,
  }
}
