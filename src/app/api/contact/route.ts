import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'

// GET - Obtener todos los contactos
export async function GET(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const contacts = await db.contact.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(contacts)
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json(
      { error: 'Error al obtener contactos' },
      { status: 500 }
    )
  }
}

// POST - Crear nuevo contacto (formulario de contacto)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, phone, subject, message } = body

    const contact = await db.contact.create({
      data: {
        name,
        email,
        phone,
        subject,
        message
      }
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    console.error('Error creating contact:', error)
    return NextResponse.json(
      { error: 'Error al enviar mensaje' },
      { status: 500 }
    )
  }
}
