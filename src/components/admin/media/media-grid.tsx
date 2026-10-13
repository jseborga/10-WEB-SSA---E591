'use client'

import { Check, FileText, Pencil, Sparkles, Video } from 'lucide-react'
import type { MediaAssetDTO } from '../types'
import { displayName } from './media-api'

type MediaGridProps = {
  items: MediaAssetDTO[]
  layout?: 'masonry' | 'grid'
  selectedIds?: ReadonlySet<string>
  activeId?: string | null
  onOpen: (asset: MediaAssetDTO) => void
  onDoubleOpen?: (asset: MediaAssetDTO) => void
  onEdit?: (asset: MediaAssetDTO) => void
}

function Thumb({ asset, masonry }: { asset: MediaAssetDTO; masonry: boolean }) {
  if (asset.kind === 'image') {
    const ratio = asset.width && asset.height ? `${asset.width} / ${asset.height}` : '4 / 3'
    return (
      <img
        src={asset.url}
        alt={asset.alt || ''}
        loading="lazy"
        decoding="async"
        className={masonry ? 'block h-auto w-full bg-zinc-100' : 'size-full bg-zinc-100 object-cover'}
        style={masonry ? { aspectRatio: ratio } : undefined}
      />
    )
  }

  const Icon = asset.kind === 'video' ? Video : FileText
  return (
    <span
      className={`flex flex-col items-center justify-center gap-2 bg-zinc-50 p-3 text-zinc-500 ${masonry ? 'aspect-[4/3] w-full' : 'size-full'}`}
    >
      <Icon className="size-7" aria-hidden />
      <span className="line-clamp-2 text-center text-[11px] break-all">{displayName(asset)}</span>
    </span>
  )
}

/** Rejilla compartida entre la biblioteca y el selector de medios. */
export function MediaGrid({ items, layout = 'grid', selectedIds, activeId, onOpen, onDoubleOpen, onEdit }: MediaGridProps) {
  const masonry = layout === 'masonry'

  return (
    <ul
      className={
        masonry
          ? 'columns-2 gap-3 sm:columns-3 lg:columns-4 2xl:columns-5'
          : 'grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
      }
    >
      {items.map((asset) => {
        const selected = selectedIds?.has(asset.id) ?? false
        const active = activeId === asset.id

        return (
          <li key={asset.id} className={masonry ? 'mb-3 break-inside-avoid' : ''}>
            <div
              className={`group relative overflow-hidden rounded-xl border bg-white transition ${
                selected || active ? 'border-sky-600 ring-2 ring-sky-600' : 'border-zinc-200 hover:border-zinc-300'
              } ${masonry ? '' : 'aspect-square'}`}
            >
              <button
                type="button"
                onClick={() => onOpen(asset)}
                onDoubleClick={onDoubleOpen ? () => onDoubleOpen(asset) : undefined}
                aria-pressed={selectedIds ? selected : undefined}
                aria-label={`${displayName(asset)}${asset.alt ? ` — ${asset.alt}` : ''}`}
                className="block size-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset"
              >
                <Thumb asset={asset} masonry={masonry} />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-zinc-950/70 to-transparent px-2 pt-6 pb-1.5 text-[11px] text-white opacity-0 transition group-hover:opacity-100">
                  {displayName(asset)}
                </span>
              </button>

              <span className="pointer-events-none absolute top-2 left-2 flex gap-1">
                {asset.source === 'ai' ? (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    <Sparkles className="size-3" aria-hidden /> IA
                  </span>
                ) : asset.source === 'editor' ? (
                  <span className="rounded-md bg-sky-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white">Editada</span>
                ) : null}
              </span>

              {selected ? (
                <span className="pointer-events-none absolute top-2 right-2 rounded-full bg-sky-600 p-1 text-white shadow">
                  <Check className="size-3.5" aria-hidden />
                </span>
              ) : onEdit && asset.kind === 'image' ? (
                <button
                  type="button"
                  onClick={() => onEdit(asset)}
                  aria-label={`Editar ${displayName(asset)}`}
                  title="Editar foto"
                  className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 text-zinc-700 shadow transition md:opacity-0 md:group-hover:opacity-100 hover:text-sky-700 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                >
                  <Pencil className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
