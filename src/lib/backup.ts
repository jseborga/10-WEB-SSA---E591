import { createWriteStream } from 'fs'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
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

function buildTarHeaderBlock(name: string, size: number, typeFlag: string, prefix = '') {
  const header = Buffer.alloc(512)

  header.write(name, 0, 100, 'utf8')
  writeOctal(header, 100, 8, 0o644)
  writeOctal(header, 108, 8, 0)
  writeOctal(header, 116, 8, 0)
  writeOctal(header, 124, 12, size)
  writeOctal(header, 136, 12, Math.floor(Date.now() / 1000))
  header.fill(' ', 148, 156)
  header.write(typeFlag, 156, 'ascii')
  header.write('ustar\0', 257, 'ascii')
  header.write('00', 263, 'ascii')

  if (prefix) {
    header.write(prefix, 345, 155, 'utf8')
  }

  let checksum = 0

  for (const byte of header) {
    checksum += byte
  }

  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii')

  return header
}

// Cabecera(s) de una entrada. Los nombres que no caben en los 100 bytes del
// formato clásico usan el mecanismo GNU @LongLink (compatible con tar y 7-Zip):
// una pseudo-entrada 'L' lleva el nombre completo como datos.
function createTarEntryBlocks(name: string, size: number) {
  if (Buffer.byteLength(name, 'utf8') <= 100) {
    return [buildTarHeaderBlock(name, size, '0')]
  }

  const slashIndex = name.indexOf('/')

  if (slashIndex !== -1) {
    const prefix = name.slice(0, slashIndex)
    const rest = name.slice(slashIndex + 1)

    if (Buffer.byteLength(rest, 'utf8') <= 100 && Buffer.byteLength(prefix, 'utf8') <= 155) {
      return [buildTarHeaderBlock(rest, size, '0', prefix)]
    }
  }

  const nameData = Buffer.from(name + '\0', 'utf8')
  const blocks = [buildTarHeaderBlock('././@LongLink', nameData.length, 'L'), nameData]
  const padding = tarPadding(nameData.length)

  if (padding) {
    blocks.push(padding)
  }

  let truncatedName = name.slice(0, 100)

  while (Buffer.byteLength(truncatedName, 'utf8') > 100) {
    truncatedName = truncatedName.slice(0, -1)
  }

  blocks.push(buildTarHeaderBlock(truncatedName, size, '0'))
  return blocks
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
  let pendingLongName: string | null = null

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
    const data = buffer.subarray(offset, offset + size)
    offset += Math.ceil(size / 512) * 512

    if (typeFlag === 0x4c) {
      // Entrada GNU @LongLink: contiene el nombre completo de la siguiente entrada
      pendingLongName = data.toString('utf8').replace(/\0+$/, '')
      continue
    }

    // Solo archivos regulares (typeflag '0' o NUL)
    if (typeFlag === 0x30 || typeFlag === 0) {
      entries.push({
        name: pendingLongName ?? (prefix ? `${prefix}/${name}` : name),
        data: Buffer.from(data),
      })
    }

    pendingLongName = null
  }

  return entries
}

// --- Exportación ---

export function getBackupsDir() {
  return process.env.BACKUP_DIR?.trim() || path.join(process.cwd(), 'data', 'backups')
}

const BACKUP_FILE_MAX_AGE_MS = 24 * 60 * 60 * 1000
const BACKUP_GENERATION_STALE_MS = 30 * 60 * 1000

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

function isValidBackupId(id: string) {
  return /^[a-z0-9-]{8,80}$/.test(id)
}

function tarFilePath(id: string) {
  return path.join(getBackupsDir(), `${id}.tar`)
}

function statusFilePath(id: string) {
  return path.join(getBackupsDir(), `${id}.json`)
}

async function writeBackupStatus(status: BackupStatus) {
  await writeFile(statusFilePath(status.id), JSON.stringify(status), 'utf8')
}

