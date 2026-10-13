/**
 * fetch para URLs que vienen del usuario. Bloquea destinos internos (localhost, IPs privadas,
 * metadata de nubes) y valida cada redirección manualmente.
 */

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal', 'metadata'])

function isPrivateIPv4(hostname: string) {
  const parts = hostname.split('.').map((part) => Number(part))

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }

  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  )
}

export function isPublicHttpUrl(value: string) {
  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    return false
  }

  if (hostname.includes(':')) {
    // IPv6 literal: solo se permiten direcciones globales.
    return !(hostname === '::1' || hostname === '::' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80') || hostname.startsWith('::ffff:'))
  }

  return !isPrivateIPv4(hostname)
}

export async function safeFetch(url: string, init: RequestInit = {}, maxRedirects = 4) {
  let current = url

  for (let attempt = 0; attempt <= maxRedirects; attempt += 1) {
    if (!isPublicHttpUrl(current)) {
      throw new Error('La URL apunta a un destino no permitido.')
    }

    const response = await fetch(current, { ...init, redirect: 'manual' })

    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      current = new URL(response.headers.get('location')!, current).toString()
      continue
    }

    return response
  }

  throw new Error('Demasiadas redirecciones.')
}
