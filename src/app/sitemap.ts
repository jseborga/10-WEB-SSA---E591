import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'
import { getSiteUrl } from '@/lib/seo'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteSettings = await ensureSiteSettings().catch(() => getDefaultSiteSettings())
  const siteUrl = getSiteUrl(siteSettings)

  const pages = await db.publication.findMany({
    where: {
      published: true,
    },
    select: {
      slug: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  }).catch(() => [])

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...pages.map((page) => ({
      url: `${siteUrl}/info/${page.slug}`,
      lastModified: page.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}

