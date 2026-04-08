import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'
import { getSeoDescription, getSiteUrl } from '@/lib/seo'

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
    '## Main URLs',
    `- Home: ${siteUrl}/`,
    ...pages.map((page) => `- ${page.title}: ${siteUrl}/info/${page.slug}${page.excerpt ? ` - ${page.excerpt}` : ''}`),
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