async function readBackupStatus(id: string): Promise<BackupStatus | null> {
  try {
    const parsed = JSON.parse(await readFile(statusFilePath(id), 'utf8')) as BackupStatus

    if (parsed?.id !== id || !['generating', 'ready', 'error'].includes(parsed.status)) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

// Un backup que sigue "generando" tras un reinicio del servidor queda huérfano:
// se reporta como error para que el usuario genere uno nuevo.
function withStaleCheck(status: BackupStatus): BackupStatus {
  if (status.status === 'generating' && Date.now() - new Date(status.createdAt).getTime() > BACKUP_GENERATION_STALE_MS) {
    return { ...status, status: 'error', error: 'La generación se interrumpió (posible reinicio del servidor). Genera un backup nuevo.' }
  }

  return status
}

async function cleanupOldBackups(backupsDir: string) {
  let fileNames: string[]

  try {
    fileNames = await readdir(backupsDir)
  } catch {
    return
  }

  for (const fileName of fileNames) {
    if (!fileName.endsWith('.tar') && !fileName.endsWith('.json')) {
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

async function generateBackupTar(id: string, includeAnalytics: boolean) {
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
    yield* createTarEntryBlocks('database.json', databaseBuffer.length)
    yield databaseBuffer

    const databasePadding = tarPadding(databaseBuffer.length)

    if (databasePadding) {
      yield databasePadding
    }

    for (const fileName of mediaFileNames) {
      const data = await readFile(path.join(mediaRoot, fileName))
      yield* createTarEntryBlocks(`uploads/${fileName}`, data.length)
      yield data

      const padding = tarPadding(data.length)

      if (padding) {
        yield padding
      }
    }

    yield Buffer.alloc(1024)
  }

  const filePath = tarFilePath(id)

  try {
    await pipeline(Readable.from(tarChunks()), createWriteStream(filePath))
  } catch (error) {
    await rm(filePath, { force: true }).catch(() => undefined)
    throw error
  }

  const fileStat = await stat(filePath)

  return { size: fileStat.size, mediaCount: mediaFileNames.length }
}

// Lanza la generación en segundo plano y responde de inmediato: el avance se
// consulta con listBackups() y el archivo se descarga cuando está "ready".
export async function startBackupGeneration(options?: { includeAnalytics?: boolean }) {
  const includeAnalytics = options?.includeAnalytics ?? true
  const backupsDir = getBackupsDir()
  await mkdir(backupsDir, { recursive: true })
  await cleanupOldBackups(backupsDir)

  const id = `${new Date().toISOString().slice(0, 10)}-${randomBytes(6).toString('hex')}`
  const status: BackupStatus = {
    id,
    status: 'generating',
    createdAt: new Date().toISOString(),
    includeAnalytics,
  }

  await writeBackupStatus(status)

  void (async () => {
    try {
      const { size, mediaCount } = await generateBackupTar(id, includeAnalytics)
      await writeBackupStatus({ ...status, status: 'ready', size, mediaCount, finishedAt: new Date().toISOString() })
    } catch (error) {
      console.error(`Error generating backup ${id}:`, error)
      await writeBackupStatus({
        ...status,
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido al generar el backup',
        finishedAt: new Date().toISOString(),
      }).catch(() => undefined)
    }
  })()

  return status
}

export async function listBackups(): Promise<BackupStatus[]> {
  let fileNames: string[]

  try {
    fileNames = await readdir(getBackupsDir())
  } catch {
    return []
  }

  const backups: BackupStatus[] = []

  for (const fileName of fileNames) {
    if (!fileName.endsWith('.json')) {
      continue
    }

    const status = await readBackupStatus(fileName.slice(0, -5))

    if (status) {
      backups.push(withStaleCheck(status))
    }
  }

  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function deleteBackup(id: string) {
  if (!isValidBackupId(id)) {
    return false
  }

  await rm(tarFilePath(id), { force: true })
  await rm(statusFilePath(id), { force: true })
  return true
}

export async function resolveBackupFile(id: string) {
  if (!isValidBackupId(id)) {
    return null
  }

  const status = await readBackupStatus(id)

  if (!status || status.status !== 'ready') {
    return null
  }

  try {
    const fileStat = await stat(tarFilePath(id))

    if (!fileStat.isFile()) {
      return null
    }

    return { path: tarFilePath(id), size: fileStat.size }
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
