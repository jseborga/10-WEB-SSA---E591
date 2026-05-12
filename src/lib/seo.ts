import { isVideoUrl, parseUrlList } from '@/lib/public-site'

type SeoSiteSettings = {
  companyName?: string | null
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
  legalName?: string | null
  email?: string | null
  phone?: string | null
  addressLine?: string | null
  city?: string | null
  country?: string | null
  instagramUrl?: string | null
  facebookUrl?: string | null
  linkedinUrl?: string | null
  youtubeUrl?: string | null
  tiktokUrl?: string | null
}

type SeoProjectSource = {
  mainImage?: string | null
  mainImageMobile?: string | null
  gallery?: string | null
  galleryMobile?: string | null
}

const FALLBACK_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.SITE_URL?.trim() ||
  'http://localhost:3000'

export function getSiteUrl(siteSettings?: SeoSiteSettings | null) {
  const raw = siteSettings?.siteUrl?.trim() || FALLBACK_SITE_URL
  const normalized = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`
  return normalized.replace(/\/+$/, '')
}

export function toAbsoluteUrl(value: string | null | undefined, siteSettings?: SeoSiteSettings | null) {
  const raw = value?.trim()

  if (!raw) {
    return undefined
  }

  try {
    return new URL(raw, `${getSiteUrl(siteSettings)}/`).toString()
  } catch {
    return undefined
  }
}

export function getSeoTitle(siteSettings?: SeoSiteSettings | null) {
  const companyName = siteSettings?.companyName?.trim() || 'SSA Ingenieria'
  const customTitle = siteSettings?.seoTitle?.trim()

  if (customTitle) {
    return customTitle
  }

  return siteSettings?.tagline?.trim()
    ? `${companyName} | ${siteSettings.tagline.trim()}`
    : companyName
}

export function getSeoDescription(siteSettings?: SeoSiteSettings | null) {
  return (
    siteSettings?.seoDescription?.trim() ||
    siteSettings?.tagline?.trim() ||
    'SSA Ingenieria desarrolla proyectos de construccion, supervision, diseno, asesoria tecnica especializada y soluciones digitales para el sector.'
  )
}

export function getSeoKeywords(siteSettings?: SeoSiteSettings | null) {
  return (siteSettings?.seoKeywords || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function getFirstShareableImage(candidates: Array<string | null | undefined>, siteSettings?: SeoSiteSettings | null) {
  for (const candidate of candidates) {
    const absoluteUrl = toAbsoluteUrl(candidate, siteSettings)

    if (absoluteUrl && !isVideoUrl(absoluteUrl)) {
      return absoluteUrl
    }
  }

  return undefined
}

export function getSeoImage(siteSettings?: SeoSiteSettings | null) {
  const heroImages = [
    ...parseUrlList(siteSettings?.heroImages),
    ...parseUrlList(siteSettings?.heroImagesMobile),
  ]

  return (
    getFirstShareableImage([siteSettings?.socialShareImageUrl], siteSettings) ||
    getFirstShareableImage(heroImages, siteSettings) ||
    toAbsoluteUrl(siteSettings?.logoUrl, siteSettings) ||
    toAbsoluteUrl(siteSettings?.faviconUrl, siteSettings) ||
    toAbsoluteUrl('/logo.svg', siteSettings)
  )
}

export function getProjectSeoImage(project?: SeoProjectSource | null, siteSettings?: SeoSiteSettings | null) {
  return getProjectSeoImages(project, siteSettings)[0] || getSeoImage(siteSettings)
}

export function getProjectSeoImages(project?: SeoProjectSource | null, siteSettings?: SeoSiteSettings | null) {
  if (!project) {
    const fallback = getSeoImage(siteSettings)
    return fallback ? [fallback] : []
  }

  const projectGallery = [
    ...parseUrlList(project.gallery),
    ...parseUrlList(project.galleryMobile),
  ]

  const images = Array.from(
    new Set(
      [project.mainImage, project.mainImageMobile, ...projectGallery]
        .map((item) => toAbsoluteUrl(item, siteSettings))
        .filter((item): item is string => Boolean(item && !isVideoUrl(item))),
    ),
  )

  if (images.length > 0) {
    return images
  }

  const fallback = getSeoImage(siteSettings)
  return fallback ? [fallback] : []
}

export function getOrganizationJsonLd(siteSettings?: SeoSiteSettings | null) {
  const companyName = siteSettings?.companyName?.trim() || 'SSA Ingenieria'
  const legalName = siteSettings?.legalName?.trim() || companyName
  const address = [siteSettings?.addressLine, siteSettings?.city, siteSettings?.country]
    .map((item) => item?.trim())
    .filter(Boolean)
    .join(', ')
  const sameAs = [
    siteSettings?.instagramUrl,
    siteSettings?.facebookUrl,
    siteSettings?.linkedinUrl,
    siteSettings?.youtubeUrl,
    siteSettings?.tiktokUrl,
  ]
    .map((item) => item?.trim())
    .filter(Boolean)

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: companyName,
    legalName,
    url: getSiteUrl(siteSettings),
    logo: getSeoImage(siteSettings),
    description: getSeoDescription(siteSettings),
    email: siteSettings?.email?.trim() || undefined,
    telephone: siteSettings?.phone?.trim() || undefined,
    address: address || undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  }
}

export function getWebsiteJsonLd(siteSettings?: SeoSiteSettings | null) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteSettings?.companyName?.trim() || 'SSA Ingenieria',
    url: getSiteUrl(siteSettings),
    description: getSeoDescription(siteSettings),
    inLanguage: ['es', 'en', 'pt'],
  }
}
