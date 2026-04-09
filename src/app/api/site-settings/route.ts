import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10)

  if (Number.isNaN(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

function normalizeChoice(value: unknown, fallback: string, options: string[]) {
  const parsed = String(value ?? fallback)
  return options.includes(parsed) ? parsed : fallback
}

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
    const unauthorized = await requireAdmin(request)

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
        siteUrl: body.siteUrl ?? currentSettings.siteUrl,
        seoTitle: body.seoTitle ?? currentSettings.seoTitle,
        seoDescription: body.seoDescription ?? currentSettings.seoDescription,
        seoKeywords: body.seoKeywords ?? currentSettings.seoKeywords,
        logoUrl: body.logoUrl ?? currentSettings.logoUrl,
        faviconUrl: body.faviconUrl ?? currentSettings.faviconUrl,
        socialShareImageUrl: body.socialShareImageUrl ?? currentSettings.socialShareImageUrl,
        heroImages: body.heroImages ?? currentSettings.heroImages,
        heroImagesMobile: body.heroImagesMobile ?? currentSettings.heroImagesMobile,
        heroImageOpacity: clampInteger(body.heroImageOpacity, currentSettings.heroImageOpacity, 5, 70),
        heroImageSaturation: clampInteger(body.heroImageSaturation, currentSettings.heroImageSaturation, 0, 160),
        heroImageBrightness: clampInteger(body.heroImageBrightness, currentSettings.heroImageBrightness, 70, 150),
        heroImageContrast: clampInteger(body.heroImageContrast, currentSettings.heroImageContrast, 80, 160),
        heroImageFit: normalizeChoice(body.heroImageFit, currentSettings.heroImageFit, ['cover', 'contain']),
        heroImageTreatment: normalizeChoice(body.heroImageTreatment, currentSettings.heroImageTreatment, ['editorial', 'original', 'enhanced', 'monochrome']),
        heroShowCompanyName: Boolean(body.heroShowCompanyName),
        heroTextTone: normalizeChoice(body.heroTextTone, currentSettings.heroTextTone, ['dark', 'light']),
        projectCategories: body.projectCategories ?? currentSettings.projectCategories,
        menuConfig: body.menuConfig ?? currentSettings.menuConfig,
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
