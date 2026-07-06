import { createWriteStream } from 'fs'
import { mkdir, readdir, readFile, rm, stat } from 'fs/promises'
import { randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
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

function tarPadding(size: number) {
  const remainder = size % 512
  return remainder > 0 ? Buffer.alloc(512 - remainder) : null
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

export function getBackupsDir() {
  return process.env.BACKUP_DIR?.trim() || path.join(process.cwd(), 'data', 'backups')
}

const BACKUP_FILE_MAX_AGE_MS = 6 * 60 * 60 * 1000

function isValidBackupId(id: string) {
  return /^[a-z0-9-]{8,80}$/.test(id)
}

async function cleanupOldBackups(backupsDir: string) {
  let fileNames: string[]

  try {
    fileNames = await readdir(backupsDir)
  } catch {
    return
  }

  for (const fileName of fileNames) {
    if (!fileName.endsWith('.tar')) {
      continue
    }

    try {
      const filePath = path.join(backupsDir, fileName)
      const fileStat = await stat(filePath)

      if (Date.now() - fileStat.mtimeMs > BACKUP_FILE_MAX_AGE_MS) {
        await rm(filePath, { force: true })
      }
    } catch {
      // Si un archivo no se puede limpiar, no bloquea la generación del backup
    }
  }
}

// Genera el backup como archivo en disco (data/backups) para poder servirlo
// después con soporte de rangos HTTP: la descarga es reanudable y no depende
// de mantener viva una única conexión larga.
export async function prepareBackupFile(options?: { includeAnalytics?: boolean }) {
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

  const databaseBuffer = Buffer.from(JSON.stringify(payload), 'utf8')
  const mediaRoot = await ensureMediaRoot()
  const mediaFileNames: string[] = []

  for (const fileName of await readdir(mediaRoot)) {
    const fileStat = await stat(path.join(mediaRoot, fileName))

    if (fileStat.isFile()) {
      mediaFileNames.push(fileName)
    }
  }

  async function* tarChunks() {
    yield createTarHeader('database.json', databaseBuffer.length)
    yield databaseBuffer

    const databasePadding = tarPadding(databaseBuffer.length)

    if (databasePadding) {
      yield databasePadding
    }

    for (const fileName of mediaFileNames) {
      const data = await readFile(path.join(mediaRoot, fileName))
      yield createTarHeader(`uploads/${fileName}`, data.length)
      yield data

      const padding = tarPadding(data.length)

      if (padding) {
        yield padding
      }
    }

    yield Buffer.alloc(1024)
  }

  const backupsDir = getBackupsDir()
  await mkdir(backupsDir, { recursive: true })
  await cleanupOldBackups(backupsDir)

  const id = `${new Date().toISOString().slice(0, 10)}-${randomBytes(8).toString('hex')}`
  const filePath = path.join(backupsDir, `${id}.tar`)

  try {
    await pipeline(Readable.from(tarChunks()), createWriteStream(filePath))
  } catch (error) {
    await rm(filePath, { force: true }).catch(() => undefined)
    throw error
  }

  const fileStat = await stat(filePath)

  return {
    id,
    size: fileStat.size,
    fileName: `ssa-portal-backup-${id}.tar`,
    mediaCount: mediaFileNames.length,
  }
}

export async function resolveBackupFile(id: string) {
  if (!isValidBackupId(id)) {
    return null
  }

  const filePath = path.join(getBackupsDir(), `${id}.tar`)

  try {
    const fileStat = await stat(filePath)

    if (!fileStat.isFile()) {
      return null
    }

    return { path: filePath, size: fileStat.size }
  } catch {
    return null
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
