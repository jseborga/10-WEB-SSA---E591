'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageIcon, Loader2, RefreshCw, Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MediaDetails } from './media/media-details'
import { MediaGrid } from './media/media-grid'
import { UPLOAD_ACCEPT, reindexMedia, type MediaFilter } from './media/media-api'
import { DropArea, UploadQueue } from './media/upload-queue'
import { useMediaList } from './media/use-media-list'
import { useUploads } from './media/use-uploads'
import { PhotoEditor } from './photo-editor'
import type { AdminSessionInfo, MediaAssetDTO } from './types'

const FILTERS: Array<{ id: MediaFilter; label: string }> = [
  { id: 'all', label: 'Todo' },
  { id: 'image', label: 'Imágenes' },
  { id: 'video', label: 'Vídeos' },
  { id: 'document', label: 'Documentos' },
  { id: 'ai', label: 'Editadas con IA' },
]

export function MediaLibrary() {
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<MediaAssetDTO | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editing, setEditing] = useState<MediaAssetDTO | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [canDelete, setCanDelete] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  const list = useMediaList({ filter, query, withCounts: true })
  const uploads = useUploads((asset) => list.upsert(asset))

  useEffect(() => {
    fetch('/api/admin/session', { credentials: 'same-origin' })
      .then((response) => (response.ok ? (response.json() as Promise<AdminSessionInfo>) : null))
      .then((session) => setCanDelete(session?.role === 'admin'))
      .catch(() => undefined)
  }, [])

  // Carga automática al llegar al final de la rejilla
  const { hasMore, loadMore, loadingMore } = list
  useEffect(() => {
    const element = sentinel.current
    if (!element || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore()
      },
      { rootMargin: '600px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasMore, loadMore, loadingMore])

  const startUpload = async (files: File[]) => {
    const uploaded = await uploads.upload(files)
    if (uploaded.length) {
      toast.success(uploaded.length === 1 ? 'Archivo subido' : `${uploaded.length} archivos subidos`)
      list.reload()
    }
  }

  const sync = async () => {
    setSyncing(true)
    let created = 0
    let total = 0

    try {
      // El servidor procesa por tandas: se repite mientras queden archivos.
      for (let round = 0; round < 10; round += 1) {
        const result = await reindexMedia()
        created += result.created
        total = result.total
        if (result.remaining === 0 || result.created === 0) break
      }
      toast.success(created ? `Se añadieron ${created} archivos a la biblioteca` : 'La biblioteca ya estaba al día', {
        description: `${total} archivos en el almacenamiento.`,
      })
      list.reload()
    } catch (error) {
      toast.error('No se pudo sincronizar', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSyncing(false)
    }
  }

  const openDetails = (asset: MediaAssetDTO) => {
    setSelected(asset)
    setDetailsOpen(true)
  }

  const counts = list.counts

  return (
    <DropArea onFiles={startUpload} className="min-h-full">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Fotos y medios</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {counts
                ? `${counts.all} archivos · ${counts.image} imágenes · ${counts.video} vídeos · ${counts.document} documentos`
                : 'Fotos, vídeos y documentos de la web.'}{' '}
              Arrastra archivos a cualquier parte de esta página para subirlos.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={sync}
              disabled={syncing}
              title="Añade a la biblioteca los archivos que ya están en el almacenamiento pero no aparecen aquí"
            >
              {syncing ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
              Sincronizar biblioteca
            </Button>
            <Button type="button" onClick={() => fileInput.current?.click()} className="bg-sky-600 text-white hover:bg-sky-700">
              <Upload aria-hidden /> Subir archivos
            </Button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={UPLOAD_ACCEPT.all}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                event.target.value = ''
                if (files.length) void startUpload(files)
              }}
            />
          </div>
        </header>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div role="tablist" aria-label="Filtrar por tipo" className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1">
            {FILTERS.map((item) => {
              const active = filter === item.id
              const count = counts?.[item.id]
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(item.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none ${
                    active ? 'bg-white font-medium text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {item.label}
                  {count !== undefined ? <span className="ml-1.5 text-xs text-zinc-400 tabular-nums">{count}</span> : null}
                </button>
              )
            })}
          </div>
          <form role="search" onSubmit={(event) => event.preventDefault()} className="relative md:ml-auto md:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o texto alternativo"
              aria-label="Buscar en la biblioteca"
              className="rounded-xl pl-9"
            />
          </form>
        </div>

        <UploadQueue items={uploads.items} onDismiss={uploads.dismiss} onClear={uploads.clearFinished} />

        {list.error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {list.error}{' '}
            <button type="button" onClick={list.reload} className="font-medium underline">
              Reintentar
            </button>
          </p>
        ) : null}

        <div className={`transition-opacity ${list.loading && !list.initialLoading ? 'opacity-60' : ''}`} aria-busy={list.loading}>
          {list.initialLoading ? (
            <div className="flex items-center justify-center py-24 text-sm text-zinc-500">
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> Cargando biblioteca…
            </div>
          ) : list.items.length === 0 && !list.loading ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 py-20 text-center">
              <span className="rounded-2xl bg-zinc-100 p-4 text-zinc-400">
                <ImageIcon className="size-8" aria-hidden />
              </span>
              <p className="font-medium text-zinc-800">{query ? 'Nada coincide con la búsqueda' : 'Aún no hay archivos aquí'}</p>
              <p className="max-w-md text-sm text-zinc-500">
                {query
                  ? 'Prueba con otra palabra o cambia el filtro.'
                  : 'Sube fotos arrastrándolas a esta página. Si venías del servidor anterior, pulsa «Sincronizar biblioteca» para recuperar tus archivos.'}
              </p>
            </div>
          ) : (
            <MediaGrid
              items={list.items}
              layout="masonry"
              activeId={detailsOpen ? selected?.id : null}
              onOpen={openDetails}
              onEdit={setEditing}
            />
          )}
        </div>

        {list.hasMore ? (
          <div ref={sentinel} className="flex justify-center pb-8">
            <Button type="button" variant="outline" onClick={list.loadMore} disabled={list.loadingMore}>
              {list.loadingMore ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Cargar más
            </Button>
          </div>
        ) : null}
      </div>

      <MediaDetails
        asset={selected}
        open={detailsOpen}
        canDelete={canDelete}
        onOpenChange={setDetailsOpen}
        onChanged={(asset) => {
          setSelected(asset)
          list.upsert(asset)
        }}
        onDeleted={(id) => {
          list.remove(id)
          setDetailsOpen(false)
          setSelected(null)
        }}
        onEdit={setEditing}
        onNavigate={(asset) => setSelected(asset)}
      />

      <PhotoEditor
        asset={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onSaved={(asset) => {
          list.upsert(asset)
          setSelected(asset)
          setDetailsOpen(true)
        }}
      />
    </DropArea>
  )
}
