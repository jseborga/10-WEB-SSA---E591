import { db } from '@/lib/db'

/** IP del cliente según Cloudflare (no se puede falsificar detrás de su proxy). */
export function getClientIp(request: Request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown'
}

/**
 * Ventana fija persistida en D1. Devuelve `true` si la petición está permitida.
 * Si la base falla se permite la petición: el límite protege costes, no la disponibilidad.
 */
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const now = new Date()

  try {
    const bucket = await db.rateLimitBucket.findUnique({ where: { key } })

    if (!bucket || bucket.resetAt <= now) {
      const resetAt = new Date(now.getTime() + windowSeconds * 1000)
      await db.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      })
      return true
    }

    if (bucket.count >= limit) {
      return false
    }

    await db.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } })
    return true
  } catch (error) {
    console.error('Rate limit error:', error)
    return true
  }
}

export async function resetRateLimit(key: string) {
  await db.rateLimitBucket.delete({ where: { key } }).catch(() => undefined)
}

export function tooManyRequests(message = 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.') {
  return Response.json({ error: message }, { status: 429, headers: { 'Retry-After': '300' } })
}

export const CHAT_SESSION_ID_PATTERN = /^session_[0-9a-f-]{36}$/
