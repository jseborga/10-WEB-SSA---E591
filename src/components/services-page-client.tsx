'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { findEditorialSection, parseEditorialItems, parseEditorialSections, splitParagraphs } from '@/lib/editorial-sections'
import { useLanguage } from '@/lib/language-context'
import { PublicPublication, PublicSiteSettings, getLocalizedPublicationValue } from '@/lib/public-site'

interface ServicesPageClientProps {
  siteSettings?: PublicSiteSettings
  publication?: PublicPublication | null
}

type ServiceCard = {
  title: string
  eyebrow: string
  description: string
  aliases: string[]
}

function normalizePhoneLink(value: string) {
  return value.replace(/[^\d+]/g, '')
}

function normalizeWhatsappLink(value: string) {
  return value.replace(/\D/g, '')
}

function getServiceCards(language: string): ServiceCard[] {
  if (language === 'en') {
    return [
      {
        eyebrow: 'Construction',
        title: 'Construction and execution',
        description: 'Site execution, coordination, planning, and technical control for residential, commercial, and specialized works.',
        aliases: ['construction', 'execution', 'obra', 'construccion'],
      },
      {
        eyebrow: 'Consulting',
        title: 'Design, architecture, and engineering consulting',
        description: 'Concept development, technical criteria, architecture support, and coordinated engineering input for better decisions.',
        aliases: ['consulting', 'design', 'architecture', 'engineering', 'consultoria', 'arquitectura', 'ingenierias'],
      },
      {
        eyebrow: 'Engineering',
        title: 'Specialized engineering disciplines',
        description: 'Technical support across structures, systems, specialties, and integrated project definition.',
        aliases: ['engineering', 'ingenierias', 'specialties', 'especialidades'],
      },
      {
        eyebrow: 'Control',
        title: 'Supervision and inspection',
        description: 'Independent review, site follow-up, quality verification, and compliance control throughout execution.',
        aliases: ['supervision', 'inspection', 'fiscalizacion', 'supervision y fiscalizacion'],
      },
    ]
  }

  if (language === 'pt') {
    return [
      {
        eyebrow: 'Construcao',
        title: 'Construcao e execucao',
        description: 'Execucao de obra, coordenacao, planejamento e controle tecnico para projetos residenciais, comerciais e especializados.',
        aliases: ['construcao', 'execucao', 'obra'],
      },
      {
        eyebrow: 'Consultoria',
        title: 'Consultoria em design, arquitetura e engenharias',
        description: 'Desenvolvimento conceitual, criterio tecnico, apoio arquitetonico e engenharias coordenadas para melhores decisoes.',
        aliases: ['consultoria', 'design', 'arquitetura', 'engenharias'],
      },
      {
        eyebrow: 'Engenharias',
        title: 'Engenharias especializadas',
        description: 'Suporte tecnico em estruturas, sistemas, especialidades e definicao integrada de projeto.',
        aliases: ['engenharias', 'especialidades', 'sistemas'],
      },
      {
        eyebrow: 'Controle',
        title: 'Supervisao e fiscalizacao',
        description: 'Revisao independente, acompanhamento de obra, verificacao de qualidade e controle de conformidade.',
        aliases: ['supervisao', 'fiscalizacao', 'controle'],
      },
    ]
  }

  return [
    {
      eyebrow: 'Construccion',
      title: 'Construccion y ejecucion',
      description: 'Ejecucion de obra, coordinacion, planificacion y control tecnico para proyectos residenciales, comerciales y especializados.',
      aliases: ['construccion', 'ejecucion', 'obra'],
    },
    {
      eyebrow: 'Consultoria',
      title: 'Consultoria de diseno, arquitectura e ingenierias',
      description: 'Desarrollo conceptual, criterio tecnico, apoyo arquitectonico e ingenierias coordinadas para mejores decisiones.',
      aliases: ['consultoria', 'diseno', 'arquitectura', 'ingenierias'],
    },
    {
      eyebrow: 'Ingenierias',
      title: 'Ingenierias especializadas',
      description: 'Soporte tecnico en estructuras, sistemas, especialidades y definicion integrada de proyecto.',
      aliases: ['ingenierias', 'especialidades', 'sistemas'],
    },
    {
      eyebrow: 'Control',
      title: 'Supervision y fiscalizacion de obras',
      description: 'Revision independiente, seguimiento de obra, verificacion de calidad y control de cumplimiento durante la ejecucion.',
      aliases: ['supervision', 'fiscalizacion', 'control'],
    },
  ]
}

