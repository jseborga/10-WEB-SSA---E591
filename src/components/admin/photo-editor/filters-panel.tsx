'use client'

import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { FILTERS, matchFilter } from './editor-state'
import { applyAdjustments, cloneImageData, type Adjustments } from './image-pipeline'

type FiltersPanelProps = {
  /** Miniatura sin ajustes (ya recortada y girada) sobre la que se previsualiza cada filtro. */
  thumbnail: ImageData | null
  adjustments: Adjustments
  onSelect: (adjustments: Adjustments) => void
}

function renderThumb(base: ImageData, adjustments: Adjustments) {
  const canvas = document.createElement('canvas')
  canvas.width = base.width
  canvas.height = base.height
  canvas.getContext('2d')!.putImageData(applyAdjustments(cloneImageData(base), adjustments, 0.5), 0, 0)
  return canvas.toDataURL('image/jpeg', 0.8)
}

export function FiltersPanel({ thumbnail, adjustments, onSelect }: FiltersPanelProps) {
  const thumbs = useMemo(
    () => (thumbnail ? Object.fromEntries(FILTERS.map((filter) => [filter.id, renderThumb(thumbnail, filter.adjustments)])) : {}),
    [thumbnail],
  )
  const active = matchFilter(adjustments)

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-zinc-600">
        Un filtro solo coloca los deslizadores de <strong>Ajustar</strong>: puedes retocarlos después.
      </p>
      <ul className="grid grid-cols-3 gap-2 md:grid-cols-2">
        {FILTERS.map((filter) => {
          const selected = active === filter.id
          return (
            <li key={filter.id}>
              <button
                type="button"
                onClick={() => onSelect(filter.adjustments)}
                aria-pressed={selected}
                className={`group w-full overflow-hidden rounded-xl border text-left transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none ${
                  selected ? 'border-sky-600 ring-1 ring-sky-600' : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <span className="relative block aspect-square bg-zinc-100">
                  {thumbs[filter.id] ? (
                    <img src={thumbs[filter.id]} alt="" className="size-full object-cover" />
                  ) : null}
                  {selected ? (
                    <span className="absolute top-1.5 right-1.5 rounded-full bg-sky-600 p-0.5 text-white">
                      <Check className="size-3" aria-hidden />
                    </span>
                  ) : null}
                </span>
                <span className="block px-2 py-1.5 text-xs font-medium text-zinc-800">{filter.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
