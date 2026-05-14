'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { SiteHeader } from '@/components/site-header'
import { sendAnalyticsEvent } from '@/lib/browser-analytics'
import { findEditorialSection, parseEditorialItems, parseEditorialSections, splitParagraphs } from '@/lib/editorial-sections'
import { useLanguage } from '@/lib/language-context'
import { PublicPublication, PublicSiteSettings, getLocalizedPublicationValue } from '@/lib/public-site'

interface QuotePageClientProps {
  siteSettings?: PublicSiteSettings
  publication?: PublicPublication | null
}

function normalizePhoneLink(value: string) {
  return value.replace(/[^\d+]/g, '')
}

function normalizeWhatsappLink(value: string) {
  return value.replace(/\D/g, '')
}

function getQuoteDefaults(language: 'es' | 'en' | 'pt') {
  if (language === 'en') {
    return {
      title: 'Project quote',
      intro: 'Share your project scope and we will prepare a first technical and commercial response.',
      send: 'Request quote',
      success: 'Quote request sent successfully',
      error: 'Could not send the quote request',
      selectOption: 'Select',
      fields: {
        name: 'Name',
        email: 'Email',
        phone: 'Phone / WhatsApp',
        projectType: 'Project type',
        serviceType: 'Service required',
        location: 'Location',
        area: 'Approximate area',
        timeline: 'Expected timeline',
        budget: 'Estimated budget',
        message: 'Project details',
      },
      serviceOptions: ['Construction', 'Design and architecture', 'Engineering', 'Supervision and inspection', 'Consulting'],
      projectOptions: ['Residential', 'Commercial', 'Office', 'Industrial', 'Renovation', 'Other'],
      timelineOptions: ['Immediate', 'Within 30 days', '1 to 3 months', '3 to 6 months', 'Still evaluating'],
      budgetOptions: ['To be defined', 'Under USD 10k', 'USD 10k to 50k', 'USD 50k to 150k', 'Over USD 150k'],
      requirementsTitle: 'What helps us quote better',
      requirements: [
        'Project type and current stage.',
        'Required service: construction, design, engineering, or supervision.',
        'Location, scale, and estimated timeline.',
        'Reference links, drawings, or images if available.',
      ],
      processTitle: 'Next step',
      processBody: 'We review the request, validate scope, and return with the right channel for follow-up: quote, advisory call, or technical meeting.',
      contactTitle: 'Direct channels',
      projectsCta: 'View projects',
      serviceLabel: 'Quote',
    }
  }

  if (language === 'pt') {
    return {
      title: 'Cotacao de projetos',
      intro: 'Compartilhe o escopo do seu projeto e prepararemos uma primeira resposta tecnica e comercial.',
      send: 'Solicitar cotacao',
      success: 'Solicitacao enviada com sucesso',
      error: 'Nao foi possivel enviar a solicitacao',
      selectOption: 'Selecionar',
      fields: {
        name: 'Nome',
        email: 'Email',
        phone: 'Telefone / WhatsApp',
        projectType: 'Tipo de projeto',
        serviceType: 'Servico necessario',
        location: 'Localizacao',
        area: 'Area aproximada',
        timeline: 'Prazo estimado',
        budget: 'Orcamento estimado',
        message: 'Detalhes do projeto',
      },
      serviceOptions: ['Construcao', 'Design e arquitetura', 'Engenharias', 'Supervisao e fiscalizacao', 'Consultoria'],
      projectOptions: ['Residencial', 'Comercial', 'Escritorios', 'Industrial', 'Reforma', 'Outro'],
      timelineOptions: ['Imediato', 'Dentro de 30 dias', '1 a 3 meses', '3 a 6 meses', 'Ainda avaliando'],
      budgetOptions: ['A definir', 'Abaixo de USD 10 mil', 'USD 10 mil a 50 mil', 'USD 50 mil a 150 mil', 'Acima de USD 150 mil'],
      requirementsTitle: 'O que ajuda a cotar melhor',
      requirements: [
        'Tipo de projeto e etapa atual.',
        'Servico requerido: construcao, design, engenharias ou supervisao.',
        'Localizacao, escala e prazo estimado.',
        'Links, plantas ou imagens de referencia se existirem.',
      ],
      processTitle: 'Proximo passo',
      processBody: 'Revisamos a solicitacao, validamos o alcance e respondemos pelo canal mais adequado: cotacao, chamada de assessoria ou reuniao tecnica.',
      contactTitle: 'Canais diretos',
      projectsCta: 'Ver projetos',
      serviceLabel: 'Cotacao',
    }
  }

  return {
    title: 'Cotizacion de proyectos',
    intro: 'Comparte el alcance de tu proyecto y prepararemos una primera respuesta tecnica y comercial.',
    send: 'Solicitar cotizacion',
    success: 'Solicitud de cotizacion enviada correctamente',
    error: 'No se pudo enviar la solicitud de cotizacion',
    selectOption: 'Seleccionar',
    fields: {
      name: 'Nombre',
      email: 'Correo',
      phone: 'Telefono / WhatsApp',
      projectType: 'Tipo de proyecto',
      serviceType: 'Servicio requerido',
      location: 'Ubicacion',
      area: 'Area aproximada',
      timeline: 'Plazo estimado',
      budget: 'Presupuesto estimado',
      message: 'Detalles del proyecto',
    },
    serviceOptions: ['Construccion', 'Diseno y arquitectura', 'Ingenierias', 'Supervision y fiscalizacion', 'Consultoria'],
    projectOptions: ['Residencial', 'Comercial', 'Oficinas', 'Industrial', 'Remodelacion', 'Otro'],
    timelineOptions: ['Inmediato', 'Dentro de 30 dias', '1 a 3 meses', '3 a 6 meses', 'Aun en evaluacion'],
    budgetOptions: ['Por definir', 'Menor a USD 10 mil', 'USD 10 mil a 50 mil', 'USD 50 mil a 150 mil', 'Mayor a USD 150 mil'],
    requirementsTitle: 'Que ayuda a cotizar mejor',
    requirements: [
      'Tipo de proyecto y etapa actual.',
      'Servicio requerido: construccion, diseno, ingenierias o supervision.',
      'Ubicacion, escala y plazo estimado.',
      'Links, planos o imagenes de referencia si existen.',
    ],
    processTitle: 'Siguiente paso',
    processBody: 'Revisamos la solicitud, validamos alcance y respondemos por el canal mas adecuado: cotizacion, llamada de asesoria o reunion tecnica.',
    contactTitle: 'Canales directos',
    projectsCta: 'Ver proyectos',
    serviceLabel: 'Cotizacion',
  }
}

