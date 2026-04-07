import { NextResponse } from 'next/server'
import { isAdminConfigured, setAdminSessionCookie, verifyLoginCredentials } from '@/lib/admin-auth'

export async function POST(request: Request) {
  try {
    if (!(await isAdminConfigured())) {
      return NextResponse.json(
        { error: 'Admin no configurado. Define ADMIN_PASSWORD o crea un usuario administrador.' },
        { status: 503 },
      )
    }

    const body = await request.json()
    const username = typeof body.username === 'string' ? body.username : 'admin'
    const password = typeof body.password === 'string' ? body.password : ''

    const session = await verifyLoginCredentials(username, password)

    if (!session) {
      return NextResponse.json({ error: 'Credenciales invalidas' }, { status: 401 })
    }

    const response = NextResponse.json({ success: true, role: session.role, username: session.username })
    setAdminSessionCookie(response, session)
    return response
  } catch (error) {
    console.error('Error during admin login:', error)
    return NextResponse.json({ error: 'No se pudo iniciar sesion' }, { status: 500 })
  }
}
