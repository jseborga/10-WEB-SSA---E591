'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { MessageCircle, X, Send, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sendAnalyticsEvent } from '@/lib/browser-analytics'
import {
  EXTERNAL_CHAT_OPEN_EVENT,
  type ChatLeadStage,
  type ExternalChatLeadContext,
  type ExternalChatOpenDetail,
} from '@/lib/chat-launcher'
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

interface ChatWidgetProps {
  buttonTone?: 'light' | 'dark'
  guideMessages?: string[]
  brandingIconUrl?: string
  companyName?: string
}

function getSavedSession() {
  if (typeof window === 'undefined') return null
  const saved = localStorage.getItem('chat_session')
  return saved ? JSON.parse(saved) : null
}

function normalizeMessages(input: Message[]) {
  return input.map((item) => ({
    ...item,
    timestamp: item.timestamp,
  }))
}

function formatLeadStageLabel(stage: ChatLeadStage | undefined) {
  switch (stage) {
    case 'hot':
      return 'Listo para cierre'
    case 'qualified':
      return 'Lead en evaluacion'
    default:
      return 'Exploracion'
  }
}

function formatPreferredChannelLabel(value: string | undefined) {
  switch (value) {
    case 'whatsapp':
      return 'WhatsApp'
    case 'phone':
      return 'Llamada'
    case 'email':
      return 'Correo'
    case 'telegram':
      return 'Telegram'
    default:
      return ''
  }
}

function normalizeGuideMessages(messages: string[] | undefined) {
  return Array.from(new Set((messages || []).map((message) => message.trim()).filter(Boolean)))
}

function getGuideActions(language: string) {
  if (language === 'en') {
    return [
      { id: 'about', label: 'Who we are', href: '/estudio' },
      { id: 'services', label: 'What we do', message: 'I want to know who you are and what services you offer.' },
      { id: 'projects', label: 'Projects', href: '/proyectos' },
      { id: 'contact', label: 'Contact', href: '/contacto' },
      { id: 'quote', label: 'Request a quote', message: 'I want an initial quote for my project.' },
    ]
  }

  if (language === 'pt') {
    return [
      { id: 'about', label: 'Quem somos', href: '/estudio' },
      { id: 'services', label: 'O que fazemos', message: 'Quero saber quem voces sao e que servicos oferecem.' },
      { id: 'projects', label: 'Projetos', href: '/proyectos' },
      { id: 'contact', label: 'Contato', href: '/contacto' },
      { id: 'quote', label: 'Pedir cotacao', message: 'Quero uma cotacao inicial para meu projeto.' },
    ]
  }

  return [
    { id: 'about', label: 'Quienes somos', href: '/estudio' },
    { id: 'services', label: 'Que hacemos', message: 'Quiero saber quienes son y que servicios ofrecen.' },
    { id: 'projects', label: 'Proyectos', href: '/proyectos' },
    { id: 'contact', label: 'Contacto', href: '/contacto' },
    { id: 'quote', label: 'Cotizar', message: 'Quiero una cotizacion inicial para mi proyecto.' },
  ]
}

