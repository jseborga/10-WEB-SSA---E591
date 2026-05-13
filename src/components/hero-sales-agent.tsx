'use client'

import { FormEvent, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, MessageCircleMore, MapPin, Send, Sparkles } from 'lucide-react'
import { dispatchExternalChatOpen, type ChatLeadStage } from '@/lib/chat-launcher'
import { formatCategoryLabel, parseTagList, type PublicProject, type PublicSiteSettings } from '@/lib/public-site'

type HeroReplyAction = 'projects' | 'chat' | 'whatsapp' | 'services' | 'design' | 'construction' | 'qualify'

type HeroServiceSuggestion = {
  id: string
  label: string
  summary: string
  followUpQuery: string
}

type HeroProjectSuggestion = {
  id: string
  title: string
  category: string
  description: string
  location: string
  imageUrl: string
}

type HeroReply = {
  answer: string
  ctas: Array<{
    label: string
    action: HeroReplyAction
  }>
  suggestedServices?: HeroServiceSuggestion[]
  suggestedProjects?: HeroProjectSuggestion[]
  shouldQualify?: boolean
}

type HeroConversationItem = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type LeadDraft = {
  projectType: string
  service: string
  location: string
  timeline: string
  preferredContactChannel: string
  contactConsent: boolean
}

type LeadReadiness = {
  stage: ChatLeadStage
  label: string
  recommendation: string
  actionLabel: string
}

interface HeroSalesAgentProps {
  companyName: string
  tone: 'dark' | 'light'
  siteSettings?: PublicSiteSettings
  projects?: PublicProject[]
}

const SERVICE_CATALOG: HeroServiceSuggestion[] = [
  {
    id: 'design',
    label: 'Diseno y arquitectura',
    summary: 'Anteproyecto, diseno arquitectonico, coordinacion tecnica y definicion base del proyecto.',
    followUpQuery: 'Necesito apoyo en diseno y arquitectura',
  },
  {
    id: 'construction',
    label: 'Construccion y obra',
    summary: 'Ejecucion de obra, coordinacion de campo, control de avance y entrega.',
    followUpQuery: 'Necesito construccion y ejecucion de obra',
  },
  {
    id: 'supervision',
    label: 'Supervision tecnica',
    summary: 'Revision de obra, control de calidad, seguimiento y soporte tecnico.',
    followUpQuery: 'Necesito supervision tecnica para una obra',
  },
  {
    id: 'installations',
    label: 'Instalaciones',
    summary: 'Instalaciones electricas, sanitarias y soporte tecnico especializado.',
    followUpQuery: 'Necesito instalaciones para un proyecto',
  },
  {
    id: 'integral',
    label: 'Gestion integral',
    summary: 'Acompanamiento desde la idea inicial hasta la coordinacion comercial y tecnica.',
    followUpQuery: 'Necesito una solucion integral para mi proyecto',
  },
]

const PROJECT_TYPE_OPTIONS = ['Vivienda', 'Edificio', 'Local comercial', 'Remodelacion', 'Instalaciones']
const TIMELINE_OPTIONS = ['Inmediato', '1 a 3 meses', '3 a 6 meses', 'Solo evaluacion']
const CONTACT_CHANNEL_OPTIONS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'phone', label: 'Llamada' },
  { id: 'email', label: 'Correo' },
  { id: 'telegram', label: 'Telegram' },
]

