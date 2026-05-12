import HomePageClient from '@/components/home-page-client'
import { db } from '@/lib/db'
import { getHeroAiMessages } from '@/lib/hero-messages'
import { PublicProject, PublicSiteSettings } from '@/lib/public-site'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'
import { getSeoDescription, getSiteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  let projects: PublicProject[] = []
  let siteSettings: PublicSiteSettings = getDefaultSiteSettings()
  let aiHeroMessages: string[] = []

  try {
    projects = await db.project.findMany({
      where: { published: true },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    })

    siteSettings = await ensureSiteSettings()
    aiHeroMessages = await getHeroAiMessages(siteSettings, projects)
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
      <HomePageClient initialProjects={projects} siteSettings={siteSettings} aiHeroMessages={aiHeroMessages} />
    </>
  )
}
