import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')?.trim()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 })
    }

    const messages = await db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 120,
    })

    return NextResponse.json(
      messages.map((item) => ({
        id: item.id,
        sessionId: item.sessionId,
        name: item.name,
        content: item.message,
        timestamp: item.createdAt,
        type: item.isFromAdmin ? 'admin' : 'visitor',
        isFromAI: item.isFromAI,
      })),
    )
  } catch (error) {
    console.error('Error loading chat history:', error)
    return NextResponse.json({ error: 'No se pudo cargar el historial del chat' }, { status: 500 })
  }
}
