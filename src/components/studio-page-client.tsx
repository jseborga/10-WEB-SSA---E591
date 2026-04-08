'use client'

import Image from 'next/image'
import { useLanguage } from '@/lib/language-context'
import { PublicPublication, PublicSiteSettings, getLocalizedPublicationValue } from '@/lib/public-site'
import { SiteHeader } from '@/components/site-header'

interface StudioPageClientProps {
  siteSettings?: PublicSiteSettings
  publication?: PublicPublication | null
}

function splitParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

export function StudioPageClient({ siteSettings, publication }: StudioPageClientProps) {
  const { t, language } = useLanguage()
  const title = getLocalizedPublicationValue(publication, language, 'title') || t.nav.studio
  const excerpt = getLocalizedPublicationValue(publication, language, 'excerpt')
  const body = getLocalizedPublicationValue(publication, language, 'content')
  const fallbackParagraphs =
    language === 'es'
      ? [
          'Somos una firma de ingenieria y construccion dedicada a desarrollar proyectos con rigor tecnico, sensibilidad espacial y una ejecucion clara.',
          'Integramos supervision, diseno, asesoria tecnica especializada y soluciones digitales para mejorar cada etapa del proyecto.',
          'Trabajamos con una mirada sobria: menos ruido visual, mejores decisiones y sistemas que realmente ayudan a construir mejor.',
        ]
      : [
          t.studio.description,
          t.studio.philosophyText,
          t.studio.approachText,
        ]
  const paragraphs = splitParagraphs(body).length > 0 ? splitParagraphs(body) : fallbackParagraphs
  const locationParts = [siteSettings?.addressLine, siteSettings?.city, siteSettings?.country].filter(Boolean)

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <SiteHeader tone="dark" logoUrl={siteSettings?.logoUrl} companyName={siteSettings?.companyName} />

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t.nav.studio}</p>
            <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">{title}</h1>
            {excerpt ? <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600">{excerpt}</p> : null}

            <div className="mt-10 space-y-6">
              {paragraphs.map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 16)}`} className="text-base leading-8 text-zinc-700">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="overflow-hidden rounded-[32px] bg-zinc-100">
              {publication?.image ? (
                <div className="relative aspect-[4/5]">
                  <Image
                    src={publication.image}
                    alt={title}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex aspect-[4/5] items-end bg-zinc-900 px-8 py-10">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/50">{siteSettings?.companyName || 'SSA Ingenieria'}</p>
                    <p className="mt-4 text-2xl font-light leading-tight text-white">
                      {siteSettings?.tagline || 'Construyendo el futuro'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-zinc-200 p-6">
              <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Oficina</p>
              <div className="mt-4 space-y-2 text-sm leading-7 text-zinc-600">
                {siteSettings?.legalName ? <p>{siteSettings.legalName}</p> : null}
                {locationParts.length > 0 ? <p>{locationParts.join(', ')}</p> : null}
                {siteSettings?.email ? <p>{siteSettings.email}</p> : null}
                {siteSettings?.phone ? <p>{siteSettings.phone}</p> : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
