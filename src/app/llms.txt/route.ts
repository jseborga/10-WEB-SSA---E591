import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'
import { getSeoDescription, getSiteUrl } from '@/lib/seo'
import { parseLineList } from '@/lib/public-site'

function getPublicationPath(slug: string) {
  const normalized = slug
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

  if (normalized === 'contacto') {
    return '/contacto'
  }

  if (normalized === 'estudio') {
    return '/estudio'
  }

  return `/info/${normalized}`
}

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
    `- Studio: ${siteUrl}/estudio`,
    `- Contact: ${siteUrl}/contacto`,
    ...pages.map((page) => `- ${page.title}: ${siteUrl}${getPublicationPath(page.slug)}${page.excerpt ? ` - ${page.excerpt}` : ''}`),
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
