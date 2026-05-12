import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { ProjectPageClient } from '@/components/project-page-client'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'
import { getProjectSeoImage, getSiteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const [project, siteSettings] = await Promise.all([
    db.project.findFirst({
      where: {
        id,
        published: true,
      },
    }),
    ensureSiteSettings().catch(() => getDefaultSiteSettings()),
  ])

  if (!project) {
    return {
      title: 'Proyecto no encontrado',
    }
  }

  const title = project.seoTitle?.trim() || `${project.title} | ${siteSettings.companyName || 'SSA Ingenieria'}`
  const description = project.seoDescription?.trim() || project.description || project.title
  const keywords = (project.seoKeywords || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const pageUrl = `${getSiteUrl(siteSettings)}/proyectos/${project.id}`
  const shareImage = getProjectSeoImage(project, siteSettings)

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url: pageUrl,
      images: shareImage ? [{ url: shareImage, alt: project.mainImageAlt || project.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: shareImage ? [shareImage] : undefined,
    },
  }
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [project, siteSettings] = await Promise.all([
    db.project.findFirst({
      where: {
        id,
        published: true,
      },
    }),
    ensureSiteSettings().catch(() => getDefaultSiteSettings()),
  ])

  if (!project) {
    notFound()
  }

  const similarProjects = await db.project.findMany({
    where: {
      published: true,
      category: project.category,
      id: { not: project.id },
    },
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    take: 3,
  })

  const shareImage = getProjectSeoImage(project, siteSettings)
  const projectJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.title,
    description: project.seoDescription || project.description || project.title,
    image: shareImage,
    keywords: project.seoKeywords || undefined,
    category: project.category,
    url: `${getSiteUrl(siteSettings)}/proyectos/${project.id}`,
    provider: {
      '@type': 'Organization',
      name: siteSettings.companyName || 'SSA Ingenieria',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectJsonLd) }}
      />
      <ProjectPageClient project={project} similarProjects={similarProjects} siteSettings={siteSettings} />
    </>
  )
}
