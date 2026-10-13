'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Check,
  ExternalLink,
  Facebook,
  Images,
  Instagram,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  Unplug,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  OPEN_PUBLICATION_KEY,
  type SocialConnectionStatus,
  type SocialImportResult,
  type SocialNetwork,
  type SocialPostDTO,
  type SocialPostsResponse,
} from './types'

/** Tamaño de cada lote de importación (el API acepta hasta 12; lotes chicos = progreso más fino y menos subrequests). */
const IMPORT_BATCH_SIZE = 6

const dateFormatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function formatDate(value: string | null, withTime = false) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return (withTime ? dateTimeFormatter : dateFormatter).format(date)
}

async function readError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (response.status === 403) return 'Solo un administrador puede conectar o desconectar cuentas.'
  return data.error || fallback
}

function openPublication(id: string) {
  try {
    window.sessionStorage.setItem(OPEN_PUBLICATION_KEY, id)
  } catch {
    // Sin sessionStorage solo se abre la lista.
  }
  window.location.hash = 'publicaciones'
}

type FeedState = {
  posts: SocialPostDTO[]
  nextCursor: string | null
  loading: boolean
  error: string
  loaded: boolean
}

const emptyFeed: FeedState = { posts: [], nextCursor: null, loading: false, error: '', loaded: false }

