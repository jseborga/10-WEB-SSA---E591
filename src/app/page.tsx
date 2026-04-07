import HomePageClient from '@/components/home-page-client'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  let projects = []

  try {
    projects = await db.project.findMany({
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    })
  } catch (error) {
    console.error('Error loading homepage projects:', error)
  }

  return <HomePageClient initialProjects={projects} />
}
