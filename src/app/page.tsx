import HomePageClient from '@/components/home-page-client'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  let projects = []
  let menuPages = []

  try {
    projects = await db.project.findMany({
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    })

    menuPages = await db.publication.findMany({
      where: {
        published: true,
        showInMenu: true,
      },
      orderBy: [{ menuOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        slug: true,
      },
    })
  } catch (error) {
    console.error('Error loading homepage data:', error)
  }

  return <HomePageClient initialProjects={projects} menuPages={menuPages} />
}
