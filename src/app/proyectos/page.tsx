import { ProjectsPageClient } from '@/components/projects-page-client'
import { db } from '@/lib/db'
import { PublicProject, PublicSiteSettings } from '@/lib/public-site'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  let projects: PublicProject[] = []
  let siteSettings: PublicSiteSettings = getDefaultSiteSettings()

  try {
    projects = await db.project.findMany({
      where: { published: true },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    })

    siteSettings = await ensureSiteSettings()
  } catch (error) {
    console.error('Error loading projects page:', error)
  }

  return <ProjectsPageClient projects={projects} siteSettings={siteSettings} />
}
