import { StudioPageClient } from '@/components/studio-page-client'
import { db } from '@/lib/db'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'

export const dynamic = 'force-dynamic'

export default async function StudioPage() {
  let publication = null
  let siteSettings = getDefaultSiteSettings()

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