function getFallbackWorkflow(language: string) {
  if (language === 'en') {
    return [
      { title: 'Assessment', description: 'We define scope, project conditions, and the required technical route.' },
      { title: 'Strategy', description: 'We align service type, engineering input, architecture, and execution criteria.' },
      { title: 'Execution control', description: 'We coordinate decisions, supervise progress, and review quality on site.' },
      { title: 'Follow-up', description: 'We consolidate technical decisions, records, and next actions with the client team.' },
    ]
  }

  if (language === 'pt') {
    return [
      { title: 'Diagnostico', description: 'Definimos escopo, condicoes do projeto e a rota tecnica necessaria.' },
      { title: 'Estrategia', description: 'Alinhamos tipo de servico, engenharias, arquitetura e criterios de execucao.' },
      { title: 'Controle de execucao', description: 'Coordenamos decisoes, supervisionamos avancos e revisamos qualidade em obra.' },
      { title: 'Acompanhamento', description: 'Consolidamos decisoes tecnicas, registros e proximos passos com o cliente.' },
    ]
  }

  return [
    { title: 'Diagnostico', description: 'Definimos alcance, condiciones del proyecto y la ruta tecnica necesaria.' },
    { title: 'Estrategia', description: 'Alineamos tipo de servicio, ingenierias, arquitectura y criterios de ejecucion.' },
    { title: 'Control de ejecucion', description: 'Coordinamos decisiones, supervisamos avances y revisamos calidad en obra.' },
    { title: 'Seguimiento', description: 'Consolidamos decisiones tecnicas, registros y siguientes pasos con el cliente.' },
  ]
}

