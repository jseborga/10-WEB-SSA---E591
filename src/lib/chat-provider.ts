import ZAI from 'z-ai-web-dev-sdk'

type ChatRole = 'user' | 'assistant'

type ChatMessage = {
  role: ChatRole
  content: string
}

type ProviderConfig = {
  provider: string
  apiKey?: string | null
  apiBaseUrl?: string | null
  model?: string | null
  systemPrompt: string
  temperature: number
  maxTokens: number
}

const DEFAULT_MODELS = {
  default: 'default',
  openai: 'gpt-4o-mini',
  'openai-compatible': 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.5-flash',
} as const

function normalizeProvider(provider: string | null | undefined) {
  const normalized = (provider || 'default').trim().toLowerCase()

  switch (normalized) {
    case 'z-ai':
    case 'zai':
      return 'default'
    case 'openai-compatible':
    case 'openai_compatible':
    case 'compatible':
    case 'custom':
      return 'openai-compatible'
    case 'gemini':
      return 'google'
    case 'claude':
      return 'anthropic'
    default:
      return normalized || 'default'
  }
}

function getDefaultModel(provider: keyof typeof DEFAULT_MODELS) {
  return DEFAULT_MODELS[provider]
}

function trimValue(value?: string | null) {
  return value?.trim() || ''
}

function ensureJsonHeaders(headers: Record<string, string>) {
  return {
    'Content-Type': 'application/json',
    ...headers,
  }
}

async function parseErrorResponse(response: Response) {
  const text = await response.text()

  try {
    const json = JSON.parse(text)
    return json.error?.message || json.error || json.message || text
  } catch {
    return text
  }
}

function getProviderApiKey(provider: string, config: ProviderConfig) {
  if (trimValue(config.apiKey)) {
    return trimValue(config.apiKey)
  }

  switch (provider) {
    case 'openai':
      return trimValue(process.env.OPENAI_API_KEY)
    case 'openai-compatible':
      return trimValue(process.env.OPENAI_COMPAT_API_KEY)
    case 'anthropic':
      return trimValue(process.env.ANTHROPIC_API_KEY)
    case 'google':
      return trimValue(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
    default:
      return ''
  }
}

function getProviderBaseUrl(provider: string, config: ProviderConfig) {
  const configuredBase = trimValue(config.apiBaseUrl)

  switch (provider) {
    case 'openai':
      return configuredBase || trimValue(process.env.OPENAI_BASE_URL) || 'https://api.openai.com/v1'
    case 'openai-compatible':
      return configuredBase || trimValue(process.env.OPENAI_COMPAT_BASE_URL) || 'http://localhost:11434/v1'
    case 'anthropic':
      return configuredBase || trimValue(process.env.ANTHROPIC_BASE_URL) || 'https://api.anthropic.com/v1'
    case 'google':
      return configuredBase || trimValue(process.env.GEMINI_BASE_URL) || 'https://generativelanguage.googleapis.com/v1beta'
    default:
      return configuredBase
  }
}

function buildOpenAiMessages(systemPrompt: string, history: ChatMessage[], message: string) {
  return [
    { role: 'system', content: systemPrompt },
    ...history.map((item) => ({
      role: item.role,
      content: item.content,
    })),
    { role: 'user', content: message },
  ]
}

function buildAnthropicMessages(history: ChatMessage[], message: string) {
  return [
    ...history.map((item) => ({
      role: item.role,
      content: item.content,
    })),
    { role: 'user', content: message },
  ]
}

function buildGoogleContents(history: ChatMessage[], message: string) {
  return [
    ...history.map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content }],
    })),
    {
      role: 'user',
      parts: [{ text: message }],
    },
  ]
}

function getTextFromOpenAiContent(content: unknown) {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }

        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text
        }

        return ''
      })
      .join('\n')
      .trim()
  }

  return ''
}

async function generateWithOpenAiCompatible(
  provider: 'openai' | 'openai-compatible',
  config: ProviderConfig,
  history: ChatMessage[],
  message: string,
) {
  const apiKey = getProviderApiKey(provider, config)
  const baseUrl = getProviderBaseUrl(provider, config)
  const model = trimValue(config.model) || getDefaultModel(provider)

  const endpoint = baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl.replace(/\/$/, '')}/chat/completions`

  const headers = ensureJsonHeaders(
    apiKey
      ? {
          Authorization: `Bearer ${apiKey}`,
        }
      : {},
  )

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: buildOpenAiMessages(config.systemPrompt, history, message),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    }),
  })

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response))
  }

  const data = await response.json()

  return getTextFromOpenAiContent(data.choices?.[0]?.message?.content)
}

async function generateWithAnthropic(config: ProviderConfig, history: ChatMessage[], message: string) {
  const apiKey = getProviderApiKey('anthropic', config)
  const baseUrl = getProviderBaseUrl('anthropic', config)
  const model = trimValue(config.model) || getDefaultModel('anthropic')
  const endpoint = baseUrl.endsWith('/messages') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/messages`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: ensureJsonHeaders({
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }),
    body: JSON.stringify({
      model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: config.systemPrompt,
      messages: buildAnthropicMessages(history, message),
    }),
  })

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response))
  }

  const data = await response.json()

  return (data.content || [])
    .map((part: { text?: string }) => part.text || '')
    .join('\n')
    .trim()
}

async function generateWithGoogle(config: ProviderConfig, history: ChatMessage[], message: string) {
  const apiKey = getProviderApiKey('google', config)
  const baseUrl = getProviderBaseUrl('google', config).replace(/\/$/, '')
  const model = trimValue(config.model) || getDefaultModel('google')
  const endpoint = `${baseUrl}/models/${model}:generateContent`

  const headers = ensureJsonHeaders(
    apiKey
      ? {
          'x-goog-api-key': apiKey,
        }
      : {},
  )

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contents: buildGoogleContents(history, message),
      systemInstruction: {
        parts: [{ text: config.systemPrompt }],
      },
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response))
  }

  const data = await response.json()

  return (data.candidates?.[0]?.content?.parts || [])
    .map((part: { text?: string }) => part.text || '')
    .join('\n')
    .trim()
}

async function generateWithZAI(config: ProviderConfig, history: ChatMessage[], message: string) {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: config.systemPrompt },
      ...history.map((item) => ({
        role: item.role,
        content: item.content,
      })),
      { role: 'user', content: message },
    ],
    thinking: { type: 'disabled' },
  })

  return completion.choices?.[0]?.message?.content || ''
}

export async function generateChatResponse(config: ProviderConfig, history: ChatMessage[], message: string) {
  const provider = normalizeProvider(config.provider)

  switch (provider) {
    case 'default':
      return generateWithZAI(config, history, message)
    case 'openai':
    case 'openai-compatible':
      return generateWithOpenAiCompatible(provider, config, history, message)
    case 'anthropic':
      return generateWithAnthropic(config, history, message)
    case 'google':
      return generateWithGoogle(config, history, message)
    default:
      throw new Error(`Proveedor no soportado: ${provider}`)
  }
}
