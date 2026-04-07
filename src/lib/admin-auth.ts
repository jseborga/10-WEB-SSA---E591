import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

export const ADMIN_SESSION_COOKIE = 'ssa_admin_session'

const SESSION_PAYLOAD = 'authenticated'
const SESSION_MAX_AGE = 60 * 60 * 12

function getEnvValue(name: string) {
  return process.env[name]?.trim() ?? ''
}

function getAdminPassword() {
  return getEnvValue('ADMIN_PASSWORD')
}

function getAdminSessionSecret() {
  return getEnvValue('ADMIN_SESSION_SECRET') || getAdminPassword()
}

function parseCookieHeader(cookieHeader: string | null) {
  const cookies = new Map<string, string>()

  if (!cookieHeader) {
    return cookies
  }

  cookieHeader.split(';').forEach((entry) => {
    const separatorIndex = entry.indexOf('=')

    if (separatorIndex === -1) {
      return
    }

    const key = entry.slice(0, separatorIndex).trim()
    const value = entry.slice(separatorIndex + 1).trim()

    if (key) {
      cookies.set(key, decodeURIComponent(value))
    }
  })

  return cookies
}

function signSessionPayload(payload: string) {
  return createHmac('sha256', getAdminSessionSecret()).update(payload).digest('hex')
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function isAdminConfigured() {
  return Boolean(getAdminPassword())
}

export function verifyAdminPassword(password: string) {
  const expectedPassword = getAdminPassword()

  if (!expectedPassword) {
    return false
  }

  return safeCompare(password, expectedPassword)
}

export function createAdminSessionToken() {
  return `${SESSION_PAYLOAD}.${signSessionPayload(SESSION_PAYLOAD)}`
}

export function isAdminAuthenticated(request: Request) {
  const secret = getAdminSessionSecret()

  if (!secret) {
    return false
  }

  const token = parseCookieHeader(request.headers.get('cookie')).get(ADMIN_SESSION_COOKIE)

  if (!token) {
    return false
  }

  const [payload, signature] = token.split('.')

  if (!payload || !signature) {
    return false
  }

  return safeCompare(signature, signSessionPayload(payload))
}

export function getAdminSessionStatus(request: Request) {
  const configured = isAdminConfigured()

  return {
    configured,
    authenticated: configured && isAdminAuthenticated(request),
  }
}

export function requireAdmin(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'Admin no configurado. Define ADMIN_PASSWORD en el servidor.' },
      { status: 503 },
    )
  }

  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  return null
}

export function setAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: createAdminSessionToken(),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}
