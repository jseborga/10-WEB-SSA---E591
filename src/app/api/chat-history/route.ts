import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CHAT_SESSION_ID_PATTERN } from '@/lib/rate-limit'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')?.trim()

    // El sessionId es un UUID aleatorio que solo conoce el navegador del visitante.
    if (!sessionId || !CHAT_SESSION_ID_PATTERN.test(sessionId)) {
      return NextResponse.json({ error: 'sessionId inválido' }, { status: 400 })
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
