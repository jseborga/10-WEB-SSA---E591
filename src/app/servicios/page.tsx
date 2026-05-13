import type { Metadata } from 'next'
import { ServicesPageClient } from '@/components/services-page-client'
import { db } from '@/lib/db'
import { PublicPublication, PublicSiteSettings } from '@/lib/public-site'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'
import { getSeoImage, getSiteUrl, toAbsoluteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'
const SERVICES_SLUGS = ['servicios', 'services', 'servicos']

export async function generateMetadata(): Promise<Metadata> {
  const [publication, siteSettings] = await Promise.all([
    db.publication.findFirst({
      where: {
        slug: { in: SERVICES_SLUGS },
        published: true,
      },
    }),
    ensureSiteSettings().catch(() => getDefaultSiteSettings()),
  ])

  const title = publication?.seoTitle?.trim() || `Servicios | ${siteSettings.companyName || 'SSA Ingenieria'}`
  const description =
    publication?.seoDescription?.trim() ||
    publication?.excerpt ||
    `Servicios de construccion, consultoria, arquitectura, ingenierias, supervision y fiscalizacion de ${siteSettings.companyName || 'SSA Ingenieria'}`
  const shareImage = toAbsoluteUrl(publication?.image, siteSettings) || getSeoImage(siteSettings)
  const keywords = (publication?.seoKeywords || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: `${getSiteUrl(siteSettings)}/servicios`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${getSiteUrl(siteSettings)}/servicios`,
      images: shareImage ? [{ url: shareImage, alt: title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: shareImage ? [shareImage] : undefined,
    },
  }
}

export default async function ServicesPage() {
  let publication: PublicPublication | null = null
  let siteSettings: PublicSiteSettings = getDefaultSiteSettings()

  try {
    publication = await db.publication.findFirst({
      where: {
        slug: { in: SERVICES_SLUGS },
        published: true,
      },
    })

    siteSettings = await ensureSiteSettings()
  } catch (error) {
    console.error('Error loading services page:', error)
  }

  return <ServicesPageClient publication={publication} siteSettings={siteSettings} />
}
