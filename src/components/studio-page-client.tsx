'use client'

import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { findEditorialSection, parseEditorialItems, parseEditorialSections, splitParagraphs } from '@/lib/editorial-sections'
import { PublicPublication, PublicSiteSettings, getLocalizedPublicationValue } from '@/lib/public-site'
import { SiteHeader } from '@/components/site-header'

interface StudioPageClientProps {
  siteSettings?: PublicSiteSettings
  publication?: PublicPublication | null
}

function getFallbackHistory(language: string) {
  if (language === 'en') {
    return [
      'We operate as an engineering and construction practice focused on technical rigor, spatial clarity, and disciplined execution.',
      'Our work combines design, site coordination, supervision, and specialized consulting so each project can move with better decisions and cleaner control.',
      'We collaborate with professionals and partners according to the scale, specialty, and demands of each commission.',
    ]
  }

  if (language === 'pt') {
    return [
      'Atuamos como uma pratica de engenharia e construcao com foco em rigor tecnico, clareza espacial e execucao disciplinada.',
      'Nosso trabalho integra projeto, coordenacao de obra, supervisao e consultoria especializada para que cada projeto avance com melhor controle.',
      'Trabalhamos com equipe tecnica e parceiros conforme a escala, especialidade e exigencia de cada encargo.',
    ]
  }

  return [
    'Operamos como una practica de ingenieria y construccion enfocada en rigor tecnico, claridad espacial y ejecucion disciplinada.',
    'Nuestro trabajo integra proyecto, coordinacion de obra, supervision y consultoria especializada para que cada proyecto avance con mejor control.',
    'Trabajamos con equipo tecnico y partners segun la escala, especialidad y exigencia de cada encargo.',
  ]
}

function getFallbackTeam(language: string) {
  if (language === 'en') {
    return [
      { title: 'Architecture and design', description: 'Concept, layout definition, spatial criteria, and technical documentation.' },
      { title: 'Engineering disciplines', description: 'Technical support across structures, systems, and coordinated specialties.' },
      { title: 'Construction management', description: 'Planning, field coordination, quality review, and execution follow-up.' },
      { title: 'Supervision and inspection', description: 'Independent control, site review, compliance, and decision support.' },
    ]
  }

  if (language === 'pt') {
    return [
      { title: 'Arquitetura e design', description: 'Conceito, definicao espacial, criterios de projeto e documentacao tecnica.' },
      { title: 'Engenharias', description: 'Suporte tecnico em estruturas, sistemas e especialidades coordenadas.' },
      { title: 'Gestao de construcao', description: 'Planejamento, coordenacao de campo, revisao de qualidade e acompanhamento.' },
      { title: 'Supervisao e fiscalizacao', description: 'Controle independente, revisao de obra, conformidade e suporte a decisoes.' },
    ]
  }

  return [
    { title: 'Arquitectura y diseno', description: 'Concepto, definicion espacial, criterios de proyecto y documentacion tecnica.' },
    { title: 'Ingenierias', description: 'Soporte tecnico en estructuras, sistemas y especialidades coordinadas.' },
    { title: 'Gestion de construccion', description: 'Planificacion, coordinacion de campo, revision de calidad y seguimiento.' },
    { title: 'Supervision y fiscalizacion', description: 'Control independiente, revision de obra, cumplimiento y soporte a decisiones.' },
  ]
}

function getPartnersIntro(language: string) {
  if (language === 'en') {
    return 'We activate external collaborators according to specialty, scope, and project stage.'
  }

  if (language === 'pt') {
    return 'Ativamos colaboradores externos conforme a especialidade, o alcance e a etapa do projeto.'
  }

  return 'Activamos colaboradores externos segun la especialidad, el alcance y la etapa del proyecto.'
}

