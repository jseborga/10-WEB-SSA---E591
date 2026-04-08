import HomePageClient from '@/components/home-page-client'
import { db } from '@/lib/db'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'
import { getSeoDescription, getSiteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  let projects = []
  let siteSettings = getDefaultSiteSettings()

  try {
    projects = await db.project.findMany({
      where: { published: true },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    })

    siteSettings = await ensureSiteSettings()
  } catch (error) {
    console.error('Error loading homepage data:', error)
  }

  const homeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: siteSettings.companyName,
    url: getSiteUrl(siteSettings),
    description: getSeoDescription(siteSettings),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeJsonLd),
        }}
      />
      <HomePageClient initialProjects={projects} siteSettings={siteSettings} />
    </>
  )
}
