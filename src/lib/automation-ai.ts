import { generateChatResponse } from '@/lib/chat-provider'

export type AutomationProviderConfig = {
  provider: string
  apiKey?: string | null
  apiBaseUrl?: string | null
  model?: string | null
  systemPrompt: string
  temperature: number
  maxTokens: number
}

type AutomationConfigSource = {
  provider?: string | null
  apiKey?: string | null
  apiBaseUrl?: string | null
  model?: string | null
  automationProvider?: string | null
  automationApiKey?: string | null
  automationApiBaseUrl?: string | null
  automationModel?: string | null
  automationFallbackProvider?: string | null
  automationFallbackApiKey?: string | null
  automationFallbackApiBaseUrl?: string | null
  automationFallbackModel?: string | null
  systemPrompt?: string | null
  temperature?: number | null
  maxTokens?: number | null
}

function trimValue(value?: string | null) {
  return value?.trim() || ''
}

function normalizeProvider(value?: string | null) {
  return trimValue(value).toLowerCase()
}

function isSameConfig(a: AutomationProviderConfig, b: AutomationProviderConfig) {
  return (
    normalizeProvider(a.provider) === normalizeProvider(b.provider) &&
    trimValue(a.apiKey) === trimValue(b.apiKey) &&
    trimValue(a.apiBaseUrl) === trimValue(b.apiBaseUrl) &&
    trimValue(a.model) === trimValue(b.model)
  )
}

function buildProviderConfig(
  input: {
    provider?: string | null
    apiKey?: string | null
    apiBaseUrl?: string | null
    model?: string | null
  },
  defaults: AutomationConfigSource,
): AutomationProviderConfig {
  return {
    provider: trimValue(input.provider) || trimValue(defaults.provider) || 'google',
    apiKey: trimValue(input.apiKey) || trimValue(defaults.apiKey) || null,
    apiBaseUrl: trimValue(input.apiBaseUrl) || trimValue(defaults.apiBaseUrl) || null,
    model: trimValue(input.model) || trimValue(defaults.model) || null,
    systemPrompt:
      trimValue(defaults.systemPrompt) ||
      'Eres un asistente operativo para un CRM de ingenieria y construccion. Resume oportunidades, propone siguientes pasos y ayuda al equipo comercial sin inventar datos.',
    temperature: typeof defaults.temperature === 'number' ? defaults.temperature : 0.3,
    maxTokens: typeof defaults.maxTokens === 'number' ? defaults.maxTokens : 700,
  }
}

export function buildAutomationProviderChain(config: AutomationConfigSource) {
  const primary = buildProviderConfig(
    {
      provider: config.automationProvider,
      apiKey: config.automationApiKey,
      apiBaseUrl: config.automationApiBaseUrl,
      model: config.automationModel,
    },
    config,
  )

  const fallback = buildProviderConfig(
    {
      provider: config.automationFallbackProvider,
      apiKey: config.automationFallbackApiKey,
      apiBaseUrl: config.automationFallbackApiBaseUrl,
      model: config.automationFallbackModel,
    },
    config,
  )

  return isSameConfig(primary, fallback) ? [primary] : [primary, fallback]
}

export async function generateAutomationResponse(config: AutomationConfigSource, prompt: string) {
  const providers = buildAutomationProviderChain(config)
  const attempts: string[] = []

  for (const provider of providers) {
    try {
      const output = await generateChatResponse(provider, [], prompt)
      return {
        output,
        provider: provider.provider,
        model: provider.model || null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown automation AI error'
      attempts.push(`${provider.provider}:${provider.model || 'default'} -> ${message}`)
    }
  }

  throw new Error(attempts.join(' | ') || 'No se pudo generar una respuesta con la IA operativa')
}
