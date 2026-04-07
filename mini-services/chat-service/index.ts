import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface ChatSession {
  id: string
  name: string
  email?: string
  lastMessage: Date
}

interface Message {
  id: string
  sessionId: string
  name: string
  content: string
  timestamp: Date
  type: 'visitor' | 'admin'
}

// Almacenamiento en memoria para las sesiones activas
const sessions = new Map<string, ChatSession>()
const messageHistory = new Map<string, Message[]>()

const generateId = () => Math.random().toString(36).substr(2, 9)

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Unirse a una sesión de chat
  socket.on('join-session', (data: { sessionId?: string; name: string; email?: string }) => {
    const sessionId = data.sessionId || generateId()
    
    const session: ChatSession = {
      id: sessionId,
      name: data.name,
      email: data.email,
      lastMessage: new Date()
    }
    
    sessions.set(sessionId, session)
    socket.join(sessionId)
    socket.data.sessionId = sessionId
    
    // Enviar historial de mensajes si existe
    const history = messageHistory.get(sessionId) || []
    socket.emit('session-history', { sessionId, messages: history })
    
    // Notificar a los administradores
    socket.broadcast.emit('new-session', session)
    
    console.log(`Session ${sessionId} joined by ${data.name}`)
  })

  // Enviar mensaje
  socket.on('send-message', (data: { content: string }) => {
    const sessionId = socket.data.sessionId
    if (!sessionId) return
    
    const session = sessions.get(sessionId)
    if (!session) return
    
    const message: Message = {
      id: generateId(),
      sessionId,
      name: session.name,
      content: data.content,
      timestamp: new Date(),
      type: 'visitor'
    }
    
    // Guardar en historial
    const history = messageHistory.get(sessionId) || []
    history.push(message)
    messageHistory.set(sessionId, history)
    
    // Actualizar última actividad
    session.lastMessage = new Date()
    
    // Enviar al visitante
    io.to(sessionId).emit('new-message', message)
    
    // Notificar a administradores
    socket.broadcast.emit('admin-message', message)
    
    console.log(`Message from ${session.name}: ${data.content}`)
  })

  // Admin: respuesta a visitante
  socket.on('admin-reply', (data: { sessionId: string; content: string; adminName: string }) => {
    const session = sessions.get(data.sessionId)
    if (!session) return
    
    const message: Message = {
      id: generateId(),
      sessionId: data.sessionId,
      name: data.adminName,
      content: data.content,
      timestamp: new Date(),
      type: 'admin'
    }
    
    // Guardar en historial
    const history = messageHistory.get(data.sessionId) || []
    history.push(message)
    messageHistory.set(data.sessionId, history)
    
    // Enviar al visitante específico
    io.to(data.sessionId).emit('new-message', message)
    
    console.log(`Admin reply to ${session.name}: ${data.content}`)
  })

  // Admin: obtener todas las sesiones activas
  socket.on('get-sessions', () => {
    const activeSessions = Array.from(sessions.values())
    socket.emit('sessions-list', { sessions: activeSessions })
  })

  // Escribiendo...
  socket.on('typing', (data: { isTyping: boolean }) => {
    const sessionId = socket.data.sessionId
    if (!sessionId) return
    
    const session = sessions.get(sessionId)
    if (!session) return
    
    socket.broadcast.emit('visitor-typing', { 
      sessionId, 
      name: session.name, 
      isTyping: data.isTyping 
    })
  })

  socket.on('disconnect', () => {
    const sessionId = socket.data.sessionId
    if (sessionId) {
      console.log(`Client disconnected from session: ${sessionId}`)
      // Mantenemos la sesión por un tiempo para mensajes offline
    } else {
      console.log(`Client disconnected: ${socket.id}`)
    }
  })

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`Chat WebSocket server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down server...')
  httpServer.close(() => {
    console.log('Chat WebSocket server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down server...')
  httpServer.close(() => {
    console.log('Chat WebSocket server closed')
    process.exit(0)
  })
})