export function StudioPageClient({ siteSettings, publication }: StudioPageClientProps) {
  const { t, language } = useLanguage()
  const title = getLocalizedPublicationValue(publication, language, 'title') || t.nav.studio
  const excerpt = getLocalizedPublicationValue(publication, language, 'excerpt')
  const body = getLocalizedPublicationValue(publication, language, 'content')
  const sections = parseEditorialSections(body)
  const introSection = findEditorialSection(sections, ['introduccion', 'intro', 'presentacion'])
  const historySection = findEditorialSection(sections, ['historia', 'trayectoria', 'history'])
  const teamSection = findEditorialSection(sections, ['equipo tecnico', 'equipo', 'profesionales', 'technical team'])
  const partnersSection = findEditorialSection(sections, ['partners', 'partner', 'aliados', 'alianzas'])
  const fallbackHistory = getFallbackHistory(language)
  const fallbackTeam = getFallbackTeam(language)
  const storyParagraphs =
    splitParagraphs(historySection?.body).length > 0
      ? splitParagraphs(historySection?.body)
      : splitParagraphs(introSection?.body).length > 0
        ? splitParagraphs(introSection?.body)
        : splitParagraphs(body).length > 0
          ? splitParagraphs(body)
          : fallbackHistory
  const teamItems = parseEditorialItems(teamSection?.body)
  const partnerItems = parseEditorialItems(partnersSection?.body).filter((item) => item.href)
  const locationParts = [siteSettings?.addressLine, siteSettings?.city, siteSettings?.country].filter(Boolean)

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <SiteHeader tone="dark" siteSettings={siteSettings} />

      <section className="mx-auto max-w-6xl px-4 pb-12 pt-28 sm:px-6 sm:pt-32">
        <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t.nav.studio}</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-light tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600">
              {excerpt || storyParagraphs[0] || siteSettings?.tagline || 'SSA Ingenieria'}
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Empresa</p>
                <div className="mt-3 space-y-2 text-sm leading-7 text-zinc-600">
                  {siteSettings?.companyName ? <p>{siteSettings.companyName}</p> : null}
                  {siteSettings?.legalName ? <p>{siteSettings.legalName}</p> : null}
                  {locationParts.length > 0 ? <p>{locationParts.join(', ')}</p> : null}
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Cobertura</p>
                <div className="mt-3 space-y-2 text-sm leading-7 text-zinc-600">
                  {siteSettings?.email ? <p>{siteSettings.email}</p> : null}
                  {siteSettings?.phone ? <p>{siteSettings.phone}</p> : null}
                  {siteSettings?.whatsapp ? <p>WhatsApp {siteSettings.whatsapp}</p> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="overflow-hidden rounded-[28px] bg-zinc-100">
              {publication?.image ? (
                <div className="relative aspect-[5/4]">
                  <Image src={publication.image} alt={title} fill className="object-cover" />
                </div>
              ) : (
                <div className="flex aspect-[5/4] items-end bg-zinc-950 px-8 py-8">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/50">{siteSettings?.companyName || 'SSA Ingenieria'}</p>
                    <p className="mt-4 max-w-sm text-2xl font-light leading-tight text-white">
                      {siteSettings?.tagline || 'Construccion, supervision y criterio tecnico.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border border-zinc-200 p-6">
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Enfoque</p>
              <p className="mt-4 text-sm leading-7 text-zinc-600">
                {siteSettings?.footerText ||
                  'Diseno, construccion, supervision, fiscalizacion y soporte tecnico articulados con una mirada integral del proyecto.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Historia</p>
            <h2 className="mt-3 text-2xl font-light tracking-tight sm:text-3xl">Trayectoria y criterio de trabajo</h2>
          </div>
          <div className="space-y-6">
            {storyParagraphs.map((paragraph) => (
              <p key={paragraph} className="text-base leading-8 text-zinc-700">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Equipo tecnico</p>
            <h2 className="mt-3 text-2xl font-light tracking-tight sm:text-3xl">Profesionales y especialidades con las que se trabaja</h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {(teamItems.length > 0 ? teamItems : fallbackTeam).map((item) => (
              <div key={item.title} className="border border-zinc-200 p-5">
                <p className="text-sm font-medium text-zinc-900">{item.title}</p>
                {item.description ? <p className="mt-3 text-sm leading-7 text-zinc-600">{item.description}</p> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Partners</p>
            <h2 className="mt-3 text-2xl font-light tracking-tight sm:text-3xl">Aliados y colaboraciones externas</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-600">{getPartnersIntro(language)}</p>
          </div>

          {partnerItems.length > 0 ? (
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {partnerItems.map((partner) => (
                <a
                  key={`${partner.title}-${partner.href}`}
                  href={partner.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start justify-between gap-4 border border-zinc-200 p-5 text-left transition-colors hover:border-zinc-900"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{partner.title}</p>
                    {partner.description ? <p className="mt-3 text-sm leading-7 text-zinc-600">{partner.description}</p> : null}
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                </a>
              ))}
            </div>
          ) : (
            <div className="mt-10 border border-zinc-200 p-5">
              <p className="text-sm leading-7 text-zinc-600">
                {language === 'en'
                  ? 'Strategic collaborators, specialist firms, and external partners can be presented here according to each project scope.'
                  : language === 'pt'
                    ? 'Colaboradores estrategicos, especialistas e parceiros externos podem ser apresentados aqui conforme o alcance de cada projeto.'
                    : 'Aqui se pueden presentar colaboradores estrategicos, especialistas y partners externos segun el alcance de cada proyecto.'}
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
