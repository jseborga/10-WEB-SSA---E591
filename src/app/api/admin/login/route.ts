import { NextResponse } from 'next/server'
import { isAdminConfigured, setAdminSessionCookie, verifyLoginCredentials } from '@/lib/admin-auth'
import { consumeRateLimit, getClientIp, resetRateLimit, tooManyRequests } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    if (!(await isAdminConfigured())) {
      return NextResponse.json(
        { error: 'Admin no configurado. Define ADMIN_SESSION_SECRET (32+ caracteres) y ADMIN_PASSWORD.' },
        { status: 503 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const username = typeof body.username === 'string' ? body.username.slice(0, 120) : 'admin'
    const password = typeof body.password === 'string' ? body.password.slice(0, 500) : ''
    const ipKey = `login:ip:${getClientIp(request)}`
    const userKey = `login:user:${username.trim().toLowerCase() || 'admin'}`

    if (!(await consumeRateLimit(ipKey, 10, 15 * 60)) || !(await consumeRateLimit(userKey, 10, 15 * 60))) {
      return tooManyRequests('Demasiados intentos de acceso. Espera 15 minutos.')
    }

    const session = await verifyLoginCredentials(username, password)

    if (!session) {
      return NextResponse.json({ error: 'Credenciales invalidas' }, { status: 401 })
    }

    await resetRateLimit(userKey)
    const response = NextResponse.json({ success: true, role: session.role, username: session.username })
    setAdminSessionCookie(response, session)
    return response
  } catch (error) {
    console.error('Error during admin login:', error)
    return NextResponse.json({ error: 'No se pudo iniciar sesion' }, { status: 500 })
  }
}
