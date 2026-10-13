'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import {
  ExternalLink,
  Home,
  Images,
  Loader2,
  LogOut,
  Newspaper,
  PlugZap,
  Settings2,
  Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AdminDashboard } from './dashboard'
import type { AdminSectionId, AdminSessionInfo } from './types'

const sectionFallback = (
  <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Cargando…
  </div>
)

const PublicationsManager = dynamic(() => import('./publications-manager').then((mod) => mod.PublicationsManager), {
  ssr: false,
  loading: () => sectionFallback,
})
const MediaLibrary = dynamic(() => import('./media-library').then((mod) => mod.MediaLibrary), {
  ssr: false,
  loading: () => sectionFallback,
})
const SocialManager = dynamic(() => import('./social-manager').then((mod) => mod.SocialManager), {
  ssr: false,
  loading: () => sectionFallback,
})
const IntegrationsSettings = dynamic(() => import('./integrations-settings').then((mod) => mod.IntegrationsSettings), {
  ssr: false,
  loading: () => sectionFallback,
})
const LegacyAdminPanel = dynamic(() => import('@/components/admin-panel').then((mod) => mod.AdminPanel), {
  ssr: false,
  loading: () => sectionFallback,
})

type NavItem = {
  id: AdminSectionId
  label: string
  description: string
  icon: typeof Home
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'inicio', label: 'Inicio', description: 'Resumen y accesos rápidos', icon: Home },
  { id: 'publicaciones', label: 'Publicaciones', description: 'Noticias, páginas y novedades', icon: Newspaper },
  { id: 'medios', label: 'Fotos y medios', description: 'Biblioteca y editor de fotos', icon: Images },
  { id: 'redes', label: 'Redes sociales', description: 'Instagram y Facebook', icon: Share2 },
  { id: 'integraciones', label: 'Integraciones', description: 'Google AI Studio y claves', icon: PlugZap, adminOnly: true },
  { id: 'clasico', label: 'Proyectos y ajustes', description: 'Proyectos, sitio, CRM, Telegram y backups', icon: Settings2 },
]

function readSectionFromHash(): AdminSectionId {
  if (typeof window === 'undefined') {
    return 'inicio'
  }

  const value = window.location.hash.replace('#', '')
  return NAV_ITEMS.some((item) => item.id === value) ? (value as AdminSectionId) : 'inicio'
}

function LoginScreen({ configured, onLoggedIn }: { configured: boolean; onLoggedIn: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() || 'admin', password }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.error || 'No se pudo iniciar sesión.')
        return
      }

      onLoggedIn()
    } catch {
      setError('Sin conexión. Revisa tu red e inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/logo.svg" alt="" className="mx-auto mb-4 h-12 w-12 rounded-2xl border border-zinc-200 bg-white p-2" />
          <h1 className="text-xl font-semibold text-zinc-900">Panel de administración</h1>
          <p className="mt-1 text-sm text-zinc-500">Ingresa para gestionar el sitio</p>
        </div>

        {!configured ? (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            El panel aún no está configurado. Define los secretos <code className="font-mono">ADMIN_SESSION_SECRET</code> (32+
            caracteres) y <code className="font-mono">ADMIN_PASSWORD</code> en Cloudflare (Workers → Configuración → Variables y
            secretos).
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="space-y-1.5">
              <Label htmlFor="admin-username">Usuario</Label>
              <Input
                id="admin-username"
                name="username"
                autoComplete="username"
                placeholder="admin"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-password">Contraseña</Label>
              <Input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full bg-sky-600 hover:bg-sky-700" disabled={submitting || !password}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Ingresar
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}

function SectionHeader({ item, children }: { item: NavItem; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{item.label}</h1>
        <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
      </div>
      {children}
    </header>
  )
}

export function AdminShell() {
  const [session, setSession] = useState<AdminSessionInfo | null>(null)
  const [section, setSection] = useState<AdminSectionId>('inicio')

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/session', { cache: 'no-store' })
      setSession(await response.json())
    } catch {
      setSession({ configured: true, authenticated: false, role: null, username: null, root: false })
    }
  }, [])

  useEffect(() => {
    void loadSession()
    setSection(readSectionFromHash())

    const handleHashChange = () => setSection(readSectionFromHash())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [loadSession])

  const visibleItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.adminOnly || session?.role === 'admin'),
    [session?.role],
  )
  const activeItem = visibleItems.find((item) => item.id === section) ?? visibleItems[0]

  const navigate = useCallback((next: AdminSectionId) => {
    window.location.hash = next
    setSection(next)
    window.scrollTo({ top: 0 })
  }, [])

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined)
    window.location.hash = ''
    await loadSession()
  }

  if (!session) {
    return <main className="min-h-screen bg-zinc-50">{sectionFallback}</main>
  }

  if (!session.authenticated) {
    return <LoginScreen configured={session.configured} onLoggedIn={loadSession} />
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <Toaster position="top-center" richColors closeButton />

      {/* Barra lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-zinc-200 bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-5">
          <img src="/logo.svg" alt="" className="h-9 w-9 rounded-xl border border-zinc-200 p-1" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Administración</p>
            <p className="truncate text-xs text-zinc-500">
              {session.username} · {session.role === 'admin' ? 'Administrador' : 'Editor'}
            </p>
          </div>
        </div>
        <nav aria-label="Secciones del panel" className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const active = item.id === activeItem.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                  active ? 'bg-sky-50 font-medium text-sky-700' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                ].join(' ')}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="space-y-1 border-t border-zinc-100 p-3">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <ExternalLink className="h-4 w-4" aria-hidden /> Ver sitio
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Barra superior (móvil) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="h-8 w-8 rounded-lg border border-zinc-200 p-1" />
          <span className="text-sm font-semibold">{activeItem.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <a href="/" target="_blank" rel="noreferrer" aria-label="Ver sitio" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100">
            <ExternalLink className="h-4 w-4" />
          </a>
          <button type="button" onClick={handleLogout} aria-label="Cerrar sesión" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="px-4 pb-28 pt-6 sm:px-6 lg:ml-64 lg:px-10 lg:pb-12 lg:pt-10">
        <div className={activeItem.id === 'clasico' ? '' : 'mx-auto max-w-6xl'}>
          {activeItem.id !== 'clasico' ? <SectionHeader item={activeItem} /> : null}
          {activeItem.id === 'inicio' ? <AdminDashboard onNavigate={navigate} isAdmin={session.role === 'admin'} /> : null}
          {activeItem.id === 'publicaciones' ? <PublicationsManager /> : null}
          {activeItem.id === 'medios' ? <MediaLibrary /> : null}
          {activeItem.id === 'redes' ? <SocialManager /> : null}
          {activeItem.id === 'integraciones' ? <IntegrationsSettings /> : null}
          {activeItem.id === 'clasico' ? (
            <div className="-mx-4 sm:-mx-6 lg:-mx-10 lg:-mt-10">
              <LegacyAdminPanel initialOpen hideLauncher fullPage />
            </div>
          ) : null}
        </div>
      </main>

      {/* Navegación inferior (móvil) */}
      <nav
        aria-label="Secciones del panel"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}
      >
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = item.id === activeItem.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] leading-tight ${active ? 'text-sky-700' : 'text-zinc-500'}`}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="line-clamp-1">{item.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
