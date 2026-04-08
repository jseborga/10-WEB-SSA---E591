'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { MessageCircle, X, Send, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLanguage } from '@/lib/language-context'

interface Message {
  id: string
  sessionId: string
  name: string
  content: string
  timestamp: Date | string
  type: 'visitor' | 'admin'
  isFromAI?: boolean
}

interface ChatConfig {
  enabled: boolean
  provider?: string
  welcomeMessage: string | null
  welcomeMessageEn: string | null
  welcomeMessagePt: string | null
  fallbackMessage?: string | null
  fallbackMessageEn?: string | null
  fallbackMessagePt?: string | null
  companyName: string
}

const DEFAULT_CHAT_CONFIG: ChatConfig = {
  enabled: false,
  welcomeMessage: null,
  welcomeMessageEn: null,
  welcomeMessagePt: null,
  fallbackMessage: null,
  fallbackMessageEn: null,
  fallbackMessagePt: null,
  companyName: 'estudio591',
}

function getSavedSession() {
  if (typeof window === 'undefined') return null
  const saved = localStorage.getItem('chat_session')
  return saved ? JSON.parse(saved) : null
}

export function ChatWidget() {
  const { t, language } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const [hasLoadedConfig, setHasLoadedConfig] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [name, setName] = useState(() => getSavedSession()?.name || '')
  const [email, setEmail] = useState(() => getSavedSession()?.email || '')
  const [isJoined, setIsJoined] = useState(() => !!getSavedSession()?.name)
  const [isConnected, setIsConnected] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [chatConfig, setChatConfig] = useState<ChatConfig | null>(null)
  const [sessionId, setSessionId] = useState<string>('')
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const socketUrl = process.env.NEXT_PUBLIC_CHAT_SOCKET_URL?.trim() || '/?XTransformPort=3003'
  const socketPath = process.env.NEXT_PUBLIC_CHAT_SOCKET_PATH?.trim() || undefined

  useEffect(() => {
    if (!isOpen || hasLoadedConfig) return

    let isActive = true

    fetch('/api/chat-config')
      .then(res => res.json())
      .then((data) => {
        if (!isActive) return
        setChatConfig({
          ...DEFAULT_CHAT_CONFIG,
          ...data,
        })
      })
      .catch(() => {
        if (!isActive) return
        setChatConfig(DEFAULT_CHAT_CONFIG)
      })
      .finally(() => {
        if (isActive) setHasLoadedConfig(true)
      })

    return () => {
      isActive = false
    }
  }, [hasLoadedConfig, isOpen])

  // Get welcome message by language
  const getWelcomeMessage = useCallback(() => {
    if (!chatConfig) return t.chat.welcome
    if (language === 'en' && chatConfig.welcomeMessageEn) return chatConfig.welcomeMessageEn
    if (language === 'pt' && chatConfig.welcomeMessagePt) return chatConfig.welcomeMessagePt
    return chatConfig.welcomeMessage || t.chat.welcome
  }, [chatConfig, language, t.chat.welcome])

  const getFallbackMessage = useCallback(() => {
    if (!chatConfig) return t.chat.helpPrompt
    if (language === 'en' && chatConfig.fallbackMessageEn) return chatConfig.fallbackMessageEn
    if (language === 'pt' && chatConfig.fallbackMessagePt) return chatConfig.fallbackMessagePt
    return chatConfig.fallbackMessage || t.chat.helpPrompt
  }, [chatConfig, language, t.chat.helpPrompt])

  useEffect(() => {
    if (!hasOpened) return

    const savedSessionId = localStorage.getItem('chat_session_id')
    const newSessionId = savedSessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setSessionId(newSessionId)
    if (!savedSessionId) localStorage.setItem('chat_session_id', newSessionId)
  }, [hasOpened])

  useEffect(() => {
    if (!isOpen) {
      setIsConnected(false)
      return
    }

    if (!hasLoadedConfig) return

    if (chatConfig?.enabled) {
      setIsConnected(true)
      return
    }

    const socket = io(socketUrl, {
      path: socketPath,
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 3,
    })

    socketRef.current = socket
    socket.on('connect', () => {
      setIsConnected(true)
      const savedSession = getSavedSession()
      if (savedSession) {
        socket.emit('join-session', { sessionId: newSessionId, name: savedSession.name, email: savedSession.email })
      }
    })
    socket.on('disconnect', () => setIsConnected(false))
    socket.on('session-history', (data: { sessionId: string; messages: Message[] }) => setMessages(data.messages))
    socket.on('new-message', (msg: Message) => setMessages(prev => [...prev, msg]))

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [chatConfig?.enabled, hasLoadedConfig, isOpen, socketPath, socketUrl])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleJoin = useCallback(() => {
    if (socketRef.current && name.trim()) {
      socketRef.current.emit('join-session', { sessionId, name: name.trim(), email: email.trim() || undefined })
      localStorage.setItem('chat_session', JSON.stringify({ name: name.trim(), email: email.trim() }))
      setIsJoined(true)
    }
  }, [name, email, sessionId])

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !isJoined) return
    const userMessage = inputMessage.trim()
    
    const tempUserMsg: Message = {
      id: `temp_${Date.now()}`, sessionId, name,
      content: userMessage, timestamp: new Date(), type: 'visitor'
    }
    setMessages(prev => [...prev, tempUserMsg])
    setInputMessage('')

    if (chatConfig?.enabled) {
      setIsTyping(true)
      try {
        const history = messages.map(msg => ({ role: msg.type === 'visitor' ? 'user' : 'assistant' as const, content: msg.content }))
        const res = await fetch('/api/chat-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: userMessage, history, language })
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.success && data.response) {
          setMessages(prev => [...prev, {
            id: `ai_${Date.now()}`, sessionId,
            name: chatConfig.companyName + ' AI',
            content: data.response, timestamp: new Date(), type: 'admin', isFromAI: true
          }])
        } else {
          setMessages(prev => [...prev, {
            id: `fallback_${Date.now()}`, sessionId,
            name: chatConfig.companyName,
            content: data.response || getFallbackMessage(), timestamp: new Date(), type: 'admin', isFromAI: true
          }])
        }
      } catch {
        setMessages(prev => [...prev, {
          id: `fallback_${Date.now()}`, sessionId,
          name: chatConfig.companyName,
          content: getFallbackMessage(), timestamp: new Date(), type: 'admin', isFromAI: true
        }])
      }
      finally { setIsTyping(false) }
    } else if (socketRef.current && isConnected) {
      socketRef.current.emit('send-message', { content: userMessage })
    } else {
      setMessages(prev => [...prev, {
        id: `system_${Date.now()}`, sessionId,
        name: chatConfig?.companyName || 'Chat',
        content: getFallbackMessage(), timestamp: new Date(), type: 'admin'
      }])
    }
  }, [getFallbackMessage, inputMessage, isConnected, isJoined, chatConfig, messages, name, sessionId, language])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!isJoined) handleJoin()
      else sendMessage()
    }
  }, [isJoined, handleJoin, sendMessage])

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => {
          const nextOpen = !isOpen
          setIsOpen(nextOpen)
          if (nextOpen) setHasOpened(true)
        }}
        className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 w-12 h-12 sm:w-14 sm:h-14 bg-zinc-900 text-white rounded-full shadow-lg hover:bg-zinc-800 transition-all duration-300 flex items-center justify-center"
        aria-label="Chat"
      >
        {isOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-20 left-4 sm:bottom-24 sm:left-6 z-50 w-[calc(100%-2rem)] sm:w-80 md:w-96 bg-white rounded-lg shadow-2xl border border-zinc-200 overflow-hidden">
          {/* Header */}
          <div className="bg-zinc-900 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">{t.chat.title}</h3>
              {chatConfig?.enabled && (
                <span className="flex items-center gap-1 text-xs bg-green-600 px-2 py-0.5 rounded-full">
                  <Bot className="w-3 h-3" /> IA
                </span>
              )}
            </div>
            <span className="text-xs text-zinc-400">{isConnected ? t.chat.online : t.chat.connecting}</span>
          </div>

          {/* Content */}
          <div className="h-72 sm:h-80 flex flex-col">
            {!isJoined ? (
              <div className="flex-1 p-4 space-y-3">
                <p className="text-sm text-zinc-600">{getWelcomeMessage()}</p>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t.chat.namePlaceholder}
                  className="border-zinc-200 text-sm"
                />
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t.chat.emailPlaceholder}
                  type="email"
                  className="border-zinc-200 text-sm"
                />
                <Button onClick={handleJoin} disabled={!name.trim() || (!chatConfig?.enabled && !isConnected)} className="w-full bg-zinc-900 hover:bg-zinc-800 text-sm">
                  {t.chat.startChat}
                </Button>
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1 p-3">
                  <div className="space-y-2">
                    {messages.length === 0 ? (
                      <div className="text-center text-zinc-500 text-sm py-6">
                        <p>{t.chat.hello} {name}! 👋</p>
                        <p className="mt-1">{t.chat.helpPrompt}</p>
                        {chatConfig?.enabled && <p className="text-xs text-zinc-400 mt-2">{t.chat.aiAssistant}</p>}
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.type === 'visitor' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${msg.type === 'visitor' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-900'}`}>
                            {msg.isFromAI && <div className="flex items-center gap-1 text-xs text-zinc-500 mb-1"><Bot className="w-3 h-3" /><span>AI</span></div>}
                            <p>{msg.content}</p>
                            <p className="text-xs mt-1 opacity-60">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      ))
                    )}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-zinc-100 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                          <Bot className="w-4 h-4 text-zinc-500" />
                          <span className="animate-pulse">{t.chat.thinking}</span>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="p-3 border-t border-zinc-100 flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t.chat.typePlaceholder}
                    className="flex-1 border-zinc-200 text-sm"
                    disabled={!chatConfig?.enabled && !isConnected}
                  />
                  <Button onClick={sendMessage} disabled={!inputMessage.trim() || (!chatConfig?.enabled && !isConnected)} size="icon" className="bg-zinc-900 hover:bg-zinc-800">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