export function SocialManager() {
  const [status, setStatus] = useState<SocialConnectionStatus | null>(null)
  const [statusError, setStatusError] = useState('')

  const loadStatus = useCallback(
    () =>
      fetch('/api/admin/social', { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) throw new Error(await readError(response, 'No se pudo leer la conexión.'))
          setStatus((await response.json()) as SocialConnectionStatus)
          setStatusError('')
        })
        .catch((error: unknown) => {
          setStatusError(error instanceof Error ? error.message : 'No se pudo leer la conexión.')
        }),
    [],
  )

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Redes sociales</h1>
        <p className="mt-1 text-sm text-zinc-500">Trae tus posts de Instagram y Facebook como publicaciones del sitio, con sus fotos.</p>
      </div>

      {statusError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {statusError}{' '}
          <button type="button" onClick={() => void loadStatus()} className="font-medium underline">
            Reintentar
          </button>
        </div>
      ) : !status ? (
        <div className="flex h-48 items-center justify-center text-sm text-zinc-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Cargando…
        </div>
      ) : status.connected ? (
        <ConnectedView status={status} onStatusChange={setStatus} onRefreshStatus={loadStatus} />
      ) : (
        <ConnectForm onConnected={setStatus} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Conexión                                                             */
/* ------------------------------------------------------------------ */

function ConnectForm({ onConnected }: { onConnected: (status: SocialConnectionStatus) => void }) {
  const [token, setToken] = useState('')
  const [pageId, setPageId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/admin/social', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token.trim(), pageId: pageId.trim() || undefined }),
      })
      if (!response.ok) throw new Error(await readError(response, 'No se pudo conectar la cuenta.'))
      const next = (await response.json()) as SocialConnectionStatus
      setToken('')
      onConnected(next)
      toast.success(`Conectado a ${next.pageName || 'la página'}${next.igUsername ? ` y @${next.igUsername}` : ''}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo conectar la cuenta.')
    } finally {
      setSubmitting(false)
    }
  }

  const steps = [
    {
      title: 'Crea una app en Meta for Developers',
      body: (
        <>
          Entra a{' '}
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="font-medium text-sky-700 hover:underline">
            developers.facebook.com/apps
          </a>{' '}
          y crea una app de tipo <em>Empresa</em>. Tu Instagram debe ser una cuenta profesional vinculada a la página de Facebook.
        </>
      ),
    },
    {
      title: 'Agrega los permisos',
      body: (
        <>
          En el{' '}
          <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="font-medium text-sky-700 hover:underline">
            Explorador de la Graph API
          </a>{' '}
          elige tu app y marca: <code className="rounded bg-zinc-100 px-1">pages_show_list</code>,{' '}
          <code className="rounded bg-zinc-100 px-1">pages_read_engagement</code> e <code className="rounded bg-zinc-100 px-1">instagram_basic</code>.
        </>
      ),
    },
    {
      title: 'Genera un token de página de larga duración',
      body: (
        <>
          Genera el token de usuario, conviértelo en uno de larga duración con el{' '}
          <a href="https://developers.facebook.com/tools/debug/accesstoken/" target="_blank" rel="noopener noreferrer" className="font-medium text-sky-700 hover:underline">
            Depurador de tokens
          </a>{' '}
          (“Ampliar token”) y pégalo aquí. Si administras varias páginas, indica el Page ID: guardaremos el token de esa página.
        </>
      ),
    },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section aria-labelledby="guide-title" className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
        <h2 id="guide-title" className="flex items-center gap-2 font-medium text-zinc-900">
          <Instagram className="h-5 w-5 text-pink-600" aria-hidden />
          <Facebook className="h-5 w-5 text-blue-600" aria-hidden />
          Conecta Instagram y Facebook en 3 pasos
        </h2>
        <ol className="mt-5 space-y-5">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-white" aria-hidden>
                {index + 1}
              </span>
              <div>
                <p className="font-medium text-zinc-900">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
          El token se guarda solo en el servidor y nunca se muestra completo. Solo lee tus publicaciones: no publica nada en tus redes.
        </p>
      </section>

      <form onSubmit={handleSubmit} className="h-fit space-y-4 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-medium text-zinc-900">
          <KeyRound className="h-4 w-4 text-zinc-400" aria-hidden /> Conectar cuenta
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="meta-token">Token de acceso</Label>
          <Input
            id="meta-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="EAAG…"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-page">
            Page ID <span className="font-normal text-zinc-400">(opcional)</span>
          </Label>
          <Input id="meta-page" inputMode="numeric" value={pageId} onChange={(event) => setPageId(event.target.value.replace(/\D/g, ''))} placeholder="1234567890" />
        </div>
        {error ? (
          <p role="alert" className="flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span className="break-words">{error}</span>
          </p>
        ) : null}
        <Button type="submit" disabled={submitting || token.trim().length < 20} className="w-full bg-sky-600 text-white hover:bg-sky-700">
          {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Conectar
        </Button>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cuenta conectada + importación                                       */
/* ------------------------------------------------------------------ */

function ConnectedView({
  status,
  onStatusChange,
  onRefreshStatus,
}: {
  status: SocialConnectionStatus
  onStatusChange: (status: SocialConnectionStatus) => void
  onRefreshStatus: () => Promise<void>
}) {
  const [network, setNetwork] = useState<SocialNetwork>(status.igUserId ? 'instagram' : 'facebook')
  const [feeds, setFeeds] = useState<Record<SocialNetwork, FeedState>>({ instagram: emptyFeed, facebook: emptyFeed })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [importing, setImporting] = useState<{ done: number; total: number; publish: boolean } | null>(null)
  const [lastErrors, setLastErrors] = useState<SocialImportResult['errors']>([])

  const feed = feeds[network]

  const loadFeed = useCallback(async (target: SocialNetwork, after?: string | null) => {
    setFeeds((prev) => ({ ...prev, [target]: { ...prev[target], loading: true, error: '' } }))
    try {
      const params = new URLSearchParams({ network: target })
      if (after) params.set('after', after)
      const response = await fetch(`/api/admin/social/posts?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(await readError(response, 'No se pudieron cargar los posts.'))
      const data = (await response.json()) as SocialPostsResponse
      setFeeds((prev) => {
        const existing = after ? prev[target].posts : []
        const seen = new Set(existing.map((post) => post.id))
        return {
          ...prev,
          [target]: {
            posts: [...existing, ...data.posts.filter((post) => !seen.has(post.id))],
            nextCursor: data.nextCursor,
            loading: false,
            error: '',
            loaded: true,
          },
        }
      })
    } catch (error) {
      setFeeds((prev) => ({
        ...prev,
        [target]: { ...prev[target], loading: false, loaded: true, error: error instanceof Error ? error.message : 'No se pudieron cargar los posts.' },
      }))
    }
  }, [])

  useEffect(() => {
    if (!feeds[network].loaded && !feeds[network].loading) {
      if (network === 'instagram' && !status.igUserId) return
      void loadFeed(network)
    }
  }, [network, feeds, loadFeed, status.igUserId])

  const importable = useMemo(() => feed.posts.filter((post) => !post.alreadyImported), [feed.posts])
  const selectedIds = useMemo(() => feed.posts.filter((post) => selected.has(post.id) && !post.alreadyImported).map((post) => post.id), [feed.posts, selected])

  const switchNetwork = (next: SocialNetwork) => {
    setNetwork(next)
    setSelected(new Set())
    setLastErrors([])
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allSelected = importable.length > 0 && importable.every((post) => selected.has(post.id))

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const response = await fetch('/api/admin/social', { method: 'DELETE' })
      if (!response.ok) throw new Error(await readError(response, 'No se pudo desconectar.'))
      onStatusChange((await response.json()) as SocialConnectionStatus)
      toast.success('Cuenta desconectada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo desconectar.')
    } finally {
      setDisconnecting(false)
      setConfirmDisconnect(false)
    }
  }

  const runImport = async (publish: boolean) => {
    const ids = [...selectedIds]
    if (ids.length === 0) return

    setImporting({ done: 0, total: ids.length, publish })
    setLastErrors([])
    const imported: SocialImportResult['imported'] = []
    const errors: SocialImportResult['errors'] = []
    let skipped = 0

    for (let index = 0; index < ids.length; index += IMPORT_BATCH_SIZE) {
      const batch = ids.slice(index, index + IMPORT_BATCH_SIZE)
      try {
        const response = await fetch('/api/admin/social/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ network, ids: batch, publish }),
        })
        if (!response.ok) throw new Error(await readError(response, 'Falló la importación del lote.'))
        const result = (await response.json()) as SocialImportResult
        imported.push(...result.imported)
        errors.push(...result.errors)
        skipped += result.skipped.length

        // Marca como importados en la grilla a medida que avanza.
        const byId = new Map([...result.imported, ...result.skipped.filter((item) => item.publicationId)].map((item) => [item.id, item.publicationId]))
        setFeeds((prev) => ({
          ...prev,
          [network]: {
            ...prev[network],
            posts: prev[network].posts.map((post) =>
              byId.has(post.id) ? { ...post, alreadyImported: true, publicationId: byId.get(post.id) || undefined } : post,
            ),
          },
        }))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falló la importación del lote.'
        errors.push(...batch.map((id) => ({ id, error: message })))
      }
      setImporting({ done: Math.min(index + batch.length, ids.length), total: ids.length, publish })
    }

    setImporting(null)
    setSelected(new Set())
    setLastErrors(errors)
    void onRefreshStatus()

    const fatal = errors.filter((entry) => !entry.error.startsWith('Importada con avisos')).length
    if (imported.length > 0) {
      toast.success(
        `${imported.length} ${imported.length === 1 ? 'post importado' : 'posts importados'} ${publish ? 'y publicados' : 'como borrador'}` +
          (skipped ? ` · ${skipped} ya existían` : ''),
      )
    }
    if (fatal > 0) toast.error(`${fatal} no se pudieron importar. Revisa el detalle abajo.`)
  }

  const tabs: Array<{ id: SocialNetwork; label: string; icon: typeof Instagram; disabled?: boolean }> = [
    { id: 'instagram', label: 'Instagram', icon: Instagram },
    { id: 'facebook', label: 'Facebook', icon: Facebook },
  ]

  return (
    <div className="space-y-6">
      {/* Cabecera de la cuenta */}
      <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-zinc-900">
              {status.pageName || 'Página de Facebook'}
              {status.igUsername ? <span className="font-normal text-zinc-500"> · @{status.igUsername}</span> : null}
            </p>
            <p className="text-xs text-zinc-500">
              {status.lastSyncAt ? `Última importación: ${formatDate(status.lastSyncAt, true)}` : 'Aún no se importó nada'}
              {status.tokenPreview ? ` · Token ${status.tokenPreview}` : ''}
              {status.tokenExpiresAt ? ` · vence ${formatDate(status.tokenExpiresAt)}` : ''}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDisconnect(true)}>
          <Unplug aria-hidden /> Desconectar
        </Button>
      </section>

      {status.lastSyncError ? (
        <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="break-words">Última importación con problemas: {status.lastSyncError}</span>
        </p>
      ) : null}

      {/* Pestañas y acciones */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="tablist" aria-label="Red social" className="flex w-fit gap-1 rounded-xl bg-zinc-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={network === tab.id}
              onClick={() => switchNetwork(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                network === tab.id ? 'bg-white font-medium text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <tab.icon className="h-4 w-4" aria-hidden /> {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => void loadFeed(network)} disabled={feed.loading || importing !== null} aria-label="Actualizar lista">
            <RefreshCw className={feed.loading ? 'animate-spin' : ''} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelected(allSelected ? new Set() : new Set(importable.map((post) => post.id)))}
            disabled={importable.length === 0 || importing !== null}
          >
            {allSelected ? 'Quitar selección' : 'Seleccionar todo'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void runImport(false)} disabled={selectedIds.length === 0 || importing !== null}>
            Importar seleccionadas como borrador{selectedIds.length ? ` (${selectedIds.length})` : ''}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void runImport(true)}
            disabled={selectedIds.length === 0 || importing !== null}
            className="bg-sky-600 text-white hover:bg-sky-700"
          >
            Importar y publicar
          </Button>
        </div>
      </div>

      {importing ? (
        <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/60 p-4" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-sky-900">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Importando {importing.done} de {importing.total}… descargando fotos y videos
          </p>
          <Progress value={(importing.done / importing.total) * 100} aria-label="Progreso de importación" />
        </div>
      ) : null}

      {lastErrors.length > 0 ? (
        <details className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <summary className="cursor-pointer font-medium">Detalle de la última importación ({lastErrors.length})</summary>
          <ul className="mt-2 space-y-1 text-xs">
            {lastErrors.map((entry, index) => (
              <li key={`${entry.id}-${index}`} className="break-words">
                <code>{entry.id}</code>: {entry.error}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Grilla de posts */}
      {network === 'instagram' && !status.igUserId ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-600">
          La página conectada no tiene una cuenta de Instagram profesional vinculada, o el token no incluye <code>instagram_basic</code>. Vincúlala desde
          la configuración de la página en Facebook y vuelve a conectar.
        </div>
      ) : feed.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="break-words">{feed.error}</p>
          <button type="button" onClick={() => void loadFeed(network)} className="mt-2 font-medium underline">
            Reintentar
          </button>
        </div>
      ) : !feed.loaded || (feed.loading && feed.posts.length === 0) ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="aspect-square animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      ) : feed.posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-500">
          No encontramos publicaciones en {network === 'instagram' ? 'Instagram' : 'Facebook'}.
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {feed.posts.map((post) => (
              <PostTile key={post.id} post={post} selected={selected.has(post.id)} disabled={importing !== null} onToggle={() => toggle(post.id)} />
            ))}
          </ul>
          {feed.nextCursor ? (
            <div className="flex justify-center">
              <Button type="button" variant="outline" onClick={() => void loadFeed(network, feed.nextCursor)} disabled={feed.loading}>
                {feed.loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Cargar más
              </Button>
            </div>
          ) : null}
        </>
      )}

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desconectar Meta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará el token guardado. Las publicaciones ya importadas y sus fotos se mantienen en el sitio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDisconnect()
              }}
              disabled={disconnecting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {disconnecting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function PostTile({ post, selected, disabled, onToggle }: { post: SocialPostDTO; selected: boolean; disabled: boolean; onToggle: () => void }) {
  const first = post.media[0]
  const thumb = first ? (first.type === 'video' ? first.thumbnailUrl : first.url) : null
  const caption = post.caption.replace(/\s+/g, ' ').trim()
  const label = caption ? caption.slice(0, 80) : `Post del ${formatDate(post.timestamp)}`

  return (
    <li className="group relative">
      <label
        className={`block cursor-pointer overflow-hidden rounded-xl border bg-white transition focus-within:ring-2 focus-within:ring-sky-500 ${
          selected ? 'border-sky-500 ring-2 ring-sky-500/30' : 'border-zinc-200 hover:border-zinc-300'
        } ${post.alreadyImported ? 'cursor-default' : ''}`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={selected}
          onChange={onToggle}
          disabled={disabled || post.alreadyImported}
          aria-label={`Seleccionar: ${label}`}
        />
        <div className="relative aspect-square bg-zinc-100">
          {thumb ? (
            <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className={`h-full w-full object-cover ${post.alreadyImported ? 'opacity-60' : ''}`} />
          ) : (
            <div className="flex h-full items-center justify-center p-3 text-center text-xs text-zinc-400">Sin imagen</div>
          )}
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            {post.mediaType === 'VIDEO' ? (
              <Play className="h-3 w-3" aria-label="Video" />
            ) : post.mediaType === 'CAROUSEL_ALBUM' ? (
              <>
                <Images className="h-3 w-3" aria-label="Carrusel" /> {post.media.length}
              </>
            ) : null}
          </span>
          {!post.alreadyImported ? (
            <span
              aria-hidden
              className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                selected ? 'border-sky-600 bg-sky-600 text-white' : 'border-white bg-black/20 text-transparent'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
        <div className="space-y-1 p-2.5">
          <p className="line-clamp-2 min-h-[2.5em] text-xs leading-snug text-zinc-700">{caption || <span className="text-zinc-400">Sin texto</span>}</p>
          <p className="text-[11px] text-zinc-400">{formatDate(post.timestamp)}</p>
        </div>
      </label>
      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1">
        {post.alreadyImported ? (
          post.publicationId ? (
            <button
              type="button"
              onClick={() => openPublication(post.publicationId!)}
              className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              Ya importada
            </button>
          ) : (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">Ya importada</span>
          )
        ) : null}
        {post.permalink ? (
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver post original"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
      </div>
    </li>
  )
}
