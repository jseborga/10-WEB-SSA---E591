import { db } from '@/lib/db'
import { sendConfiguredTelegramText } from '@/lib/telegram-notify'

function getUserLabel(user: { username: string; displayName?: string | null }) {
  return (user.displayName || user.username || '').trim()
}

function normalizeText(value: string | null | undefined) {
  return (value || '').trim()
}

function normalizeDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function selectBestAssignableUser() {
  const users = await db.adminUser.findMany({
    where: {
      active: true,
      receiveLeadAlerts: true,
    },
    orderBy: [{ role: 'asc' }, { username: 'asc' }],
  })

  if (users.length === 0) {
    return null
  }

  const openLeads = await db.leadCapture.findMany({
    where: {
      leadStatus: {
        notIn: ['won', 'lost', 'archived'],
      },
    },
    select: {
      ownerName: true,
    },
  })

  const openContacts = await db.contact.findMany({
    where: {
      status: {
        notIn: ['won', 'lost', 'archived'],
      },
    },
    select: {
      ownerName: true,
    },
  })

  const loadMap = new Map<string, number>()

  for (const item of [...openLeads, ...openContacts]) {
    const key = normalizeText(item.ownerName)
    if (!key) continue
    loadMap.set(key, (loadMap.get(key) || 0) + 1)
  }

  const ranked = users
    .map((user) => {
      const label = getUserLabel(user)
      const activeLoad = loadMap.get(label) || 0
      const normalizedCapacity = Math.max(1, user.workloadCapacity || 1)

      return {
        user,
        label,
        activeLoad,
        normalizedCapacity,
        score: activeLoad / normalizedCapacity,
      }
    })
    .sort((a, b) => a.score - b.score || a.activeLoad - b.activeLoad || a.label.localeCompare(b.label, 'es'))

  return ranked[0] || null
}

export async function findAssignableUserByOwnerName(ownerName: string | null | undefined) {
  const normalized = normalizeText(ownerName).toLowerCase()

  if (!normalized) {
    return null
  }

  const users = await db.adminUser.findMany({
    where: { active: true },
    orderBy: [{ role: 'asc' }, { username: 'asc' }],
  })

  return (
    users.find((user) => normalizeText(user.displayName).toLowerCase() === normalized) ||
    users.find((user) => user.username.toLowerCase() === normalized) ||
    null
  )
}

export async function notifyUserAssignment(input: {
  ownerName: string | null | undefined
  title: string
  summary?: string | null
  preferredChannel?: string | null
  contactName?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  contactTelegram?: string | null
  nextAction?: string | null
  sourceLabel?: string | null
}) {
  const user = await findAssignableUserByOwnerName(input.ownerName)

  if (!user?.telegramChatId) {
    return { sent: false, reason: 'no-telegram-chat' as const }
  }

  const lines = [
    `Asignacion CRM: ${input.title}`,
    input.sourceLabel ? `Origen: ${input.sourceLabel}` : null,
    input.contactName ? `Cliente: ${input.contactName}` : null,
    input.contactPhone ? `Telefono: ${input.contactPhone}` : null,
    input.contactEmail ? `Correo: ${input.contactEmail}` : null,
    input.contactTelegram ? `Telegram: ${input.contactTelegram}` : null,
    input.preferredChannel ? `Canal recomendado: ${input.preferredChannel}` : null,
    input.nextAction ? `Proxima accion: ${input.nextAction}` : null,
    input.summary ? '' : null,
    input.summary ? `Resumen: ${input.summary}` : null,
  ].filter(Boolean)

  return sendConfiguredTelegramText([user.telegramChatId], lines.join('\n'))
}

