import type { Metadata } from 'next'
import { QuotePageClient } from '@/components/quote-page-client'
import { db } from '@/lib/db'
import { PublicPublication, PublicSiteSettings } from '@/lib/public-site'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'
import { getSeoImage, getSiteUrl, toAbsoluteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const [publication, siteSettings] = await Promise.all([
    db.publication.findFirst({
      where: {
        slug: 'cotizacion',
        published: true,
      },
    }),
    ensureSiteSettings().catch(() => getDefaultSiteSettings()),
  ])

  const title = publication?.seoTitle?.trim() || `Cotizacion de proyectos | ${siteSettings.companyName || 'SSA Ingenieria'}`
  const description =
    publication?.seoDescription?.trim() ||
    publication?.excerpt ||
    `Solicita una cotizacion para tu proyecto con ${siteSettings.companyName || 'SSA Ingenieria'}`
  const shareImage = toAbsoluteUrl(publication?.image, siteSettings) || getSeoImage(siteSettings)
  const keywords = (publication?.seoKeywords || 'cotizacion, proyectos, construccion, ingenieria, arquitectura')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: `${getSiteUrl(siteSettings)}/cotizacion`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${getSiteUrl(siteSettings)}/cotizacion`,
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

export default async function QuotePage() {
  let publication: PublicPublication | null = null
  let siteSettings: PublicSiteSettings = getDefaultSiteSettings()

  try {
    publication = await db.publication.findFirst({
      where: {
        slug: 'cotizacion',
        published: true,
      },
    })

    siteSettings = await ensureSiteSettings()
  } catch (error) {
    console.error('Error loading quote page:', error)
  }

  return <QuotePageClient publication={publication} siteSettings={siteSettings} />
}
