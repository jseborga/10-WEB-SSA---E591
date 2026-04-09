import { db } from '@/lib/db'

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

  if (normalized === 'estudio') {
    return '/estudio'
  }

  return `/info/${normalized}`
}