export function QuotePageClient({ siteSettings, publication }: QuotePageClientProps) {
  const { language } = useLanguage()
  const defaults = useMemo(() => getQuoteDefaults(language), [language])
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    phone: '',
    projectType: '',
    serviceType: '',
    location: '',
    area: '',
    timeline: '',
    budget: '',
    message: '',
  })
  const [sending, setSending] = useState(false)

  const title = getLocalizedPublicationValue(publication, language, 'title') || defaults.title
  const excerpt = getLocalizedPublicationValue(publication, language, 'excerpt') || defaults.intro
  const body = getLocalizedPublicationValue(publication, language, 'content')
  const sections = parseEditorialSections(body)
  const introSection = findEditorialSection(sections, ['introduccion', 'intro', 'presentacion', 'overview'])
  const scopeSection = findEditorialSection(sections, ['alcance', 'proyecto', 'scope'])
  const processSection = findEditorialSection(sections, ['proceso', 'siguiente paso', 'workflow', 'next step'])
  const referencesSection = findEditorialSection(sections, ['referencias', 'enlaces', 'links', 'references'])
  const introParagraphs = splitParagraphs(introSection?.body)
  const scopeParagraphs = splitParagraphs(scopeSection?.body)
  const processParagraphs = splitParagraphs(processSection?.body)
  const referenceItems = parseEditorialItems(referencesSection?.body).filter((item) => item.href)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)

    const projectType = formState.projectType.trim()
    const subject = projectType ? `Solicitud de cotizacion - ${projectType}` : 'Solicitud de cotizacion'
    const messageLines = [
      `Servicio requerido: ${formState.serviceType || 'No especificado'}`,
      `Tipo de proyecto: ${projectType || 'No especificado'}`,
      `Ubicacion: ${formState.location || 'No especificada'}`,
      `Area aproximada: ${formState.area || 'No especificada'}`,
      `Plazo estimado: ${formState.timeline || 'No especificado'}`,
      `Presupuesto estimado: ${formState.budget || 'No especificado'}`,
      '',
      'Detalle del proyecto:',
      formState.message.trim(),
    ].join('\n')

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name,
          email: formState.email,
          phone: formState.phone,
          subject,
          message: messageLines,
        }),
      })

      if (!response.ok) {
        throw new Error('request_failed')
      }

      sendAnalyticsEvent({
        eventType: 'quote-submit',
        payload: {
          serviceType: formState.serviceType,
          projectType: formState.projectType,
        },
      })

      setFormState({
        name: '',
        email: '',
        phone: '',
        projectType: '',
        serviceType: '',
        location: '',
        area: '',
        timeline: '',
        budget: '',
        message: '',
      })
      toast.success(defaults.success)
    } catch {
      toast.error(defaults.error)
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <SiteHeader tone="dark" siteSettings={siteSettings} />

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{defaults.serviceLabel}</p>
            <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-zinc-600">{excerpt}</p>
            {introParagraphs.slice(1).map((paragraph) => (
              <p key={paragraph} className="mt-6 text-sm leading-7 text-zinc-500">
                {paragraph}
              </p>
            ))}

            <div className="mt-10 rounded-[28px] border border-zinc-200 p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{defaults.requirementsTitle}</p>
              <div className="mt-4 space-y-3">
                {(scopeParagraphs.length > 0 ? scopeParagraphs : defaults.requirements).map((item) => (
                  <p key={item} className="text-sm leading-7 text-zinc-600">
                    {item}
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-[28px] border border-zinc-200 p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{defaults.processTitle}</p>
              <div className="mt-4 space-y-3">
                {(processParagraphs.length > 0 ? processParagraphs : [defaults.processBody]).map((item) => (
                  <p key={item} className="text-sm leading-7 text-zinc-600">
                    {item}
                  </p>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/proyectos"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900"
                >
                  {defaults.projectsCta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="mt-6 rounded-[28px] border border-zinc-200 p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{defaults.contactTitle}</p>
              <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-600">
                {siteSettings?.email ? (
                  <a href={`mailto:${siteSettings.email}`} className="flex items-center gap-3 transition-colors hover:text-zinc-900">
                    <Mail className="h-4 w-4 text-zinc-400" />
                    <span>{siteSettings.email}</span>
                  </a>
                ) : null}
                {siteSettings?.phone ? (
                  <a href={`tel:${normalizePhoneLink(siteSettings.phone)}`} className="flex items-center gap-3 transition-colors hover:text-zinc-900">
                    <Phone className="h-4 w-4 text-zinc-400" />
                    <span>{siteSettings.phone}</span>
                  </a>
                ) : null}
                {siteSettings?.whatsapp ? (
                  <a
                    href={`https://wa.me/${normalizeWhatsappLink(siteSettings.whatsapp)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 transition-colors hover:text-zinc-900"
                  >
                    <Phone className="h-4 w-4 text-zinc-400" />
                    <span>WhatsApp {siteSettings.whatsapp}</span>
                  </a>
                ) : null}
                {[siteSettings?.addressLine, siteSettings?.city, siteSettings?.country].filter(Boolean).length > 0 ? (
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 text-zinc-400" />
                    <span>{[siteSettings?.addressLine, siteSettings?.city, siteSettings?.country].filter(Boolean).join(', ')}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {referenceItems.length > 0 ? (
              <div className="mt-6 space-y-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Referencias</p>
                <div className="space-y-3">
                  {referenceItems.map((item) => (
                    <a
                      key={`${item.title}-${item.href}`}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start justify-between gap-4 rounded-[24px] border border-zinc-200 px-5 py-4 text-left transition-colors hover:border-zinc-900"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{item.title}</p>
                        {item.description ? <p className="mt-2 text-sm leading-7 text-zinc-600">{item.description}</p> : null}
                      </div>
                      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[32px] border border-zinc-200 p-6 sm:p-8">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-zinc-600">
                  <span>{defaults.fields.name}</span>
                  <input
                    required
                    value={formState.name}
                    onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                  />
                </label>
                <label className="space-y-2 text-sm text-zinc-600">
                  <span>{defaults.fields.email}</span>
                  <input
                    required
                    type="email"
                    value={formState.email}
                    onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-zinc-600">
                  <span>{defaults.fields.phone}</span>
                  <input
                    value={formState.phone}
                    onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                  />
                </label>
                <label className="space-y-2 text-sm text-zinc-600">
                  <span>{defaults.fields.location}</span>
                  <input
                    value={formState.location}
                    onChange={(event) => setFormState((current) => ({ ...current, location: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-zinc-600">
                  <span>{defaults.fields.projectType}</span>
                  <select
                    required
                    value={formState.projectType}
                    onChange={(event) => setFormState((current) => ({ ...current, projectType: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                  >
                    <option value="">{defaults.selectOption}</option>
                    {defaults.projectOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-zinc-600">
                  <span>{defaults.fields.serviceType}</span>
                  <select
                    required
                    value={formState.serviceType}
                    onChange={(event) => setFormState((current) => ({ ...current, serviceType: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                  >
                    <option value="">{defaults.selectOption}</option>
                    {defaults.serviceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-2 text-sm text-zinc-600">
                  <span>{defaults.fields.area}</span>
                  <input
                    value={formState.area}
                    onChange={(event) => setFormState((current) => ({ ...current, area: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                  />
                </label>
                <label className="space-y-2 text-sm text-zinc-600">
                  <span>{defaults.fields.timeline}</span>
                  <select
                    value={formState.timeline}
                    onChange={(event) => setFormState((current) => ({ ...current, timeline: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                  >
                    <option value="">{defaults.selectOption}</option>
                    {defaults.timelineOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-zinc-600">
                  <span>{defaults.fields.budget}</span>
                  <select
                    value={formState.budget}
                    onChange={(event) => setFormState((current) => ({ ...current, budget: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                  >
                    <option value="">{defaults.selectOption}</option>
                    {defaults.budgetOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-2 text-sm text-zinc-600">
                <span>{defaults.fields.message}</span>
                <textarea
                  required
                  rows={8}
                  value={formState.message}
                  onChange={(event) => setFormState((current) => ({ ...current, message: event.target.value }))}
                  className="w-full rounded-[24px] border border-zinc-200 px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                />
              </label>

              <button
                type="submit"
                disabled={sending}
                className="inline-flex rounded-full bg-zinc-900 px-6 py-3 text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {sending ? '...' : defaults.send}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}
