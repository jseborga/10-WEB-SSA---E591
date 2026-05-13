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
  mainImageAlt?: string | null
  mainImageCaption?: string | null
  mainImageMobile?: string | null
  gallery?: string | null
  galleryMobile?: string | null
  videoUrl?: string | null
  client?: string | null
  referenceUrl?: string | null
  instagramUrl?: string | null
  facebookUrl?: string | null
  linkedinUrl?: string | null
  youtubeUrl?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string | null
  projectTags?: string | null
  galleryAnnotations?: string | null
  galleryMobileAnnotations?: string | null
  status?: string | null
  showOnHomepage?: boolean
  published?: boolean
}

export interface ProjectMediaAnnotation {
  url: string
  category?: string | null
  label?: string | null
  tags: string[]
}

export interface ProjectMediaItem {
  url: string
  category: string
  label: string
  tags: string[]
  isLead: boolean
  alt: string
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
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string | null
  category?: string | null
}

export interface PublicSiteSettings {
  companyName?: string | null
  legalName?: string | null
  tagline?: string | null
  siteUrl?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string | null
  logoUrl?: string | null
  faviconUrl?: string | null
  socialShareImageUrl?: string | null
  heroImages?: string | null
  heroImagesMobile?: string | null
  heroMessages?: string | null
  heroRotationMs?: number | null
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
  xUrl?: string | null
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

function isMediaUrl(value: string) {
  return value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://')
}

export function normalizeTag(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/^#+/g, '')
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function formatTagLabel(value: string) {
  const normalized = normalizeTag(value)
  return normalized ? `#${normalized}` : ''
}

export function parseTagList(value: string | null | undefined) {
  const chunks = (value || '')
    .replace(/[;,]+/g, '\n')
    .split('\n')
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  const tags = chunks.flatMap((chunk) => {
    const hashtagMatches = Array.from(chunk.matchAll(/#([^\s#,;|]+)/g), (match) => normalizeTag(match[1] || ''))
      .filter(Boolean)

    if (hashtagMatches.length > 0) {
      return hashtagMatches
    }

    const normalized = normalizeTag(chunk)
    return normalized ? [normalized] : []
  })

  return Array.from(new Set(tags))
}

export function parseProjectMediaAnnotations(value: string | null | undefined) {
  return parseLineList(value).reduce<ProjectMediaAnnotation[]>((items, line) => {
      const [urlPart = '', categoryPart = '', labelPart = '', ...tagParts] = line.split('|').map((part) => part.trim())

      if (!isMediaUrl(urlPart)) {
        return items
      }

      items.push({
        url: urlPart,
        category: categoryPart || null,
        label: labelPart || null,
        tags: parseTagList(tagParts.join(',')),
      })

      return items
    }, [])
}

interface ProjectMediaSource {
  title: string
  category: string
  mainImage?: string | null
  mainImageAlt?: string | null
  mainImageCaption?: string | null
  mainImageMobile?: string | null
  gallery?: string | null
  galleryMobile?: string | null
  projectTags?: string | null
  galleryAnnotations?: string | null
  galleryMobileAnnotations?: string | null
}

export function buildProjectMediaItems(
  project: ProjectMediaSource,
  options?: {
    isMobile?: boolean
    fallbackUrl?: string
  },
) {
  const isMobile = Boolean(options?.isMobile)
  const fallbackUrl = options?.fallbackUrl || ''
  const leadImage = ((isMobile ? project.mainImageMobile || project.mainImage : project.mainImage || project.mainImageMobile) || '').trim()
  const galleryValue = isMobile ? project.galleryMobile || project.gallery : project.gallery || project.galleryMobile
  const annotationValue = isMobile
    ? project.galleryMobileAnnotations || project.galleryAnnotations
    : project.galleryAnnotations || project.galleryMobileAnnotations
  const fallbackAnnotationValue = isMobile ? project.galleryAnnotations : null
  const urls = [leadImage, ...parseUrlList(galleryValue)]
    .map((item) => item.trim())
    .filter(Boolean)
  const resolvedUrls = Array.from(new Set(urls.length > 0 ? urls : fallbackUrl ? [fallbackUrl] : []))
  const annotationMap = new Map<string, ProjectMediaAnnotation>()

  for (const annotation of [
    ...parseProjectMediaAnnotations(fallbackAnnotationValue),
    ...parseProjectMediaAnnotations(annotationValue),
  ]) {
    annotationMap.set(annotation.url, annotation)
  }

  const projectTags = parseTagList(project.projectTags)
  const fallbackCategory = formatCategoryLabel(project.category)

  return resolvedUrls.map((url, index): ProjectMediaItem => {
    const annotation = annotationMap.get(url)
    const category = annotation?.category?.trim() || fallbackCategory
    const label =
      annotation?.label?.trim() ||
      (index === 0
        ? project.mainImageCaption?.trim() || category
        : `${project.title} ${index + 1}`)
    const tags = Array.from(
      new Set([normalizeTag(category), ...projectTags, ...(annotation?.tags || [])].filter(Boolean)),
    )

    return {
      url,
      category,
      label,
      tags,
      isLead: index === 0,
      alt: index === 0 ? project.mainImageAlt?.trim() || project.title : `${project.title} ${label}`,
    }
  })
}

export function isVideoUrl(value: string) {
  return /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(value)
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
