import { NextResponse } from 'next/server'
import { isAdminConfigured, setAdminSessionCookie, verifyAdminPassword } from '@/lib/admin-auth'

export async function POST(request: Request) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json(
        { error: 'Admin no configurado. Define ADMIN_PASSWORD en el servidor.' },
        { status: 503 },
      )
    }

    const body = await request.json()
    const password = typeof body.password === 'string' ? body.password : ''

    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ error: 'Credenciales invalidas' }, { status: 401 })
    }

    const response = NextResponse.json({ success: true })
    setAdminSessionCookie(response)
    return response
  } catch (error) {
    console.error('Error during admin login:', error)
    return NextResponse.json({ error: 'No se pudo iniciar sesion' }, { status: 500 })
  }
}