export function ChatWidget({
  buttonTone = 'dark',
  guideMessages = [],
  brandingIconUrl,
  companyName,
}: ChatWidgetProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const [hasLoadedConfig, setHasLoadedConfig] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [name, setName] = useState(() => getSavedSession()?.name || '')
  const [email, setEmail] = useState(() => getSavedSession()?.email || '')
  const [isJoined, setIsJoined] = useState(() => !!getSavedSession()?.name)
  const [queuedMessage, setQueuedMessage] = useState('')
  const [queuedLeadContext, setQueuedLeadContext] = useState<ExternalChatLeadContext | null>(null)
  const [queuedAutoSend, setQueuedAutoSend] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [chatConfig, setChatConfig] = useState<ChatConfig | null>(null)
  const [sessionId, setSessionId] = useState<string>('')
  const [activeGuideIndex, setActiveGuideIndex] = useState(0)
  const [typedGuideLength, setTypedGuideLength] = useState(0)
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const socketUrl = process.env.NEXT_PUBLIC_CHAT_SOCKET_URL?.trim() || '/?XTransformPort=3003'
  const socketPath = process.env.NEXT_PUBLIC_CHAT_SOCKET_PATH?.trim() || undefined
  const isLightTone = buttonTone === 'light'
  const normalizedGuideMessages = useMemo(() => normalizeGuideMessages(guideMessages), [guideMessages])
  const guideActions = useMemo(() => getGuideActions(language), [language])
  const resolvedCompanyName = companyName?.trim() || chatConfig?.companyName || DEFAULT_CHAT_CONFIG.companyName
  const resolvedBrandingIconUrl = brandingIconUrl?.trim() || ''
  const activeGuideMessage =
    normalizedGuideMessages.length > 0 ? normalizedGuideMessages[activeGuideIndex % normalizedGuideMessages.length] || '' : ''
  const showGuideTeaser = !isOpen && !hasOpened && normalizedGuideMessages.length > 0
  const floatingButtonClass = [
    'fixed bottom-5 right-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border shadow-[0_18px_48px_rgba(0,0,0,0.24)] backdrop-blur-md transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:bottom-6 sm:right-6',
    isLightTone
      ? 'border-white/35 bg-black/14 text-white hover:border-white/70 hover:bg-white hover:text-zinc-900'
      : 'border-zinc-300 bg-white/92 text-zinc-900 hover:border-zinc-500 hover:bg-zinc-900 hover:text-white',
  ].join(' ')
  const guideBubbleClass = [
    'fixed bottom-20 right-4 z-50 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border px-3 py-2 text-left shadow-[0_18px_48px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-all duration-300 sm:bottom-24 sm:right-6',
    isLightTone
      ? 'border-white/18 bg-black/20 text-white hover:border-white/34 hover:bg-black/26'
      : 'border-white/55 bg-white/72 text-zinc-900 hover:border-zinc-400 hover:bg-white/82',
  ].join(' ')
  const guideChipClass = 'rounded-full border border-zinc-200 px-3 py-1 text-[11px] text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900'

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

  useEffect(() => {
    const handleExternalOpen = (event: Event) => {
      const detail = (event as CustomEvent<ExternalChatOpenDetail>).detail
      const nextMessage = detail?.message?.trim() || ''
      const shouldAutoSend = Boolean(detail?.autoSend)

      setIsOpen(true)
      setHasOpened(true)
      setQueuedLeadContext(detail?.leadContext || null)
      setQueuedAutoSend(shouldAutoSend)

      if (nextMessage) {
        if (isJoined && !shouldAutoSend) {
          setInputMessage(nextMessage)
        } else {
          setQueuedMessage(nextMessage)
        }
      }
    }

    window.addEventListener(EXTERNAL_CHAT_OPEN_EVENT, handleExternalOpen as EventListener)

    return () => {
      window.removeEventListener(EXTERNAL_CHAT_OPEN_EVENT, handleExternalOpen as EventListener)
    }
  }, [isJoined])

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
    if (!isOpen || !hasLoadedConfig || !chatConfig?.enabled || !sessionId || !isJoined) {
      return
    }

    let isActive = true

    fetch(`/api/chat-history?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!isActive || !Array.isArray(data)) {
          return
        }

        setMessages(normalizeMessages(data))
      })
      .catch(() => {
        if (!isActive) return
      })

    return () => {
      isActive = false
    }
  }, [chatConfig?.enabled, hasLoadedConfig, isJoined, isOpen, sessionId])

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
        socket.emit('join-session', { sessionId, name: savedSession.name, email: savedSession.email })
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

  useEffect(() => {
    if (!showGuideTeaser || !activeGuideMessage) {
      return
    }

    setTypedGuideLength(0)

    const typingWindow = Math.max(900, Math.min(2100, activeGuideMessage.length * 58))
    const charDelay = Math.max(28, Math.min(76, Math.floor(typingWindow / Math.max(activeGuideMessage.length, 1))))
    const rotateDelay = Math.max(2800, typingWindow + 1600)
    let charIndex = 0

    const typingInterval = window.setInterval(() => {
      charIndex += 1
      setTypedGuideLength(Math.min(charIndex, activeGuideMessage.length))

      if (charIndex >= activeGuideMessage.length) {
        window.clearInterval(typingInterval)
      }
    }, charDelay)

    const rotateTimeout = window.setTimeout(() => {
      setActiveGuideIndex((current) => (current + 1) % Math.max(normalizedGuideMessages.length, 1))
    }, rotateDelay)

    return () => {
      window.clearInterval(typingInterval)
      window.clearTimeout(rotateTimeout)
    }
  }, [activeGuideMessage, normalizedGuideMessages.length, showGuideTeaser])

  const openWidget = useCallback(() => {
    setIsOpen(true)
    setHasOpened(true)
  }, [])

  const prepareGuidedMessage = useCallback(
    (message: string) => {
      const nextMessage = message.trim()

      openWidget()
      setQueuedLeadContext({
        source: 'chat-guide',
        stage: 'discover',
      })
      setQueuedAutoSend(false)

      if (!nextMessage) {
        return
      }

      if (isJoined) {
        setInputMessage(nextMessage)
      } else {
        setQueuedMessage(nextMessage)
      }
    },
    [isJoined, openWidget],
  )

  const handleGuideAction = useCallback(
    (actionId: string) => {
      const action = guideActions.find((item) => item.id === actionId)

      if (!action) {
        return
      }

      if ('href' in action && action.href) {
        setIsOpen(false)
        router.push(action.href)
        return
      }

      if ('message' in action && action.message) {
        prepareGuidedMessage(action.message)
      }
    },
    [guideActions, prepareGuidedMessage, router],
  )

  const handleJoin = useCallback(() => {
    if (!name.trim()) return

    localStorage.setItem('chat_session', JSON.stringify({ name: name.trim(), email: email.trim() }))
    const pendingMessage = queuedMessage.trim()
    const shouldAutoSend = queuedAutoSend

    if (socketRef.current) {
      socketRef.current.emit('join-session', { sessionId, name: name.trim(), email: email.trim() || undefined })
    }

    setIsJoined(true)

    if (pendingMessage) {
      if (shouldAutoSend) {
        setInputMessage('')
      } else {
        setInputMessage(pendingMessage)
        setQueuedMessage('')
      }
    }
  }, [name, email, queuedAutoSend, queuedMessage, sessionId])

  const sendPreparedMessage = useCallback(async (rawMessage: string) => {
    if (!rawMessage.trim() || !isJoined) return
    const userMessage = rawMessage.trim()

    const tempUserMsg: Message = {
      id: `temp_${Date.now()}`, sessionId, name,
      content: userMessage, timestamp: new Date(), type: 'visitor'
    }
    setMessages(prev => [...prev, tempUserMsg])
    setInputMessage('')
    setQueuedLeadContext(null)
    setQueuedAutoSend(false)
    setQueuedMessage('')

    if (chatConfig?.enabled) {
      setIsTyping(true)
      try {
        const history = messages.map(msg => ({ role: msg.type === 'visitor' ? 'user' : 'assistant' as const, content: msg.content }))
        const res = await fetch('/api/chat-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: userMessage, history, language, name, email })
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
  }, [getFallbackMessage, isConnected, isJoined, chatConfig, messages, name, sessionId, language])

  const sendMessage = useCallback(async () => {
    await sendPreparedMessage(inputMessage)
  }, [inputMessage, sendPreparedMessage])

  useEffect(() => {
    const preparedMessage = queuedMessage.trim()
    const canSendNow = chatConfig?.enabled ? hasLoadedConfig : isConnected

    if (!isOpen || !isJoined || !queuedAutoSend || !preparedMessage || !sessionId || !canSendNow) {
      return
    }

    void sendPreparedMessage(preparedMessage)
  }, [chatConfig?.enabled, hasLoadedConfig, isConnected, isJoined, isOpen, queuedAutoSend, queuedMessage, sendPreparedMessage, sessionId])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!isJoined) handleJoin()
      else sendMessage()
    }
  }, [isJoined, handleJoin, sendMessage])

  useEffect(() => {
    if (!isOpen) return

    sendAnalyticsEvent({
      eventType: 'chat-open',
      payload: {
        provider: chatConfig?.provider || 'socket',
      },
    })
  }, [chatConfig?.provider, isOpen])

  return (
    <>
      {showGuideTeaser ? (
        <button
          type="button"
          onClick={openWidget}
          className={guideBubbleClass}
          aria-label="Abrir guia del chat"
        >
          <div className="space-y-1">
            <p className={`font-mono text-[10px] uppercase tracking-[0.18em] ${isLightTone ? 'text-white/62' : 'text-zinc-500'}`}>
              asistente ssa
            </p>
            <div className="inline-flex max-w-full items-end gap-2">
              <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${isLightTone ? 'text-lime-200/72' : 'text-zinc-600'}`}>
                ssa@obra:~$
              </span>
              <span className="break-words font-mono text-xs uppercase leading-snug sm:text-sm">
                {activeGuideMessage.slice(0, typedGuideLength)}
              </span>
              <span className={`inline-block h-4 w-[2px] shrink-0 animate-pulse rounded-full ${isLightTone ? 'bg-lime-200/85' : 'bg-zinc-900/70'}`} />
            </div>
            <p className={`text-[11px] ${isLightTone ? 'text-white/66' : 'text-zinc-500'}`}>
              {language === 'en'
                ? 'Click here to open the guide.'
                : language === 'pt'
                  ? 'Toque aqui para abrir o guia.'
                  : 'Haz clic aqui para abrir la guia.'}
            </p>
          </div>
        </button>
      ) : null}

      {/* Floating button */}
      <button
        onClick={() => {
          const nextOpen = !isOpen
          setIsOpen(nextOpen)
          if (nextOpen) setHasOpened(true)
        }}
        className={floatingButtonClass}
        aria-label="Chat"
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : resolvedBrandingIconUrl ? (
          <span className="relative inline-flex h-9 w-9 items-center justify-center">
            <img
              src={resolvedBrandingIconUrl}
              alt={resolvedCompanyName}
              className="h-9 w-9 rounded-full bg-white/92 object-contain p-1"
            />
            <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-950 text-white shadow-sm">
              <MessageCircle className="h-2.5 w-2.5" />
            </span>
          </span>
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 flex max-h-[min(78vh,42rem)] w-[calc(100%-2rem)] flex-col overflow-hidden rounded-[24px] border border-white/40 bg-white/48 shadow-2xl backdrop-blur-xl sm:bottom-24 sm:right-6 sm:w-80 md:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/16 bg-zinc-950/64 px-4 py-3 text-white backdrop-blur-xl">
            <div className="flex items-center gap-2">
              {resolvedBrandingIconUrl ? (
                <img
                  src={resolvedBrandingIconUrl}
                  alt={resolvedCompanyName}
                  className="h-8 w-8 rounded-full border border-white/20 bg-white/92 object-contain p-1"
                />
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-[10px] uppercase tracking-[0.18em] text-white/58">{resolvedCompanyName}</p>
                <h3 className="truncate text-sm font-medium">{t.chat.title}</h3>
              </div>
              {chatConfig?.enabled && (
                <span className="flex items-center gap-1 text-xs bg-green-600 px-2 py-0.5 rounded-full">
                  <Bot className="w-3 h-3" /> IA
                </span>
              )}
            </div>
            <span className="text-xs text-zinc-400">{isConnected ? t.chat.online : t.chat.connecting}</span>
          </div>

          {/* Content */}
          <div className="flex min-h-0 flex-1 flex-col">
            {!isJoined ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <p className="text-sm text-zinc-700">{getWelcomeMessage()}</p>
                <div className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">guia rapida</p>
                  <p className="text-xs leading-5 text-zinc-600">
                    {language === 'en'
                      ? 'Use this as a guided tour to understand the company, review services, inspect projects, and move to the right next step.'
                      : language === 'pt'
                        ? 'Use isto como um tour guiado para entender a empresa, revisar servicos, ver projetos e avancar ao proximo passo.'
                        : 'Usa esto como un tour guiado para entender la empresa, revisar servicios, ver proyectos y avanzar al siguiente paso.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {guideActions.map((action) => (
                      <button key={action.id} type="button" onClick={() => handleGuideAction(action.id)} className={guideChipClass}>
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
                {queuedMessage ? (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    Consulta preparada: <span className="font-medium text-zinc-800">{queuedMessage}</span>
                  </div>
                ) : null}
                {queuedLeadContext ? (
                  <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
                    <p className="font-medium text-zinc-800">Contexto comercial</p>
                    <div className="mt-1 space-y-1">
                      <p>Estado: {formatLeadStageLabel(queuedLeadContext.stage)}</p>
                      {queuedLeadContext.serviceType ? <p>Servicio: {queuedLeadContext.serviceType}</p> : null}
                      {queuedLeadContext.projectType ? <p>Proyecto: {queuedLeadContext.projectType}</p> : null}
                      {queuedLeadContext.projectLocation ? <p>Ubicacion: {queuedLeadContext.projectLocation}</p> : null}
                      {queuedLeadContext.timeline ? <p>Plazo: {queuedLeadContext.timeline}</p> : null}
                      {queuedLeadContext.preferredContactChannel ? <p>Canal: {formatPreferredChannelLabel(queuedLeadContext.preferredContactChannel)}</p> : null}
                      {queuedLeadContext.contactConsent ? <p>Autorizo contacto: si</p> : null}
                      {queuedAutoSend ? <p>La consulta se enviara automaticamente al abrir el chat.</p> : null}
                    </div>
                  </div>
                ) : null}
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
                <div className="border-b border-zinc-200/80 bg-white/42 px-3 py-3 backdrop-blur-sm">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">tour de la pagina</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {guideActions.map((action) => (
                      <button key={action.id} type="button" onClick={() => handleGuideAction(action.id)} className={guideChipClass}>
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="space-y-2 pr-1">
                    {messages.length === 0 ? (
                      <div className="text-center text-zinc-500 text-sm py-6">
                        <p>{t.chat.hello} {name}! 👋</p>
                        <p className="mt-1">{t.chat.helpPrompt}</p>
                        {chatConfig?.enabled && <p className="text-xs text-zinc-400 mt-2">{t.chat.aiAssistant}</p>}
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          {guideActions.map((action) => (
                            <button key={action.id} type="button" onClick={() => handleGuideAction(action.id)} className={guideChipClass}>
                              {action.label}
                            </button>
                          ))}
                        </div>
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
                </div>

                <div className="flex gap-2 border-t border-zinc-200/80 bg-white/48 p-3 backdrop-blur-sm">
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
