import type { PublicationDTO } from '@/components/admin/types'
import { db } from '@/lib/db'
import { buildPublicationHref } from '@/lib/menu-config'

export function slugifyPublicationValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function normalizeSeoKeywords(value: string | null | undefined) {
  const seen = new Set<string>()

  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const normalized = item.toLowerCase()
      if (seen.has(normalized)) {
        return false
      }
      seen.add(normalized)
      return true
    })
    .join(', ')
}

export async function ensureUniquePublicationSlug(rawValue: string, currentId?: string) {
  const baseSlug = slugifyPublicationValue(rawValue) || 'pagina'
  let candidate = baseSlug
  let index = 2

  while (true) {
    const existing = await db.publication.findFirst({
      where: {
        slug: candidate,
        ...(currentId ? { id: { not: currentId } } : {}),
      },
      select: { id: true },
    })

    if (!existing) {
      return candidate
    }

    candidate = `${baseSlug}-${index}`
    index += 1
  }
}

export function getPublicationHref(slug: string) {
  const normalized = slugifyPublicationValue(slug)

  if (normalized === 'contacto') {
    return '/contacto'
  }

  if (['cotizacion', 'cotizacion-de-proyectos', 'quote', 'quotation'].includes(normalized)) {
    return '/cotizacion'
  }

  if (normalized === 'estudio') {
    return '/estudio'
  }

  return `/info/${normalized}`
}

/* ------------------------------------------------------------------ */
/* Galería, origen y mapeo a DTO                                        */
/* ------------------------------------------------------------------ */

export const PUBLICATION_SOURCES = ['manual', 'instagram', 'facebook'] as const
export type PublicationSource = (typeof PUBLICATION_SOURCES)[number]

/** Slugs de páginas gestionadas (estudio, servicios, contacto, cotización) que usan secciones guiadas. */
export const MANAGED_PUBLICATION_SLUGS = [
  'estudio',
  'nosotros',
  'sobre-nosotros',
  'about',
  'servicios',
  'services',
  'servicos',
  'contacto',
  'contact',
  'contato',
  'cotizacion',
  'cotizacion-de-proyectos',
  'quote',
  'quotation',
]

function isPublicUrlLike(value: string) {
  return value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://')
}

/** Lee la galería guardada (JSON o una URL por línea) como arreglo de URLs. */
export function parsePublicationGallery(value: string | null | undefined): string[] {
  const raw = (value || '').trim()

  if (!raw) {
    return []
  }

  let items: unknown[] = []

  try {
    const parsed = JSON.parse(raw)
    items = Array.isArray(parsed) ? parsed : []
  } catch {
    items = raw.split('\n')
  }

  return Array.from(
    new Set(
      items
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item && isPublicUrlLike(item)),
    ),
  )
}

/** Acepta arreglo o string (JSON / líneas) y devuelve el JSON a guardar, o null si queda vacía. */
export function serializePublicationGallery(value: unknown): string | null {
  const urls = Array.isArray(value)
    ? parsePublicationGallery(JSON.stringify(value.filter((item) => typeof item === 'string')))
    : typeof value === 'string'
      ? parsePublicationGallery(value)
      : []

  return urls.length > 0 ? JSON.stringify(urls.slice(0, 60)) : null
}

export function normalizePublicationSource(value: unknown): PublicationSource {
  return typeof value === 'string' && (PUBLICATION_SOURCES as readonly string[]).includes(value)
    ? (value as PublicationSource)
    : 'manual'
}

type PublicationRow = {
  id: string
  title: string
  titleEn: string | null
  titlePt: string | null
  slug: string
  excerpt: string | null
  excerptEn: string | null
  excerptPt: string | null
  content: string | null
  contentEn: string | null
  contentPt: string | null
  image: string | null
  gallery?: string | null
  seoTitle: string | null
  seoDescription: string | null
  seoKeywords: string | null
  published: boolean
  showInMenu: boolean
  menuOrder: number
  category: string | null
  source?: string | null
  externalId?: string | null
  externalUrl?: string | null
  publishedAt?: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
}

function toIso(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  return value instanceof Date ? value.toISOString() : String(value)
}

/**
 * Mapea una fila de Prisma al contrato PublicationDTO. `gallery` se mantiene como JSON (string)
 * según el contrato y se agrega `galleryUrls` ya parseado para comodidad del cliente.
 */
export function toPublicationDTO(row: PublicationRow): PublicationDTO & { galleryUrls: string[]; href: string } {
  const galleryUrls = parsePublicationGallery(row.gallery)

  return {
    id: row.id,
    title: row.title,
    titleEn: row.titleEn,
    titlePt: row.titlePt,
    slug: row.slug,
    excerpt: row.excerpt,
    excerptEn: row.excerptEn,
    excerptPt: row.excerptPt,
    content: row.content,
    contentEn: row.contentEn,
    contentPt: row.contentPt,
    image: row.image,
    gallery: galleryUrls.length > 0 ? JSON.stringify(galleryUrls) : null,
    galleryUrls,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    seoKeywords: row.seoKeywords,
    published: row.published,
    showInMenu: row.showInMenu,
    menuOrder: row.menuOrder,
    category: row.category,
    source: row.source || 'manual',
    externalId: row.externalId ?? null,
    externalUrl: row.externalUrl ?? null,
    publishedAt: toIso(row.publishedAt),
    createdAt: toIso(row.createdAt) || '',
    updatedAt: toIso(row.updatedAt) || '',
    href: buildPublicationHref(row.slug),
  }
}

function readText(value: unknown) {
  return typeof value === 'string' ? value.trim() : null
}

function parseMenuOrderValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : parseInt(String(value ?? ''), 10) || 0
}

function parseDateValue(value: unknown) {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Construye los datos editables a partir del body del API.
 * Campos clásicos: mismo comportamiento que antes (ausente → null) para no romper el panel antiguo.
 * Campos nuevos (gallery, source, externalId, externalUrl, publishedAt): solo se tocan si vienen en el body.
 */
export function buildPublicationWriteData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {
    titleEn: readText(body.titleEn),
    titlePt: readText(body.titlePt),
    excerpt: readText(body.excerpt),
    excerptEn: readText(body.excerptEn),
    excerptPt: readText(body.excerptPt),
    content: readText(body.content),
    contentEn: readText(body.contentEn),
    contentPt: readText(body.contentPt),
    image: readText(body.image),
    seoTitle: readText(body.seoTitle),
    seoDescription: readText(body.seoDescription),
    seoKeywords: normalizeSeoKeywords(typeof body.seoKeywords === 'string' ? body.seoKeywords : ''),
    published: Boolean(body.published),
    category: typeof body.category === 'string' ? slugifyPublicationValue(body.category) || body.category.trim() : null,
    showInMenu: Boolean(body.showInMenu),
    menuOrder: parseMenuOrderValue(body.menuOrder),
  }

  if ('gallery' in body) {
    data.gallery = serializePublicationGallery(body.gallery)
  }

  if ('source' in body) {
    data.source = normalizePublicationSource(body.source)
  }

  if ('externalId' in body) {
    data.externalId = readText(body.externalId) || null
  }

  if ('externalUrl' in body) {
    const url = readText(body.externalUrl)
    data.externalUrl = url && /^https?:\/\//i.test(url) ? url : null
  }

  if ('publishedAt' in body) {
    data.publishedAt = parseDateValue(body.publishedAt)
  }

  return data
}
