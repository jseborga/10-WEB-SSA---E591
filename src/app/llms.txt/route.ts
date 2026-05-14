import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildPublicationHref } from '@/lib/menu-config'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'
import { getProjectSeoImage, getSeoDescription, getSiteUrl } from '@/lib/seo'
import { parseLineList } from '@/lib/public-site'

export async function GET() {
  const siteSettings = await ensureSiteSettings().catch(() => getDefaultSiteSettings())
  const siteUrl = getSiteUrl(siteSettings)
  const pages = await db.publication.findMany({
    where: {
      published: true,
    },
    select: {
      title: true,
      slug: true,
      excerpt: true,
    },
    orderBy: [{ menuOrder: 'asc' }, { createdAt: 'asc' }],
  }).catch(() => [])
  const projects = await db.project.findMany({
    where: {
      published: true,
    },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      location: true,
      mainImage: true,
      mainImageMobile: true,
      gallery: true,
      galleryMobile: true,
      seoKeywords: true,
    },
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
  }).catch(() => [])
  const reservedRoutes = new Set(['/estudio', '/servicios', '/contacto', '/cotizacion'])
  const pageLines = pages
    .map((page) => ({
      href: buildPublicationHref(page.slug),
      line: `- ${page.title}: ${siteUrl}${buildPublicationHref(page.slug)}${page.excerpt ? ` - ${page.excerpt}` : ''}`,
    }))
    .filter((page) => !reservedRoutes.has(page.href))

  const lines = [
    `# ${siteSettings.companyName || 'SSA Ingenieria'}`,
    '',
    getSeoDescription(siteSettings),
    '',
    '## Services',
    ...parseLineList(siteSettings.projectCategories).map((item) => `- ${item}`),
    '',
    '## Main URLs',
    `- Home: ${siteUrl}/`,
    `- Projects: ${siteUrl}/proyectos`,
    `- Services: ${siteUrl}/servicios`,
    `- Studio: ${siteUrl}/estudio`,
    `- Contact: ${siteUrl}/contacto`,
    `- Quote: ${siteUrl}/cotizacion`,
    ...projects.map(
      (project) => {
        const shareImage = getProjectSeoImage(project, siteSettings)
        return `- Proyecto ${project.title}: ${siteUrl}/proyectos/${project.id}${project.description ? ` - ${project.description}` : ''}${project.category ? ` [${project.category}]` : ''}${project.location ? ` (${project.location})` : ''}${shareImage ? ` | Imagen: ${shareImage}` : ''}${project.seoKeywords ? ` | Keywords: ${project.seoKeywords}` : ''}`
      },
    ),
    ...pageLines.map((page) => page.line),
    '',
    '## Contact',
    siteSettings.email ? `- Email: ${siteSettings.email}` : '',
    siteSettings.phone ? `- Phone: ${siteSettings.phone}` : '',
    siteSettings.addressLine ? `- Address: ${[siteSettings.addressLine, siteSettings.city, siteSettings.country].filter(Boolean).join(', ')}` : '',
  ].filter(Boolean)

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
