import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const ADMIN_SESSION_COOKIE = 'ssa_admin_session'

const SESSION_MAX_AGE = 60 * 60 * 12

export type AuthRole = 'admin' | 'editor'

export type AuthSession = {
  username: string
  role: AuthRole
  root: boolean
}

type SessionPayload = AuthSession & {
  issuedAt: number
}

function getEnvValue(name: string) {
  return process.env[name]?.trim() ?? ''
}

function getAdminPassword() {
  return getEnvValue('ADMIN_PASSWORD')
}

function getAdminSessionSecret() {
  return getEnvValue('ADMIN_SESSION_SECRET') || getAdminPassword()
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
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

function encodeSessionPayload(payload: SessionPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeSessionPayload(payload: string) {
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<SessionPayload>

    if (
      typeof parsed.username !== 'string' ||
      (parsed.role !== 'admin' && parsed.role !== 'editor') ||
      typeof parsed.root !== 'boolean' ||
      typeof parsed.issuedAt !== 'number'
    ) {
      return null
    }

    return parsed as SessionPayload
  } catch {
    return null
  }
}

function createSessionToken(session: AuthSession) {
  const payload = encodeSessionPayload({
    ...session,
    issuedAt: Date.now(),
  })

  return `${payload}.${signSessionPayload(payload)}`
}

function verifyRootAdminPassword(password: string) {
  const expectedPassword = getAdminPassword()

  if (!expectedPassword) {
    return false
  }

  return safeCompare(password, expectedPassword)
}

export function hashUserPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyUserPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(':')

  if (!salt || !storedHash) {
    return false
  }

  const candidateHash = scryptSync(password, salt, 64).toString('hex')
  return safeCompare(candidateHash, storedHash)
}

export async function isAdminConfigured() {
  if (!getAdminSessionSecret()) {
    return false
  }

  if (getAdminPassword()) {
    return true
  }

  const activeUsers = await db.adminUser.count({
    where: { active: true },
  })

  return activeUsers > 0
}

export async function verifyLoginCredentials(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username || 'admin')

  if ((normalizedUsername === 'admin' || normalizedUsername.length === 0) && verifyRootAdminPassword(password)) {
    return {
      username: 'admin',
      role: 'admin' as const,
      root: true,
    }
  }

  const user = await db.adminUser.findUnique({
    where: { username: normalizedUsername },
  })

  if (!user || !user.active) {
    return null
  }

  if (!verifyUserPassword(password, user.passwordHash)) {
    return null
  }

  return {
    username: user.username,
    role: user.role === 'admin' ? ('admin' as const) : ('editor' as const),
    root: false,
  }
}

export function getSessionFromRequest(request: Request): AuthSession | null {
  const secret = getAdminSessionSecret()

  if (!secret) {
    return null
  }

  const token = parseCookieHeader(request.headers.get('cookie')).get(ADMIN_SESSION_COOKIE)

  if (!token) {
    return null
  }

  const [payload, signature] = token.split('.')

  if (!payload || !signature || !safeCompare(signature, signSessionPayload(payload))) {
    return null
  }

  const parsedPayload = decodeSessionPayload(payload)

  if (!parsedPayload) {
    return null
  }

  return {
    username: parsedPayload.username,
    role: parsedPayload.role,
    root: parsedPayload.root,
  }
}

export function isAdminAuthenticated(request: Request) {
  return getSessionFromRequest(request) !== null
}

export async function getAdminSessionStatus(request: Request) {
  const configured = await isAdminConfigured()
  const session = configured ? getSessionFromRequest(request) : null

  return {
    configured,
    authenticated: Boolean(session),
    role: session?.role ?? null,
    username: session?.username ?? null,
    root: session?.root ?? false,
  }
}

function configurationError() {
  return NextResponse.json(
    { error: 'Admin no configurado. Define ADMIN_PASSWORD o crea un usuario administrador.' },
    { status: 503 },
  )
}

export async function requireAuthenticatedUser(request: Request) {
  if (!(await isAdminConfigured())) {
    return configurationError()
  }

  if (!getSessionFromRequest(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  return null
}

export async function requireAdmin(request: Request) {
  if (!(await isAdminConfigured())) {
    return configurationError()
  }

  const session = getSessionFromRequest(request)

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
  }

  return null
}

export function setAdminSessionCookie(response: NextResponse, session: AuthSession) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: createSessionToken(session),
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
