import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'

export async function GET() {
  try {
    const settings = await ensureSiteSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error loading site settings:', error)
    return NextResponse.json(getDefaultSiteSettings())
  }
}

export async function PUT(request: Request) {
  try {
    const unauthorized = requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const body = await request.json()
    const currentSettings = await ensureSiteSettings()

    const settings = await db.siteSettings.update({
      where: { id: currentSettings.id },
      data: {
        companyName: body.companyName ?? currentSettings.companyName,
        legalName: body.legalName ?? currentSettings.legalName,
        tagline: body.tagline ?? currentSettings.tagline,
        email: body.email ?? currentSettings.email,
        phone: body.phone ?? currentSettings.phone,
        whatsapp: body.whatsapp ?? currentSettings.whatsapp,
        addressLine: body.addressLine ?? currentSettings.addressLine,
        city: body.city ?? currentSettings.city,
        country: body.country ?? currentSettings.country,
        footerText: body.footerText ?? currentSettings.footerText,
        instagramUrl: body.instagramUrl ?? currentSettings.instagramUrl,
        facebookUrl: body.facebookUrl ?? currentSettings.facebookUrl,
        linkedinUrl: body.linkedinUrl ?? currentSettings.linkedinUrl,
        youtubeUrl: body.youtubeUrl ?? currentSettings.youtubeUrl,
        tiktokUrl: body.tiktokUrl ?? currentSettings.tiktokUrl,
      },
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error updating site settings:', error)
    return NextResponse.json({ error: 'Error al actualizar la configuracion del sitio' }, { status: 500 })
  }
}
