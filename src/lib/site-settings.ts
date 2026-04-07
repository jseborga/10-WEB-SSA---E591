import { db } from '@/lib/db'

export function getDefaultSiteSettings() {
  return {
    companyName: 'SSA Ingenieria',
    legalName: 'SSA Ingenieria SRL',
    tagline: 'Construyendo el futuro',
    logoUrl: '',
    faviconUrl: '',
    heroImages: '',
    heroImageOpacity: 34,
    heroImageSaturation: 90,
    heroImageBrightness: 100,
    heroImageContrast: 105,
    heroImageFit: 'cover',
    heroImageTreatment: 'editorial',
    heroShowCompanyName: false,
    heroTextTone: 'dark',
    email: 'admin@ingenieria.com.bo',
    phone: '+591 2241146',
    whatsapp: '+591 76205333',
    addressLine: 'Calle Lucas Jaimes # 76, Miraflores',
    city: 'La Paz',
    country: 'Bolivia',
    footerText: 'Construccion, diseno, supervision, asesoria tecnica y soluciones digitales para proyectos.',
    instagramUrl: '',
    facebookUrl: '',
    linkedinUrl: '',
    youtubeUrl: '',
    tiktokUrl: '',
  }
}

export async function ensureSiteSettings() {
  let settings = await db.siteSettings.findFirst({
    orderBy: { createdAt: 'asc' },
  })

  if (!settings) {
    settings = await db.siteSettings.create({
      data: getDefaultSiteSettings(),
    })
  }

  return settings
}