export function ServicesPageClient({ siteSettings, publication }: ServicesPageClientProps) {
  const { t, language } = useLanguage()
  const title = getLocalizedPublicationValue(publication, language, 'title') || t.nav.services || 'Servicios'
  const excerpt = getLocalizedPublicationValue(publication, language, 'excerpt')
  const body = getLocalizedPublicationValue(publication, language, 'content')
  const sections = parseEditorialSections(body)
  const introSection = findEditorialSection(sections, ['introduccion', 'intro', 'presentacion', 'overview'])
  const approachSection = findEditorialSection(sections, ['enfoque', 'alcance', 'criterio', 'approach'])
  const workflowSection = findEditorialSection(sections, ['proceso', 'metodologia', 'como trabajamos', 'workflow'])
  const referencesSection = findEditorialSection(sections, ['referencias', 'enlaces', 'links', 'references'])
  const baseCards = getServiceCards(language)
  const serviceCards = baseCards.map((service) => {
    const matchedSection = findEditorialSection(sections, service.aliases)
    const paragraphs = splitParagraphs(matchedSection?.body)

    return {
      ...service,
      description: paragraphs[0] || service.description,
      details: paragraphs.slice(1),
    }
  })
  const introParagraphs =
    splitParagraphs(introSection?.body).length > 0
      ? splitParagraphs(introSection?.body)
      : splitParagraphs(body).length > 0
        ? splitParagraphs(body)
        : []
  const approachParagraphs =
    splitParagraphs(approachSection?.body).length > 0
      ? splitParagraphs(approachSection?.body)
      : [
          language === 'en'
            ? 'We structure services to connect design intent, technical support, execution control, and project follow-up under one consistent commercial and technical language.'
            : language === 'pt'
              ? 'Estruturamos os servicos para conectar intencao de projeto, suporte tecnico, controle de execucao e acompanhamento sob uma linguagem comercial e tecnica consistente.'
              : 'Estructuramos los servicios para conectar intencion de proyecto, soporte tecnico, control de ejecucion y seguimiento bajo un mismo lenguaje comercial y tecnico.',
        ]
  const workflowItems = parseEditorialItems(workflowSection?.body)
  const referenceItems = parseEditorialItems(referencesSection?.body).filter((item) => item.href)
  const fallbackWorkflow = getFallbackWorkflow(language)
  const locationParts = [siteSettings?.addressLine, siteSettings?.city, siteSettings?.country].filter(Boolean)

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <SiteHeader tone="dark" siteSettings={siteSettings} />

      <section className="mx-auto max-w-6xl px-4 pb-12 pt-28 sm:px-6 sm:pt-32">
        <div className="grid gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t.nav.services || 'Servicios'}</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-light tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600">
              {excerpt || introParagraphs[0] || siteSettings?.footerText || siteSettings?.tagline || 'SSA Ingenieria'}
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/proyectos"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-3 text-[11px] uppercase tracking-[0.24em] text-white transition-colors hover:bg-zinc-800"
              >
                Ver proyectos
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contacto"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-5 py-3 text-[11px] uppercase tracking-[0.24em] text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900"
              >
                Solicitar asesoria
              </Link>
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
                      {siteSettings?.footerText || 'Construccion, consultoria y supervision con criterio tecnico.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="border border-zinc-200 p-5">
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Contacto directo</p>
                <div className="mt-4 space-y-2 text-sm leading-7 text-zinc-600">
                  {siteSettings?.phone ? <a href={`tel:${normalizePhoneLink(siteSettings.phone)}`}>{siteSettings.phone}</a> : null}
                  {siteSettings?.whatsapp ? (
                    <a href={`https://wa.me/${normalizeWhatsappLink(siteSettings.whatsapp)}`} target="_blank" rel="noreferrer">
                      WhatsApp {siteSettings.whatsapp}
                    </a>
                  ) : null}
                  {siteSettings?.email ? <a href={`mailto:${siteSettings.email}`}>{siteSettings.email}</a> : null}
                </div>
              </div>
              <div className="border border-zinc-200 p-5">
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Cobertura</p>
                <div className="mt-4 space-y-2 text-sm leading-7 text-zinc-600">
                  {locationParts.length > 0 ? <p>{locationParts.join(', ')}</p> : null}
                  <p>{siteSettings?.tagline || 'Servicios integrales para proyecto, obra y supervision.'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[0.74fr_1.26fr] lg:gap-16">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Servicios</p>
              <h2 className="mt-3 text-2xl font-light tracking-tight sm:text-3xl">Frentes de trabajo que puede activar la empresa</h2>
            </div>
            <div className="space-y-6">
              {approachParagraphs.map((paragraph) => (
                <p key={paragraph} className="text-base leading-8 text-zinc-700">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {serviceCards.map((service) => (
              <div key={service.title} className="border border-zinc-200 p-5">
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{service.eyebrow}</p>
                <h3 className="mt-3 text-lg font-medium text-zinc-900">{service.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-600">{service.description}</p>
                {service.details.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {service.details.map((detail) => (
                      <p key={detail} className="text-sm leading-7 text-zinc-500">
                        {detail}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Metodologia</p>
            <h2 className="mt-3 text-2xl font-light tracking-tight sm:text-3xl">Como se articula cada servicio</h2>
            {introParagraphs.length > 1 ? (
              <p className="mt-4 text-sm leading-7 text-zinc-600">{introParagraphs.slice(1).join(' ')}</p>
            ) : null}
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(workflowItems.length > 0 ? workflowItems : fallbackWorkflow).map((item) => (
              <div key={item.title} className="border border-zinc-200 p-5">
                <p className="text-sm font-medium text-zinc-900">{item.title}</p>
                {item.description ? <p className="mt-3 text-sm leading-7 text-zinc-600">{item.description}</p> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {referenceItems.length > 0 ? (
        <section className="border-t border-zinc-200">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Referencias</p>
              <h2 className="mt-3 text-2xl font-light tracking-tight sm:text-3xl">Material complementario y enlaces utiles</h2>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {referenceItems.map((item) => (
                <a
                  key={`${item.title}-${item.href}`}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start justify-between gap-4 border border-zinc-200 p-5 text-left transition-colors hover:border-zinc-900"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{item.title}</p>
                    {item.description ? <p className="mt-3 text-sm leading-7 text-zinc-600">{item.description}</p> : null}
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  )
}
