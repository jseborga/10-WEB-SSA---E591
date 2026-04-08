import { ContactPageClient } from '@/components/contact-page-client'
import { db } from '@/lib/db'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'

export const dynamic = 'force-dynamic'

export default async function ContactPage() {
  let publication = null
  let siteSettings = getDefaultSiteSettings()

  try {
    publication = await db.publication.findFirst({
      where: {
        slug: 'contacto',
        published: true,
      },
    })

    siteSettings = await ensureSiteSettings()
  } catch (error) {
    console.error('Error loading contact page:', error)
  }

  return <ContactPageClient publication={publication} siteSettings={siteSettings} />
}
