import { StudioPageClient } from '@/components/studio-page-client'
import { db } from '@/lib/db'
import { PublicPublication, PublicSiteSettings } from '@/lib/public-site'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'

export const dynamic = 'force-dynamic'

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
