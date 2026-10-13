'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, CircleAlert, Images, Inbox, Instagram, Newspaper, Sparkles, Users } from 'lucide-react'
import type { AdminSectionId } from './types'

type Overview = {
  counts: {
    publications: number
    drafts: number
    fromSocial: number
    projects: number
    media: number
    newLeads: number
    unreadContacts: number
    visitsWeek: number
  }
  recentPublications: Array<{ id: string; title: string; published: boolean; source: string; image: string | null; updatedAt: string }>
  integrations: {
    gemini: boolean
    meta: { pageName: string | null; igUsername: string | null; lastSyncAt: string | null } | null
  }
}

const dateFormatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function StatCard({ label, value, hint, icon: Icon, onClick }: { label: string; value: number | string; hint?: string; icon: typeof Inbox; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:border-zinc-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <div className="flex items-center justify-between text-zinc-500">
        <span className="text-sm">{label}</span>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-zinc-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </button>
  )
}

export function AdminDashboard({ onNavigate, isAdmin }: { onNavigate: (section: AdminSectionId) => void; isAdmin: boolean }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/overview', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error((await response.json().catch(() => ({}))).error || 'No se pudo cargar el resumen.')
        }

        setOverview(await response.json())
      })
      .catch((reason: Error) => setError(reason.message))
  }, [])

  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </p>
    )
  }

  if (!overview) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-zinc-200/60" />
        ))}
      </div>
    )
  }

  const { counts, integrations } = overview

  return (
    <div className="space-y-8">
      <section aria-label="Acciones rápidas" className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onNavigate('publicaciones')}
          className="flex items-center gap-3 rounded-2xl bg-sky-600 p-5 text-left text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          <Newspaper className="h-6 w-6 shrink-0" aria-hidden />
          <span>
            <span className="block font-medium">Crear publicación</span>
            <span className="block text-sm text-sky-100">Texto, portada y galería</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('medios')}
          className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:border-zinc-300 hover:shadow-sm"
        >
          <Images className="h-6 w-6 shrink-0 text-sky-600" aria-hidden />
          <span>
            <span className="block font-medium">Subir y editar fotos</span>
            <span className="block text-sm text-zinc-500">Recorte, luz y mejora con IA</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('redes')}
          className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:border-zinc-300 hover:shadow-sm"
        >
          <Instagram className="h-6 w-6 shrink-0 text-pink-600" aria-hidden />
          <span>
            <span className="block font-medium">Traer de Instagram/Facebook</span>
            <span className="block text-sm text-zinc-500">Importa tus posts al sitio</span>
          </span>
        </button>
      </section>

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Publicaciones"
          value={counts.publications}
          hint={counts.drafts ? `${counts.drafts} en borrador` : 'Todo publicado'}
          icon={Newspaper}
          onClick={() => onNavigate('publicaciones')}
        />
        <StatCard label="Fotos y medios" value={counts.media} hint={`${counts.projects} proyectos`} icon={Images} onClick={() => onNavigate('medios')} />
        <StatCard
          label="Contactos nuevos"
          value={counts.newLeads + counts.unreadContacts}
          hint={`${counts.newLeads} del chat · ${counts.unreadContacts} del formulario`}
          icon={Inbox}
          onClick={() => onNavigate('clasico')}
        />
        <StatCard label="Visitas (7 días)" value={counts.visitsWeek} hint="Sesiones registradas" icon={Users} onClick={() => onNavigate('clasico')} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Últimos cambios</h2>
            <button type="button" onClick={() => onNavigate('publicaciones')} className="inline-flex items-center gap-1 text-sm text-sky-700 hover:underline">
              Ver todas <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          {overview.recentPublications.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-zinc-500">Aún no hay publicaciones.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {overview.recentPublications.map((publication) => (
                <li key={publication.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                    {publication.image ? <img src={publication.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{publication.title}</p>
                    <p className="text-xs text-zinc-500">{dateFormatter.format(new Date(publication.updatedAt))}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${publication.published ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}`}
                  >
                    {publication.published ? 'Publicada' : 'Borrador'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold">Conexiones</h2>
          <IntegrationRow
            ok={integrations.gemini}
            title="Google AI Studio (Gemini)"
            okText="Lista para mejorar fotos y textos"
            pendingText="Agrega tu clave para mejorar fotos con IA"
            onClick={isAdmin ? () => onNavigate('integraciones') : undefined}
            icon={Sparkles}
          />
          <IntegrationRow
            ok={Boolean(integrations.meta)}
            title="Instagram / Facebook"
            okText={
              integrations.meta
                ? [integrations.meta.pageName, integrations.meta.igUsername ? `@${integrations.meta.igUsername}` : null].filter(Boolean).join(' · ')
                : ''
            }
            pendingText="Conecta tu página para importar posts"
            onClick={() => onNavigate('redes')}
            icon={Instagram}
          />
        </section>
      </div>
    </div>
  )
}

function IntegrationRow({
  ok,
  title,
  okText,
  pendingText,
  onClick,
  icon: Icon,
}: {
  ok: boolean
  title: string
  okText: string
  pendingText: string
  onClick?: () => void
  icon: typeof Sparkles
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-zinc-100 p-3 text-left transition enabled:hover:bg-zinc-50"
    >
      <Icon className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-zinc-500">{ok ? okText : pendingText}</span>
      </span>
      {ok ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Conectado" />
      ) : (
        <CircleAlert className="h-5 w-5 text-amber-500" aria-label="Pendiente" />
      )}
    </button>
  )
}
