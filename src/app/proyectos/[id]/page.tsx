import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { ProjectPageClient } from '@/components/project-page-client'
import { formatCategoryLabel } from '@/lib/public-site'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'
import { getProjectSeoImage, getProjectSeoImages, getSiteUrl } from '@/lib/seo'

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

  const companyName = siteSettings.companyName || 'SSA Ingenieria'
  const title = project.seoTitle?.trim() || `${project.title} | ${companyName}`
  const description = project.seoDescription?.trim() || project.description || project.title
  const keywords = (project.seoKeywords || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const siteUrl = getSiteUrl(siteSettings)
  const pageUrl = `${siteUrl}/proyectos/${project.id}`
  const shareImage = getProjectSeoImage(project, siteSettings)
  const shareImages = getProjectSeoImages(project, siteSettings)
  const categoryLabel = formatCategoryLabel(project.category)

  return {
    title,
    description,
    keywords,
    authors: [{ name: companyName }],
    creator: companyName,
    publisher: companyName,
    category: categoryLabel,
    alternates: {
      canonical: pageUrl,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: companyName,
      locale: 'es_BO',
      url: pageUrl,
      section: categoryLabel,
      publishedTime: project.createdAt.toISOString(),
      modifiedTime: project.updatedAt.toISOString(),
      images: shareImages.length > 0 ? shareImages.map((url) => ({ url, alt: project.mainImageAlt || project.title })) : undefined,
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

  const siteUrl = getSiteUrl(siteSettings)
  const companyName = siteSettings.companyName || 'SSA Ingenieria'
  const pageUrl = `${siteUrl}/proyectos/${project.id}`
  const categoryLabel = formatCategoryLabel(project.category)
  const shareImage = getProjectSeoImage(project, siteSettings)
  const shareImages = getProjectSeoImages(project, siteSettings)
  const projectJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.title,
    headline: project.seoTitle || project.title,
    description: project.seoDescription || project.description || project.title,
    image: shareImages,
    thumbnailUrl: shareImage,
    keywords: project.seoKeywords || undefined,
    genre: categoryLabel,
    category: project.category,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    dateCreated: project.createdAt.toISOString(),
    dateModified: project.updatedAt.toISOString(),
    inLanguage: ['es', 'en', 'pt'],
    contentLocation: project.location
      ? {
          '@type': 'Place',
          name: project.location,
        }
      : undefined,
    isPartOf: {
      '@type': 'CollectionPage',
      name: `Proyectos de ${companyName}`,
      url: `${siteUrl}/proyectos`,
    },
    author: {
      '@type': 'Organization',
      name: companyName,
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: companyName,
      url: siteUrl,
    },
    provider: {
      '@type': 'Organization',
      name: companyName,
      url: siteUrl,
    },
  }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Inicio',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Proyectos',
        item: `${siteUrl}/proyectos`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: project.title,
        item: pageUrl,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ProjectPageClient project={project} similarProjects={similarProjects} siteSettings={siteSettings} />
    </>
  )
}
