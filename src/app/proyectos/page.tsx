import type { Metadata } from 'next'
import { ProjectsPageClient } from '@/components/projects-page-client'
import { db } from '@/lib/db'
import { PublicProject, PublicSiteSettings, formatCategoryLabel } from '@/lib/public-site'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'
import { getSeoDescription, getSeoImage, getSeoKeywords, getSiteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await ensureSiteSettings().catch(() => getDefaultSiteSettings())
  const siteUrl = getSiteUrl(siteSettings)
  const title = `Proyectos | ${siteSettings.companyName || 'SSA Ingenieria'}`
  const description = siteSettings.seoDescription?.trim() || getSeoDescription(siteSettings)
  const shareImage = getSeoImage(siteSettings)
  const keywords = getSeoKeywords(siteSettings)

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: `${siteUrl}/proyectos`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${siteUrl}/proyectos`,
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

  const description = siteSettings.seoDescription?.trim() || getSeoDescription(siteSettings)
  const shareImage = getSeoImage(siteSettings)
  const projectsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Proyectos de ${siteSettings.companyName || 'SSA Ingenieria'}`,
    itemListElement: projects.map((project, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${getSiteUrl(siteSettings)}/proyectos/${project.id}`,
      name: project.title,
      description: project.seoDescription || project.description || undefined,
    })),
  }
  const projectsCollectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Proyectos de ${siteSettings.companyName || 'SSA Ingenieria'}`,
    description,
    url: `${getSiteUrl(siteSettings)}/proyectos`,
    image: shareImage,
    inLanguage: ['es', 'en', 'pt'],
    about: Array.from(new Set(projects.map((project) => project.category).filter(Boolean))).map((category) => ({
      '@type': 'Thing',
      name: formatCategoryLabel(category),
    })),
    mainEntity: projectsJsonLd,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectsCollectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectsJsonLd) }}
      />
      <ProjectsPageClient projects={projects} siteSettings={siteSettings} />
    </>
  )
}
