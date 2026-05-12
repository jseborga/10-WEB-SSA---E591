import { generateAutomationResponse } from '@/lib/automation-ai'
import { db } from '@/lib/db'
import { parseLineList, type PublicProject, type PublicSiteSettings } from '@/lib/public-site'

type HeroMessageCacheEntry = {
  expiresAt: number
  messages: string[]
}

const HERO_MESSAGE_CACHE_TTL_MS = 1000 * 60 * 60 * 6
const HERO_MESSAGE_TIMEOUT_MS = 2400

const globalHeroMessageCache = globalThis as typeof globalThis & {
  __ssaHeroMessageCache?: Map<string, HeroMessageCacheEntry>
}

const heroMessageCache = globalHeroMessageCache.__ssaHeroMessageCache ?? new Map<string, HeroMessageCacheEntry>()
globalHeroMessageCache.__ssaHeroMessageCache = heroMessageCache

function uniqueShortMessages(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim().replace(/^[-*•\d.\s]+/, '').replace(/^["']|["']$/g, ''))
        .filter(Boolean)
        .map((value) => value.slice(0, 48)),
    ),
  ).slice(0, 14)
}

function extractJsonBlock(raw: string) {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i)

  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')

  if (start >= 0 && end > start) {
    return raw.slice(start, end + 1)
  }

  return raw.trim()
}

function buildFallbackMessages(siteSettings?: PublicSiteSettings, projects: PublicProject[] = []) {
  const configured = parseLineList(siteSettings?.heroMessages)
  const categoryHints = projects
    .map((project) => project.category?.trim() || '')
    .filter(Boolean)
    .slice(0, 4)
    .map((value) => value.replace(/[-_]+/g, ' '))

  return uniqueShortMessages([
    ...configured,
    siteSettings?.companyName?.trim() || 'SSA Ingenieria',
    siteSettings?.tagline?.trim() || 'soluciones integrales',
    'obra en curso',
    'datos y ejecucion',
    'supervision tecnica',
    ...categoryHints,
  ])
}

function parseAiMessages(raw: string, fallback: string[]) {
  const cleaned = extractJsonBlock(raw)

  try {
    const parsed = JSON.parse(cleaned) as { messages?: unknown } | unknown[]
    const candidateList = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed && Array.isArray((parsed as { messages?: unknown }).messages)
        ? (parsed as { messages: unknown[] }).messages
        : []

    const normalized = uniqueShortMessages(candidateList.filter((item): item is string => typeof item === 'string'))
    return normalized.length > 0 ? normalized : fallback
  } catch {
    const normalized = uniqueShortMessages(cleaned.split('\n'))
    return normalized.length > 0 ? normalized : fallback
  }
}

function buildCacheKey(siteSettings?: PublicSiteSettings, projects: PublicProject[] = []) {
  return JSON.stringify({
    companyName: siteSettings?.companyName || '',
    tagline: siteSettings?.tagline || '',
    configuredMessages: siteSettings?.heroMessages || '',
    categories: projects.slice(0, 6).map((project) => project.category || ''),
    titles: projects.slice(0, 4).map((project) => project.title || ''),
  })
}

export async function getHeroAiMessages(siteSettings?: PublicSiteSettings, projects: PublicProject[] = []) {
  const fallback = buildFallbackMessages(siteSettings, projects)
  const cacheKey = buildCacheKey(siteSettings, projects)
  const cached = heroMessageCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.messages
  }

  const config = await db.chatConfig.findFirst({
    orderBy: { createdAt: 'asc' },
  }).catch(() => null)

  if (!config) {
    return fallback
  }

  const projectContext = projects
    .slice(0, 6)
    .map((project) => ({
      title: project.title,
      category: project.category,
      location: project.location,
    }))

  const prompt = [
    'Genera mensajes muy cortos para un hero de portada de una empresa de ingenieria y construccion.',
    'El efecto visual sera de tipeo retro estilo terminal.',
    'Devuelve solo JSON valido con esta forma exacta:',
    '{ "messages": ["mensaje 1", "mensaje 2"] }',
    'Reglas:',
    '- Usa espanol neutro.',
    '- Crea entre 10 y 14 mensajes.',
    '- Cada mensaje debe tener entre 1 y 4 palabras.',
    '- Tono tecnico, sobrio y moderno.',
    '- Deben sentirse escritos por una IA en tiempo real.',
    '- No uses emojis, hashtags, comillas internas ni puntuacion final.',
    '- No repitas mensajes.',
    '',
    'Contexto del sitio:',
    JSON.stringify(
      {
        companyName: siteSettings?.companyName || 'SSA Ingenieria',
        tagline: siteSettings?.tagline || '',
        categories: parseLineList(siteSettings?.projectCategories).slice(0, 8),
        configuredMessages: parseLineList(siteSettings?.heroMessages).slice(0, 8),
        projects: projectContext,
      },
      null,
      2,
    ),
  ].join('\n')

  try {
    const result = await Promise.race([
      generateAutomationResponse(config, prompt).then((response) => response.output),
      new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('Hero AI timeout')), HERO_MESSAGE_TIMEOUT_MS)
      }),
    ])

    const messages = parseAiMessages(result, fallback)
    heroMessageCache.set(cacheKey, {
      expiresAt: Date.now() + HERO_MESSAGE_CACHE_TTL_MS,
      messages,
    })
    return messages
  } catch {
    return fallback
  }
}
