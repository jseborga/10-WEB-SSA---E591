import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
}

export function getMediaRoot() {
  return process.env.MEDIA_DIR?.trim() || path.join(process.cwd(), 'data', 'uploads')
}

export async function ensureMediaRoot() {
  const mediaRoot = getMediaRoot()
  await mkdir(mediaRoot, { recursive: true })
  return mediaRoot
}

export function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/-+/g, '-')
}

export function createStoredFileName(originalName: string) {
  const parsed = path.parse(sanitizeFileName(originalName))
  const ext = parsed.ext || ''
  const base = parsed.name || 'media'
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${base}${ext}`
}

export function getMediaPath(fileName: string) {
  const safeName = path.basename(fileName)
  return path.join(getMediaRoot(), safeName)
}

export async function saveUploadedFile(fileName: string, buffer: Buffer) {
  const mediaRoot = await ensureMediaRoot()
  const target = path.join(mediaRoot, path.basename(fileName))
  await writeFile(target, buffer)
  return target
}

export async function readStoredFile(fileName: string) {
  const target = getMediaPath(fileName)
  return readFile(target)
}

export function getContentType(fileName: string) {
  const ext = path.extname(fileName).toLowerCase()
  return CONTENT_TYPES[ext] || 'application/octet-stream'
}
