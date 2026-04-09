import type { Metadata } from 'next'
import { StudioPageClient } from '@/components/studio-page-client'
import { db } from '@/lib/db'
import { PublicPublication, PublicSiteSettings } from '@/lib/public-site'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'
import { getSeoImage, getSiteUrl, toAbsoluteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const [publication, siteSettings] = await Promise.all([
    db.publication.findFirst({
      where: {
        slug: 'estudio',
        published: true,
      },
    }),
    ensureSiteSettings().catch(() => getDefaultSiteSettings()),
  ])

  const title = publication?.seoTitle?.trim() || `Estudio | ${siteSettings.companyName || 'SSA Ingenieria'}`
  const description = publication?.seoDescription?.trim() || publication?.excerpt || `Estudio y enfoque de ${siteSettings.companyName || 'SSA Ingenieria'}`
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
      canonical: `${getSiteUrl(siteSettings)}/estudio`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${getSiteUrl(siteSettings)}/estudio`,
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

export default async function StudioPage() {
  let publication: PublicPublication | null = null
  let siteSettings: PublicSiteSettings = getDefaultSiteSettings()

  try {
    publication = await db.publication.findFirst({
      where: {
        slug: 'estudio',
        published: true,
      },
    })

    siteSettings = await ensureSiteSettings()
  } catch (error) {
    console.error('Error loading studio page:', error)
  }

  return <StudioPageClient publication={publication} siteSettings={siteSettings} />
}
