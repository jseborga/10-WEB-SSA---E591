import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'

type ConversationItem = {
  sessionId: string
  name: string
  email: string | null
  startedAt: Date
  lastMessageAt: Date
  unreadCount: number
  messages: Array<{
    id: string
    name: string
    message: string
    isFromAdmin: boolean
    isFromAI: boolean
    createdAt: Date
  }>
}

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const messages = await db.chatMessage.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: 400,
    })

    const grouped = new Map<string, ConversationItem>()

    for (const message of messages) {
      const existing = grouped.get(message.sessionId)

      if (!existing) {
        grouped.set(message.sessionId, {
          sessionId: message.sessionId,
          name: message.name || 'Visitante',
          email: message.email || null,
          startedAt: message.createdAt,
          lastMessageAt: message.createdAt,
          unreadCount: !message.isFromAdmin && !message.isRead ? 1 : 0,
          messages: [
            {
              id: message.id,
              name: message.name,
              message: message.message,
              isFromAdmin: message.isFromAdmin,
              isFromAI: message.isFromAI,
              createdAt: message.createdAt,
            },
          ],
        })
        continue
      }

      existing.startedAt = message.createdAt < existing.startedAt ? message.createdAt : existing.startedAt
      existing.lastMessageAt = message.createdAt > existing.lastMessageAt ? message.createdAt : existing.lastMessageAt

      if (!existing.email && message.email) {
        existing.email = message.email
      }

      if (!existing.name || existing.name === 'Visitante') {
        existing.name = message.name || existing.name
      }

      if (!message.isFromAdmin && !message.isRead) {
        existing.unreadCount += 1
      }

      existing.messages.push({
        id: message.id,
        name: message.name,
        message: message.message,
        isFromAdmin: message.isFromAdmin,
        isFromAI: message.isFromAI,
        createdAt: message.createdAt,
      })
    }

    const conversations = Array.from(grouped.values())
      .map((item) => ({
        ...item,
        messages: item.messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(-20),
      }))
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())

    return NextResponse.json(conversations)
  } catch (error) {
    console.error('Error loading chat conversations:', error)
    return NextResponse.json({ error: 'No se pudieron cargar las conversaciones del chat' }, { status: 500 })
  }
}
