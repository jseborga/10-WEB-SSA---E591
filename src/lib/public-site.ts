export interface PublicProject {
  id: string
  title: string
  titleEn?: string | null
  titlePt?: string | null
  description: string | null
  descriptionEn?: string | null
  descriptionPt?: string | null
  fullDescription?: string | null
  fullDescriptionEn?: string | null
  fullDescriptionPt?: string | null
  category: string
  location: string | null
  year: number | null
  area: string | null
  mainImage?: string | null
  gallery?: string | null
  videoUrl?: string | null
  client?: string | null
  status?: string | null
  published?: boolean
}

export interface PublicPublication {
  id: string
  title: string
  titleEn?: string | null
  titlePt?: string | null
  slug: string
  excerpt?: string | null
  excerptEn?: string | null
  excerptPt?: string | null
  content?: string | null
  contentEn?: string | null
  contentPt?: string | null
  image?: string | null
}

export interface PublicSiteSettings {
  companyName?: string | null
  legalName?: string | null
  tagline?: string | null
  logoUrl?: string | null
  faviconUrl?: string | null
  heroImages?: string | null
  heroImagesMobile?: string | null
  heroImageOpacity?: number | null
  heroImageSaturation?: number | null
  heroImageBrightness?: number | null
  heroImageContrast?: number | null
  heroImageFit?: string | null
  heroImageTreatment?: string | null
  heroShowCompanyName?: boolean | null
  heroTextTone?: string | null
  projectCategories?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  addressLine?: string | null
  city?: string | null
  country?: string | null
  footerText?: string | null
  instagramUrl?: string | null
  facebookUrl?: string | null
  linkedinUrl?: string | null
  youtubeUrl?: string | null
  tiktokUrl?: string | null
}

export function parseUrlList(value: string | null | undefined) {
  const rawValue = (value || '').trim()

  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue)

    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.startsWith('/') || item.startsWith('http://') || item.startsWith('https://'))
    }
  } catch {
    // Fall back to line-based parsing.
  }

  return rawValue
    .split('\n')
    .map((line) => line.trim().replace(/^['"]|['"]$/g, ''))
    .filter((line) => line.startsWith('/') || line.startsWith('http://') || line.startsWith('https://'))
}

export function parseLineList(value: string | null | undefined) {
  return (value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function formatCategoryLabel(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getProjectCategories(configuredCategories: string | null | undefined, projectCategories: string[] = []) {
  const configured = parseLineList(configuredCategories)
  const merged = [...configured]

  for (const category of projectCategories) {
    const normalized = category.trim()

    if (normalized && !merged.includes(normalized)) {
      merged.push(normalized)
    }
  }

  return merged
}

export function getLocalizedPublicationValue(
  publication: PublicPublication | null | undefined,
  language: 'es' | 'en' | 'pt',
  field: 'title' | 'excerpt' | 'content',
) {
  if (!publication) {
    return ''
  }

  if (field === 'title') {
    if (language === 'en' && publication.titleEn) return publication.titleEn
    if (language === 'pt' && publication.titlePt) return publication.titlePt
    return publication.title
  }

  if (field === 'excerpt') {
    if (language === 'en' && publication.excerptEn) return publication.excerptEn || ''
    if (language === 'pt' && publication.excerptPt) return publication.excerptPt || ''
    return publication.excerpt || ''
  }

  if (language === 'en' && publication.contentEn) return publication.contentEn || ''
  if (language === 'pt' && publication.contentPt) return publication.contentPt || ''
  return publication.content || ''
}