function normalizeQuery(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function tokenize(value: string) {
  return normalizeQuery(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
}

function buildWhatsAppHref(value: string | null | undefined) {
  const raw = (value || '').trim()

  if (!raw) {
    return ''
  }

  const digits = raw.replace(/[^\d]/g, '')
  return digits ? `https://wa.me/${digits}` : ''
}

function buildWhatsAppQuoteHref(phone: string | null | undefined, message: string) {
  const baseHref = buildWhatsAppHref(phone)

  if (!baseHref || !message.trim()) {
    return baseHref
  }

  return `${baseHref}?text=${encodeURIComponent(message.trim())}`
}

function formatContactChannelLabel(value: string) {
  return CONTACT_CHANNEL_OPTIONS.find((option) => option.id === value)?.label || value
}

function getLeadReadiness(query: string, leadDraft: LeadDraft): LeadReadiness {
  let score = 0

  if (leadDraft.projectType.trim()) score += 1
  if (leadDraft.service.trim()) score += 1
  if (leadDraft.location.trim()) score += 1
  if (leadDraft.timeline.trim()) score += 1
  if (leadDraft.preferredContactChannel.trim()) score += 1
  if (leadDraft.contactConsent) score += 1
  if (/(cotiz|presup|precio|contact|llamar|whatsapp|humano|asesor|inmediat|urgente|hoy)/.test(normalizeQuery(query))) {
    score += 2
  }

  if (score >= 6) {
    return {
      stage: 'hot',
      label: 'Listo para cierre',
      recommendation: 'Ya conviene pasarlo a asesor con canal preferido y autorizacion confirmada.',
      actionLabel: 'Pasar a asesor',
    }
  }

  if (score >= 4) {
    return {
      stage: 'qualified',
      label: 'Lead en evaluacion',
      recommendation: 'Ya hay contexto suficiente para abrir el chat con una consulta mas afinada.',
      actionLabel: 'Abrir chat guiado',
    }
  }

  return {
    stage: 'discover',
    label: 'Exploracion',
    recommendation: 'Todavia conviene perfilar el servicio, tipo de proyecto y el mejor canal de contacto.',
    actionLabel: 'Abrir chat guiado',
  }
}

function getServiceSuggestions(query: string) {
  const normalized = normalizeQuery(query)
  const matches = SERVICE_CATALOG.filter((service) => {
    const haystack = normalizeQuery(`${service.label} ${service.summary} ${service.followUpQuery}`)

    if (haystack.includes(normalized) && normalized.length > 2) {
      return true
    }

    if (service.id === 'design' && /(disen|arquitect|plan|concepto|anteproyecto)/.test(normalized)) return true
    if (service.id === 'construction' && /(constru|obra|ejec|civil|edific)/.test(normalized)) return true
    if (service.id === 'supervision' && /(supervis|fiscaliz|control|calidad)/.test(normalized)) return true
    if (service.id === 'installations' && /(instalac|electric|sanitari|mantenimiento)/.test(normalized)) return true
    if (service.id === 'integral' && /(integral|llave|gestion|coordina)/.test(normalized)) return true

    return false
  })

  return matches.length > 0 ? matches.slice(0, 3) : SERVICE_CATALOG.slice(0, 3)
}

function recommendProjects(query: string, projects: PublicProject[]) {
  const queryTokens = tokenize(query)
  const scored = projects
    .map((project) => {
      const tags = parseTagList(`${project.projectTags || ''}\n${project.seoKeywords || ''}`)
      const haystack = normalizeQuery(
        [
          project.title,
          project.description || '',
          project.category || '',
          project.location || '',
          project.client || '',
          ...tags,
        ].join(' '),
      )

      let score = 0

      for (const token of queryTokens) {
        if (haystack.includes(token)) {
          score += token.length > 5 ? 3 : 2
        }
      }

      if (/(disen|arquitect)/.test(normalizeQuery(query)) && /residencial|comercial|arquitect/.test(haystack)) {
        score += 3
      }

      if (/(constru|obra|instalac|supervis)/.test(normalizeQuery(query)) && /industrial|comercial|residencial|obra|instalac/.test(haystack)) {
        score += 3
      }

      if (project.showOnHomepage) {
        score += 1
      }

      return {
        project,
        score,
      }
    })
    .sort((left, right) => right.score - left.score)

  const topProjects = scored
    .filter((item, index) => item.score > 0 || index < 3)
    .slice(0, 3)
    .map<HeroProjectSuggestion>(({ project }) => ({
      id: project.id,
      title: project.title,
      category: formatCategoryLabel(project.category || 'Proyecto'),
      description: project.description || project.mainImageCaption || 'Proyecto publicado por SSA Ingenieria.',
      location: project.location || '',
      imageUrl: (project.mainImage || project.mainImageMobile || '').trim() || '/images/projects/house1.png',
    }))

  return topProjects
}

function createReply(
  query: string,
  context: {
    companyName: string
    categories: string[]
    projectCount: number
    whatsappHref: string
    projects: PublicProject[]
  },
): HeroReply {
  const normalized = normalizeQuery(query)
  const categorySummary = context.categories.slice(0, 3).join(', ')
  const suggestedServices = getServiceSuggestions(query)
  const suggestedProjects = recommendProjects(query, context.projects)

  if (/(cotiz|presup|precio|propuesta|contact|asesor|whatsapp|llamar|reunion|reunion)/.test(normalized)) {
    return {
      answer: `${context.companyName} puede ayudarte a aterrizar el alcance del proyecto. Te dejo una precalificacion corta para recomendarte servicio y referencias antes de pasar al chat comercial.`,
      ctas: [
        { label: 'Empezar precalificacion', action: 'qualify' },
        { label: 'Abrir chat comercial', action: 'chat' },
        ...(context.whatsappHref ? [{ label: 'WhatsApp', action: 'whatsapp' as const }] : []),
      ],
      suggestedServices,
      suggestedProjects,
      shouldQualify: true,
    }
  }

  if (/(servicio|hacen|ofrecen|solucion|soluciones|empresa)/.test(normalized)) {
    return {
      answer: `${context.companyName} trabaja en diseno, construccion, supervision de obra, instalaciones y gestion integral. Segun lo que busques, te puedo mostrar referencias y llevarte a una consulta comercial.`,
      ctas: [
        { label: 'Ver proyectos', action: 'projects' },
        { label: 'Diseno y arquitectura', action: 'design' },
        { label: 'Construccion y obra', action: 'construction' },
      ],
      suggestedServices,
      suggestedProjects,
    }
  }

  if (/(disen|arquitect|plan|concepto|anteproyecto)/.test(normalized)) {
    return {
      answer: `${context.companyName} puede apoyar desde el diseno arquitectonico y la planificacion tecnica hasta la coordinacion con la ejecucion. Te dejo servicios y proyectos que encajan mejor con esa intencion.`,
      ctas: [
        { label: 'Ver proyectos', action: 'projects' },
        { label: 'Abrir chat comercial', action: 'chat' },
      ],
      suggestedServices,
      suggestedProjects,
    }
  }

  if (/(constru|obra|ejec|edific|civil|supervis|instalac|electric|sanitari)/.test(normalized)) {
    return {
      answer: `${context.companyName} ejecuta obra, supervision e instalaciones con acompanamiento tecnico. Hoy hay referencias publicadas en ${categorySummary || 'proyectos integrales'} y puedo llevarte directo a una consulta de cierre si ya tienes una necesidad concreta.`,
      ctas: [
        { label: 'Ver proyectos', action: 'projects' },
        { label: 'Empezar precalificacion', action: 'qualify' },
      ],
      suggestedServices,
      suggestedProjects,
      shouldQualify: true,
    }
  }

  if (/(proyecto|proyectos|galeria|portafolio|trabajos|casos|referencias)/.test(normalized)) {
    return {
      answer:
        context.projectCount > 0
          ? `${context.companyName} tiene ${context.projectCount} proyectos publicados. Te muestro una seleccion alineada con tu consulta para que explores ejemplos concretos y luego sigas al chat si quieres cotizar.`
          : `${context.companyName} puede mostrarte proyectos y referencias desde el portafolio publicado.`,
      ctas: [
        { label: 'Ver proyectos', action: 'projects' },
        { label: 'Abrir chat comercial', action: 'chat' },
      ],
      suggestedProjects,
      suggestedServices,
    }
  }

  return {
    answer: `Puedo mostrarte que hace ${context.companyName}, sugerirte servicios, ensenarte proyectos relacionados y dejar lista una consulta comercial mas precisa.`,
    ctas: [
      { label: 'Que servicios ofrecen', action: 'services' },
      { label: 'Ver proyectos', action: 'projects' },
      { label: 'Empezar precalificacion', action: 'qualify' },
    ],
    suggestedServices,
    suggestedProjects,
  }
}

function buildLeadSummary(companyName: string, sourceQuery: string, leadDraft: LeadDraft, leadReadiness: LeadReadiness) {
  const lines = [
    `Quiero una evaluacion comercial con ${companyName}.`,
    sourceQuery ? `Consulta inicial: ${sourceQuery}` : '',
    leadDraft.projectType ? `Tipo de proyecto: ${leadDraft.projectType}` : '',
    leadDraft.service ? `Servicio requerido: ${leadDraft.service}` : '',
    leadDraft.location ? `Ubicacion: ${leadDraft.location}` : '',
    leadDraft.timeline ? `Plazo estimado: ${leadDraft.timeline}` : '',
    leadDraft.preferredContactChannel ? `Canal preferido: ${formatContactChannelLabel(leadDraft.preferredContactChannel)}` : '',
    `Estado comercial: ${leadReadiness.label}`,
    `Autorizo contacto: ${leadDraft.contactConsent ? 'si' : 'no confirmado'}`,
  ].filter(Boolean)

  return lines.join('\n')
}

export function HeroSalesAgent({
  companyName,
  tone,
  siteSettings,
  projects = [],
}: HeroSalesAgentProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [conversation, setConversation] = useState<HeroConversationItem[]>([])
  const [activeReply, setActiveReply] = useState<HeroReply | null>(null)
  const [isQualifying, setIsQualifying] = useState(false)
  const [leadDraft, setLeadDraft] = useState<LeadDraft>({
    projectType: '',
    service: '',
    location: '',
    timeline: '',
    preferredContactChannel: '',
    contactConsent: false,
  })
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          projects
            .map((project) => formatCategoryLabel(project.category || ''))
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ),
    [projects],
  )
  const whatsappHref = useMemo(() => buildWhatsAppHref(siteSettings?.whatsapp), [siteSettings?.whatsapp])
  const promptChips = useMemo(
    () => [
      { label: 'Que servicios ofrecen?', query: 'Que servicios ofrecen?' },
      { label: 'Construyen y disenan?', query: 'Construyen y disenan?' },
      { label: 'Ver proyectos', query: 'Muestrame proyectos' },
      { label: 'Quiero cotizar', query: 'Quiero cotizar una obra' },
    ],
    [],
  )
  const panelClass =
    tone === 'light'
      ? 'border-white/18 bg-black/18 text-white shadow-[0_18px_48px_rgba(0,0,0,0.22)]'
      : 'border-zinc-900/12 bg-white/24 text-zinc-950 shadow-[0_18px_48px_rgba(255,255,255,0.08)]'
  const subtleTextClass = tone === 'light' ? 'text-white/72' : 'text-zinc-900/68'
  const strongTextClass = tone === 'light' ? 'text-lime-100' : 'text-emerald-950'
  const inputClass =
    tone === 'light'
      ? 'border-white/18 bg-black/16 text-white placeholder:text-white/44'
      : 'border-zinc-900/12 bg-white/18 text-zinc-950 placeholder:text-zinc-900/38'
  const chipClass =
    tone === 'light'
      ? 'border-white/16 text-white/84 hover:border-white/34 hover:bg-white/10'
      : 'border-zinc-900/12 text-zinc-950/80 hover:border-zinc-900/24 hover:bg-white/22'
  const cardClass =
    tone === 'light'
      ? 'border-white/14 bg-black/14 hover:border-white/30 hover:bg-black/22'
      : 'border-zinc-900/12 bg-white/16 hover:border-zinc-900/24 hover:bg-white/24'
  const lastUserMessage = useMemo(
    () =>
      [...conversation]
        .reverse()
        .find((item) => item.role === 'user')
        ?.content || '',
    [conversation],
  )
  const leadReadiness = useMemo(
    () => getLeadReadiness(lastUserMessage || query, leadDraft),
    [lastUserMessage, leadDraft, query],
  )
  const qualificationReady = Boolean(leadDraft.projectType.trim() && leadDraft.service.trim())
  const handoffReady = Boolean(qualificationReady && leadDraft.preferredContactChannel.trim() && leadDraft.contactConsent)
  const qualificationMessage = useMemo(
    () => buildLeadSummary(companyName, lastUserMessage || query, leadDraft, leadReadiness),
    [companyName, lastUserMessage, leadDraft, leadReadiness, query],
  )
  const whatsappQuoteHref = useMemo(
    () => buildWhatsAppQuoteHref(siteSettings?.whatsapp, qualificationMessage),
    [qualificationMessage, siteSettings?.whatsapp],
  )

  const submitQuery = (rawQuery: string) => {
    const nextQuery = rawQuery.trim()

    if (!nextQuery) {
      return
    }

    const nextReply = createReply(nextQuery, {
      companyName,
      categories,
      projectCount: projects.length,
      whatsappHref,
      projects,
    })

    setConversation((current) =>
      [
        ...current,
        { id: `user-${Date.now()}`, role: 'user' as const, content: nextQuery },
        { id: `assistant-${Date.now() + 1}`, role: 'assistant' as const, content: nextReply.answer },
      ].slice(-4),
    )
    setActiveReply(nextReply)
    setIsQualifying(Boolean(nextReply.shouldQualify))
    setQuery('')
  }

  const openChat = (message: string, autoSend = false) => {
    dispatchExternalChatOpen({
      message,
      autoSend,
      leadContext: {
        source: 'hero-sales-agent',
        stage: leadReadiness.stage,
        projectType: leadDraft.projectType || undefined,
        serviceType: leadDraft.service || undefined,
        projectLocation: leadDraft.location || undefined,
        timeline: leadDraft.timeline || undefined,
        preferredContactChannel: leadDraft.preferredContactChannel || undefined,
        contactConsent: leadDraft.contactConsent,
      },
    })
  }

  const handleCta = (action: HeroReplyAction) => {
    if (action === 'projects') {
      router.push('/proyectos')
      return
    }

    if (action === 'chat') {
      openChat(lastUserMessage || 'Quiero una cotizacion inicial para mi proyecto.')
      return
    }

    if (action === 'whatsapp' && whatsappHref) {
      window.open(whatsappHref, '_blank', 'noopener,noreferrer')
      return
    }

    if (action === 'services') {
      submitQuery('Que servicios ofrecen?')
      return
    }

    if (action === 'design') {
      submitQuery('Tambien hacen diseno y arquitectura?')
      return
    }

    if (action === 'construction') {
      submitQuery('Tambien construyen y supervisan obra?')
      return
    }

    if (action === 'qualify') {
      setIsQualifying(true)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitQuery(query)
  }

  const handleProjectOpen = (projectId: string) => {
    router.push(`/proyectos/${projectId}`)
  }

  const handleQualificationSubmit = () => {
    openChat(qualificationMessage, handoffReady)
  }

  return (
    <div className={`pointer-events-auto mt-4 w-full max-w-[min(92vw,40rem)] rounded-[22px] border p-3 backdrop-blur-md sm:p-4 ${panelClass}`}>
      <div className="space-y-3">
        {conversation.length > 0 ? (
          <div className="space-y-2">
            {conversation.slice(-2).map((item) => (
              <div key={item.id} className={`max-w-[94%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${item.role === 'user' ? `${inputClass} ml-auto border` : 'bg-transparent p-0'}`}>
                {item.role === 'assistant' ? (
                  <div className="space-y-1">
                    <p className={`font-mono text-[10px] uppercase tracking-[0.18em] ${subtleTextClass}`}>agente ssa</p>
                    <p className={strongTextClass}>{item.content}</p>
                  </div>
                ) : (
                  <p>{item.content}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <p className={`font-mono text-[10px] uppercase tracking-[0.18em] ${subtleTextClass}`}>agente comercial</p>
            <p className={`text-sm leading-relaxed ${strongTextClass}`}>
              Haz una pregunta rapida y te muestro servicios, proyectos relacionados y el mejor siguiente paso comercial.
            </p>
          </div>
        )}

        {activeReply?.ctas?.length ? (
          <div className="flex flex-wrap gap-2">
            {activeReply.ctas.map((cta) => (
              <button
                key={`${cta.action}-${cta.label}`}
                type="button"
                onClick={() => handleCta(cta.action)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] transition-colors ${chipClass}`}
              >
                {cta.label}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        ) : null}

        {activeReply?.suggestedServices?.length ? (
          <div className="space-y-2">
            <p className={`font-mono text-[10px] uppercase tracking-[0.18em] ${subtleTextClass}`}>servicios recomendados</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {activeReply.suggestedServices.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    submitQuery(service.followUpQuery)
                    setLeadDraft((current) => ({ ...current, service: service.label }))
                  }}
                  className={`rounded-2xl border p-3 text-left transition-colors ${cardClass}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{service.label}</p>
                      <p className={`mt-1 text-xs leading-relaxed ${subtleTextClass}`}>{service.summary}</p>
                    </div>
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {activeReply?.suggestedProjects?.length ? (
          <div className="space-y-2">
            <p className={`font-mono text-[10px] uppercase tracking-[0.18em] ${subtleTextClass}`}>proyectos relacionados</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {activeReply.suggestedProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleProjectOpen(project.id)}
                  className={`overflow-hidden rounded-2xl border text-left transition-colors ${cardClass}`}
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image src={project.imageUrl} alt="" fill className="object-cover" />
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] opacity-70">{project.category}</p>
                    <p className="line-clamp-2 text-sm font-medium">{project.title}</p>
                    {project.location ? (
                      <p className={`inline-flex items-center gap-1 text-[11px] ${subtleTextClass}`}>
                        <MapPin className="h-3 w-3" />
                        {project.location}
                      </p>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {isQualifying ? (
          <div className={`space-y-3 rounded-2xl border p-3 ${cardClass}`}>
            <div>
              <p className="text-sm font-medium">Precalificacion rapida</p>
              <p className={`mt-1 text-xs leading-relaxed ${subtleTextClass}`}>
                Completa lo minimo para abrir el chat comercial con mejor contexto y una recomendacion mas afin.
              </p>
            </div>

            <div className={`space-y-2 rounded-2xl border px-3 py-2 ${cardClass}`}>
              <p className={`text-[11px] uppercase tracking-[0.18em] ${subtleTextClass}`}>estado comercial</p>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                    leadReadiness.stage === 'hot'
                      ? 'bg-emerald-950 text-white'
                      : leadReadiness.stage === 'qualified'
                        ? 'bg-zinc-900 text-white'
                        : tone === 'light'
                          ? 'bg-white/12 text-white'
                          : 'bg-zinc-900/10 text-zinc-900'
                  }`}
                >
                  {leadReadiness.label}
                </span>
                <p className={`text-xs leading-relaxed ${subtleTextClass}`}>{leadReadiness.recommendation}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className={`text-[11px] uppercase tracking-[0.18em] ${subtleTextClass}`}>tipo de proyecto</p>
              <div className="flex flex-wrap gap-2">
                {PROJECT_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLeadDraft((current) => ({ ...current, projectType: option }))}
                    className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                      leadDraft.projectType === option ? 'border-zinc-900 bg-zinc-900 text-white' : chipClass
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className={`text-[11px] uppercase tracking-[0.18em] ${subtleTextClass}`}>servicio requerido</p>
              <div className="flex flex-wrap gap-2">
                {SERVICE_CATALOG.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setLeadDraft((current) => ({ ...current, service: service.label }))}
                    className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                      leadDraft.service === service.label ? 'border-zinc-900 bg-zinc-900 text-white' : chipClass
                    }`}
                  >
                    {service.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={leadDraft.location}
                onChange={(event) => setLeadDraft((current) => ({ ...current, location: event.target.value }))}
                placeholder="Ciudad o zona del proyecto"
                className={`rounded-full border px-3 py-2 text-sm outline-none ${inputClass}`}
              />
              <div className="flex flex-wrap gap-2">
                {TIMELINE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLeadDraft((current) => ({ ...current, timeline: option }))}
                    className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                      leadDraft.timeline === option ? 'border-zinc-900 bg-zinc-900 text-white' : chipClass
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className={`text-[11px] uppercase tracking-[0.18em] ${subtleTextClass}`}>canal preferido</p>
              <div className="flex flex-wrap gap-2">
                {CONTACT_CHANNEL_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setLeadDraft((current) => ({ ...current, preferredContactChannel: option.id }))}
                    className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                      leadDraft.preferredContactChannel === option.id ? 'border-zinc-900 bg-zinc-900 text-white' : chipClass
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs leading-relaxed">
              <input
                type="checkbox"
                checked={leadDraft.contactConsent}
                onChange={(event) => setLeadDraft((current) => ({ ...current, contactConsent: event.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300"
              />
              <span className={subtleTextClass}>Autorizo que el equipo de {companyName} me contacte para continuar esta consulta.</span>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleQualificationSubmit}
                disabled={!qualificationReady}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {leadReadiness.actionLabel}
                <ArrowUpRight className="h-4 w-4" />
              </button>
              {whatsappQuoteHref && leadDraft.preferredContactChannel === 'whatsapp' && handoffReady ? (
                <button
                  type="button"
                  onClick={() => window.open(whatsappQuoteHref, '_blank', 'noopener,noreferrer')}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${chipClass}`}
                >
                  Enviar por WhatsApp
                </button>
              ) : null}
              {whatsappHref ? (
                <button
                  type="button"
                  onClick={() => window.open(whatsappHref, '_blank', 'noopener,noreferrer')}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${chipClass}`}
                >
                  WhatsApp directo
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {promptChips.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => submitQuery(prompt.query)}
              className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${chipClass}`}
            >
              {prompt.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className={`flex items-center gap-2 rounded-full border px-3 py-2 ${inputClass}`}>
          <MessageCircleMore className="h-4 w-4 shrink-0 opacity-70" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Preguntanos que construimos o que servicio necesitas..."
            className="w-full bg-transparent text-sm outline-none"
          />
          <button
            type="submit"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/14 transition-colors hover:bg-white/10"
            aria-label="Enviar consulta"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <button type="button" onClick={() => handleCta('chat')} className={`font-mono transition-colors hover:opacity-100 ${subtleTextClass}`}>
            abrir chat comercial
          </button>
          <button type="button" onClick={() => handleCta('projects')} className={`font-mono transition-colors hover:opacity-100 ${subtleTextClass}`}>
            ver proyectos
          </button>
          {whatsappHref ? (
            <button type="button" onClick={() => handleCta('whatsapp')} className={`font-mono transition-colors hover:opacity-100 ${subtleTextClass}`}>
              whatsapp
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
