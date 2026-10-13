'use client'

import { useMemo, useRef, useState } from 'react'
import { Loader2, Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MediaGrid } from './media/media-grid'
import { UPLOAD_ACCEPT, type MediaFilter } from './media/media-api'
import { DropArea, UploadQueue } from './media/upload-queue'
import { useMediaList } from './media/use-media-list'
import { useUploads } from './media/use-uploads'
import { PhotoEditor } from './photo-editor'
import type { MediaAssetDTO, MediaPickerProps } from './types'

const FILTER_LABELS: Record<MediaFilter, string> = {
  all: 'Todo',
  image: 'Imágenes',
  video: 'Vídeos',
  document: 'Documentos',
  ai: 'Editadas con IA',
}

function filtersFor(accept: MediaPickerProps['accept']): MediaFilter[] {
  if (accept === 'image') return ['image', 'ai']
  if (accept === 'video') return ['video']
  return ['all', 'image', 'video', 'document', 'ai']
}

export function MediaPicker({ open, onOpenChange, onSelect, multiple = false, accept = 'all', title }: MediaPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[88dvh] sm:max-w-5xl sm:rounded-2xl">
        {open ? (
          <PickerBody
            multiple={multiple}
            accept={accept}
            title={title}
            onCancel={() => onOpenChange(false)}
            onConfirm={(assets) => {
              onSelect(assets)
              onOpenChange(false)
            }}
          />
        ) : (
          <DialogTitle className="sr-only">{title || 'Biblioteca de medios'}</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  )
}

type PickerBodyProps = {
  multiple: boolean
  accept: NonNullable<MediaPickerProps['accept']>
  title?: string
  onCancel: () => void
  onConfirm: (assets: MediaAssetDTO[]) => void
}

function PickerBody({ multiple, accept, title, onCancel, onConfirm }: PickerBodyProps) {
  const filters = filtersFor(accept)
  const [filter, setFilter] = useState<MediaFilter>(filters[0])
  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState<MediaAssetDTO[]>([])
  const [editing, setEditing] = useState<MediaAssetDTO | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const list = useMediaList({ filter, query })
  const selectedIds = useMemo(() => new Set(selection.map((item) => item.id)), [selection])

  const accepts = (asset: MediaAssetDTO) => accept === 'all' || asset.kind === accept

  const pick = (asset: MediaAssetDTO) => {
    if (!accepts(asset)) return
    setSelection((previous) => {
      if (!multiple) return [asset]
      return previous.some((item) => item.id === asset.id) ? previous.filter((item) => item.id !== asset.id) : [...previous, asset]
    })
  }

  const uploads = useUploads((asset) => {
    list.upsert(asset)
    if (!accepts(asset)) return
    setSelection((previous) => (multiple ? [...previous.filter((item) => item.id !== asset.id), asset] : [asset]))
  })

  const startUpload = async (files: File[]) => {
    const uploaded = await uploads.upload(files)
    if (uploaded.length) toast.success(uploaded.length === 1 ? 'Archivo subido y seleccionado' : `${uploaded.length} archivos subidos y seleccionados`)
  }

  return (
    <DropArea onFiles={startUpload} className="flex min-h-0 flex-1 flex-col">
      <header className="space-y-3 border-b border-zinc-200 px-4 pt-4 pb-3 pr-12 md:px-6">
        <div>
          <DialogTitle className="text-lg font-semibold text-zinc-900">{title || 'Biblioteca de medios'}</DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            {multiple ? 'Selecciona uno o varios archivos.' : 'Selecciona un archivo.'} También puedes arrastrar archivos aquí
            para subirlos.
          </DialogDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {filters.length > 1 ? (
            <div role="tablist" aria-label="Filtrar por tipo" className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1">
              {filters.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => setFilter(id)}
                  className={`shrink-0 rounded-lg px-3 py-1 text-sm transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none ${
                    filter === id ? 'bg-white font-medium text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {FILTER_LABELS[id]}
                </button>
              ))}
            </div>
          ) : null}
          <form role="search" onSubmit={(event) => event.preventDefault()} className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar"
              aria-label="Buscar en la biblioteca"
              className="rounded-xl pl-9"
            />
          </form>
          <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} className="sm:ml-auto">
            <Upload aria-hidden /> Subir
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={UPLOAD_ACCEPT[accept]}
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

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6">
        <UploadQueue items={uploads.items} onDismiss={uploads.dismiss} onClear={uploads.clearFinished} />

        {list.error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {list.error}
          </p>
        ) : null}

        {list.initialLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-zinc-500">
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> Cargando…
          </div>
        ) : list.items.length === 0 && !list.loading ? (
          <div className="rounded-xl border border-dashed border-zinc-300 py-16 text-center text-sm text-zinc-500">
            {query ? 'Nada coincide con la búsqueda.' : 'No hay archivos todavía. Arrastra fotos aquí o pulsa «Subir».'}
          </div>
        ) : (
          <div className={list.loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <MediaGrid
              items={list.items}
              selectedIds={selectedIds}
              onOpen={pick}
              onDoubleOpen={(asset) => {
                if (!multiple && accepts(asset)) onConfirm([asset])
              }}
              onEdit={setEditing}
            />
          </div>
        )}

        {list.hasMore ? (
          <div className="flex justify-center">
            <Button type="button" variant="outline" onClick={list.loadMore} disabled={list.loadingMore}>
              {list.loadingMore ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Cargar más
            </Button>
          </div>
        ) : null}
      </div>

      <footer className="flex flex-col-reverse gap-2 border-t border-zinc-200 bg-white px-4 py-3 sm:flex-row sm:items-center md:px-6">
        <p className="text-sm text-zinc-500 sm:mr-auto" aria-live="polite">
          {selection.length === 0
            ? 'Nada seleccionado'
            : selection.length === 1
              ? `Seleccionado: ${selection[0].originalName || selection[0].fileName}`
              : `${selection.length} seleccionados`}
        </p>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={() => onConfirm(selection)}
          disabled={selection.length === 0}
          className="bg-sky-600 text-white hover:bg-sky-700"
        >
          {multiple && selection.length > 1 ? `Usar ${selection.length} archivos` : 'Usar selección'}
        </Button>
      </footer>

      <PhotoEditor
        asset={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onSaved={(asset) => {
          list.upsert(asset)
          // La nueva versión sustituye al original en la selección
          setSelection((previous) => {
            const base = previous.filter((item) => item.id !== asset.parentId && item.id !== asset.id)
            return multiple ? [...base, asset] : [asset]
          })
        }}
      />
    </DropArea>
  )
}