export function buildAnalyticsManagerPrompt(input: {
  siteName: string
  periodLabel: string
  trafficSummary: string
  crmSummary: string
  contentSummary: string
}) {
  return [
    'Actua como gerente comercial y de marketing digital para una empresa de ingenieria y construccion.',
    'Debes escribir un informe gerencial claro, breve y accionable con foco en trafico web, conversion comercial y priorizacion de oportunidades.',
    'No inventes cifras. Usa solo los datos entregados.',
    'Devuelve Markdown en español con estas secciones:',
    '1. Resumen ejecutivo',
    '2. Hallazgos de trafico y origen',
    '3. Hallazgos comerciales y CRM',
    '4. Riesgos y cuellos de botella',
    '5. Recomendaciones accionables para la siguiente semana',
    '',
    `Empresa: ${input.siteName}`,
    `Periodo: ${input.periodLabel}`,
    '',
    'Resumen de trafico:',
    input.trafficSummary,
    '',
    'Resumen de CRM:',
    input.crmSummary,
    '',
    'Resumen de contenido:',
    input.contentSummary,
  ].join('\n')
}

export function summarizeRecentAnalytics(
  sessions: Array<{
    landingPath: string | null
    referrer: string | null
    countryHint: string | null
    utmSource: string | null
    utmCampaign: string | null
    durationSeconds: number
    pageViews: number
  }>,
) {
  const pageMap = new Map<string, number>()
  const referrerMap = new Map<string, number>()
  const countryMap = new Map<string, number>()
  const utmMap = new Map<string, number>()

  let durationTotal = 0
  let pageViewsTotal = 0

  for (const session of sessions) {
    const page = normalizeText(session.landingPath) || '/'
    const referrer = normalizeText(session.referrer) || 'directo'
    const country = normalizeText(session.countryHint) || 'sin-pais'
    const utm = normalizeText(session.utmCampaign) || normalizeText(session.utmSource) || 'organico/directo'

    pageMap.set(page, (pageMap.get(page) || 0) + 1)
    referrerMap.set(referrer, (referrerMap.get(referrer) || 0) + 1)
    countryMap.set(country, (countryMap.get(country) || 0) + 1)
    utmMap.set(utm, (utmMap.get(utm) || 0) + 1)
    durationTotal += session.durationSeconds || 0
    pageViewsTotal += session.pageViews || 0
  }

  const topList = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => `${label}: ${count}`)
      .join(', ') || 'Sin datos'

  return [
    `Sesiones: ${sessions.length}`,
    `Paginas vistas acumuladas: ${pageViewsTotal}`,
    `Permanencia media: ${sessions.length ? Math.round(durationTotal / sessions.length) : 0} s`,
    `Top paginas: ${topList(pageMap)}`,
    `Top origenes: ${topList(referrerMap)}`,
    `Top paises: ${topList(countryMap)}`,
    `Top campanas/fuentes: ${topList(utmMap)}`,
  ].join('\n')
}

export function summarizeCrmForManager(input: {
  totalLeads: number
  openLeads: number
  wonLeads: number
  dueToday: number
  needsHuman: number
  contacts: number
}) {
  return [
    `Leads totales: ${input.totalLeads}`,
    `Leads abiertos: ${input.openLeads}`,
    `Leads ganados: ${input.wonLeads}`,
    `Seguimientos vencidos/hoy: ${input.dueToday}`,
    `Casos que requieren humano: ${input.needsHuman}`,
    `Contactos de formulario: ${input.contacts}`,
  ].join('\n')
}

export function summarizeContentForManager(input: {
  publishedProjects: number
  draftProjects: number
  publishedPages: number
  pendingReviews: number
}) {
  return [
    `Proyectos publicados: ${input.publishedProjects}`,
    `Proyectos en borrador: ${input.draftProjects}`,
    `Paginas publicadas: ${input.publishedPages}`,
    `Solicitudes pendientes: ${input.pendingReviews}`,
  ].join('\n')
}

export function isFollowUpDue(value: Date | string | null | undefined) {
  const date = normalizeDate(value)
  return Boolean(date && date.getTime() <= Date.now())
}
