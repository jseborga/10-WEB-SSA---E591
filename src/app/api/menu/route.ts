import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseMenuConfig } from '@/lib/menu-config'
import { ensureSiteSettings } from '@/lib/site-settings'

export async function GET() {
  try {
    const [siteSettings, pages] = await Promise.all([
      ensureSiteSettings(),
      db.publication.findMany({
        where: { published: true, showInMenu: true },
        orderBy: [{ menuOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          title: true,
          slug: true,
          menuOrder: true,
        },
      }),
    ])

    const menu = parseMenuConfig(siteSettings.menuConfig, pages)
    return NextResponse.json(menu)
  } catch (error) {
    console.error('Error loading menu config:', error)
    return NextResponse.json([], { status: 200 })
  }
}
