import { NextResponse } from 'next/server'
import { getSessionFromRequest, requireAuthenticatedUser } from '@/lib/admin-auth'
import { buildAiImageInstruction, getAiImagePreset } from '@/lib/ai-image-presets'
import { db } from '@/lib/db'
import { readImageSize } from '@/lib/image-size'
import { toMediaAssetDTO } from '@/lib/media-assets'
import { createStoredFileName, getContentType, getMediaUrl, getStoredObject, saveUploadedFile } from '@/lib/media-storage'
import { consumeRateLimit, tooManyRequests } from '@/lib/rate-limit'

const DEFAULT_MODEL = 'gemini-2.5-flash-image'
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const MAX_INPUT_BYTES = 15 * 1024 * 1024
const GEMINI_INPUT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

type GeminiPart = {
  text?: string
  inlineData?: { mimeType?: string; data?: string }
  inline_data?: { mime_type?: string; data?: string }
}

function trim(value?: string | null) {
  return value?.trim() || ''
}

function isGoogleProvider(provider?: string | null) {
  const value = trim(provider).toLowerCase()
  return value === 'google' || value === 'gemini' || value === 'default' || value === ''
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunk = 0x8000

  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }

  return btoa(binary)
}

function base64ToBytes(data: string) {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function describeGeminiError(status: number, message: string, model: string) {
  if (status === 400 && /api key/i.test(message)) {
    return 'La clave de Google AI Studio no es válida. Revísala en Integraciones.'
  }
  if (status === 403) {
    return 'La clave de Google AI Studio no tiene permiso para este modelo. Revísala en Integraciones.'
  }
  if (status === 404) {
    return `El modelo "${model}" no existe o no está disponible para tu clave. Cambia el modelo de imagen en Integraciones.`
  }
  if (status === 429) {
    return 'Google AI Studio ha alcanzado su cuota. Espera unos minutos o revisa el plan de tu clave.'
  }
  return `Gemini no pudo procesar la imagen (${status}). ${message}`.trim().slice(0, 400)
}

export async function POST(request: Request) {
  const unauthorized = await requireAuthenticatedUser(request)
  if (unauthorized) return unauthorized

  try {
    const session = getSessionFromRequest(request)

    if (!(await consumeRateLimit(`ai-image-edit:${session?.username || 'anon'}`, 60, 60 * 60))) {
      return tooManyRequests('Has alcanzado el límite de 60 ediciones con IA por hora. Inténtalo más tarde.')
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const assetId = typeof body.assetId === 'string' ? body.assetId.trim() : ''
    const presetId = typeof body.preset === 'string' && getAiImagePreset(body.preset) ? body.preset : null
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 1000) : ''

    if (!assetId) {
      return NextResponse.json({ error: 'Falta la imagen a editar.' }, { status: 400 })
    }

    if (!presetId && !prompt) {
      return NextResponse.json({ error: 'Elige un estilo o describe el cambio que quieres.' }, { status: 400 })
    }

    const asset = await db.mediaAsset.findUnique({ where: { id: assetId } })

    if (!asset) {
      return NextResponse.json({ error: 'La imagen no existe en la biblioteca.' }, { status: 404 })
    }

    const config = await db.chatConfig.findFirst({ orderBy: { createdAt: 'asc' } })
    const apiKey =
      trim(config?.imageApiKey) ||
      trim(config?.automationApiKey) ||
      (isGoogleProvider(config?.provider) ? trim(config?.apiKey) : '') ||
      trim(process.env.GEMINI_API_KEY) ||
      trim(process.env.GOOGLE_API_KEY)

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Falta la clave de Google AI Studio. Añádela en Integraciones para usar Gemini.' },
        { status: 400 },
      )
    }

    const model = trim(config?.imageModel) || DEFAULT_MODEL
    const baseUrl = (trim(config?.imageApiBaseUrl) || DEFAULT_BASE_URL).replace(/\/$/, '')

    const key = asset.storagePath || asset.fileName
    const object = await getStoredObject(key)

    if (!object || !('body' in object)) {
      return NextResponse.json({ error: 'No se encontró el archivo original en el almacenamiento.' }, { status: 404 })
    }

    if (object.size > MAX_INPUT_BYTES) {
      return NextResponse.json(
        { error: 'La imagen pesa más de 15 MB. Redúcela primero en el editor (Guardar como nueva versión) y vuelve a intentarlo.' },
        { status: 413 },
      )
    }

    const mimeType = (object.httpMetadata?.contentType || asset.mimeType || getContentType(key)).toLowerCase()

    if (!GEMINI_INPUT_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: 'Gemini solo acepta JPG, PNG o WebP. Guarda primero una versión desde el editor y úsala.' },
        { status: 400 },
      )
    }

    const input = new Uint8Array(await object.arrayBuffer())
    const instruction = buildAiImageInstruction(presetId, prompt)

    const response = await fetch(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mimeType, data: bytesToBase64(input) } }, { text: instruction }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const raw = await response.text()
      let message = raw

      try {
        const json = JSON.parse(raw)
        message = json.error?.message || raw
      } catch {}

      console.error('Gemini image edit error:', response.status, message)
      return NextResponse.json({ error: describeGeminiError(response.status, String(message).slice(0, 300), model) }, { status: 502 })
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>
      promptFeedback?: { blockReason?: string }
    }

    const parts = data.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data)
    const imageData = imagePart?.inlineData?.data || imagePart?.inline_data?.data

    if (!imageData) {
      const text = parts.map((part) => part.text || '').join(' ').trim()
      const reason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason
      return NextResponse.json(
        {
          error: `Gemini no devolvió una imagen${reason ? ` (${reason})` : ''}. ${text ? `Respuesta: ${text.slice(0, 300)}` : 'Prueba con otra instrucción.'}`.trim(),
        },
        { status: 502 },
      )
    }

    const outputType = (imagePart?.inlineData?.mimeType || imagePart?.inline_data?.mime_type || 'image/png').toLowerCase()
    const output = base64ToBytes(imageData)
    const size = readImageSize(output)
    const baseName = (asset.originalName || asset.fileName).replace(/\.[a-z0-9]+$/i, '').slice(0, 40)
    const storedFileName = createStoredFileName(`${baseName}-ia-${presetId || 'custom'}`, outputType)

    await saveUploadedFile(storedFileName, output, outputType)

    const created = await db.mediaAsset.create({
      data: {
        source: 'ai',
        kind: 'image',
        fileName: storedFileName,
        originalName: `${baseName} (IA ${getAiImagePreset(presetId)?.label || 'personalizado'})`.slice(0, 200),
        mimeType: outputType,
        size: output.byteLength,
        url: getMediaUrl(storedFileName),
        storagePath: storedFileName,
        alt: asset.alt,
        width: size?.width ?? null,
        height: size?.height ?? null,
        parentId: asset.id,
        editRecipe: JSON.stringify({ preset: presetId, prompt: prompt || null, model }),
        metadata: session ? JSON.stringify({ uploadedBy: session.username }) : null,
      },
    })

    return NextResponse.json({ asset: toMediaAssetDTO(created), model })
  } catch (error) {
    console.error('Error editing image with AI:', error)
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    return NextResponse.json(
      { error: timedOut ? 'Gemini tardó demasiado en responder. Inténtalo de nuevo.' : 'No se pudo mejorar la imagen con IA.' },
      { status: timedOut ? 504 : 500 },
    )
  }
}
