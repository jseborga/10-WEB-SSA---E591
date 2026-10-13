'use client'

import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Loader2, UploadCloud, X } from 'lucide-react'
import { formatBytes } from './media-api'
import type { UploadItem } from './use-uploads'

export function filesFromDataTransfer(dataTransfer: DataTransfer | null) {
  return dataTransfer ? Array.from(dataTransfer.files) : []
}

/** Envuelve un área que acepta archivos arrastrados y muestra un aviso al soltar. */
export function DropArea({
  onFiles,
  children,
  className = '',
  label = 'Suelta los archivos para subirlos',
}: {
  onFiles: (files: File[]) => void
  children: ReactNode
  className?: string
  label?: string
}) {
  const [active, setActive] = useState(false)
  const depth = useRef(0)

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')

  return (
    <div
      className={`relative ${className}`}
      onDragEnter={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        depth.current += 1
        setActive(true)
      }}
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault()
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setActive(false)
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        depth.current = 0
        setActive(false)
        const files = filesFromDataTransfer(event.dataTransfer)
        if (files.length) onFiles(files)
      }}
    >
      {children}
      {active ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-sky-500 bg-sky-50/90">
          <p className="flex items-center gap-2 text-sm font-medium text-sky-800">
            <UploadCloud className="size-5" aria-hidden /> {label}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export function UploadQueue({
  items,
  onDismiss,
  onClear,
}: {
  items: UploadItem[]
  onDismiss: (key: string) => void
  onClear: () => void
}) {
  if (items.length === 0) return null
  const finished = items.filter((item) => item.status === 'done' || item.status === 'error').length

  return (
    <section aria-label="Subidas" className="rounded-xl border border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
        <p className="text-xs font-medium text-zinc-700">
          Subidas · {finished}/{items.length}
        </p>
        {finished > 0 ? (
          <button type="button" onClick={onClear} className="rounded-md px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800">
            Limpiar terminadas
          </button>
        ) : null}
      </header>
      <ul className="max-h-48 divide-y divide-zinc-100 overflow-y-auto">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-3 px-3 py-2">
            <span className="shrink-0" aria-hidden>
              {item.status === 'done' ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : item.status === 'error' ? (
                <AlertCircle className="size-4 text-red-600" />
              ) : (
                <Loader2 className="size-4 animate-spin text-sky-600" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-xs font-medium text-zinc-800">{item.name}</p>
                <span className="shrink-0 text-[11px] text-zinc-500 tabular-nums">
                  {item.status === 'uploading' ? `${Math.round(item.progress * 100)}%` : formatBytes(item.size)}
                </span>
              </div>
              {item.status === 'error' ? (
                <p className="truncate text-[11px] text-red-600">{item.error}</p>
              ) : (
                <div
                  className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-100"
                  role="progressbar"
                  aria-label={`Progreso de ${item.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(item.progress * 100)}
                >
                  <div
                    className={`h-full rounded-full transition-[width] ${item.status === 'done' ? 'bg-emerald-500' : 'bg-sky-600'}`}
                    style={{ width: `${Math.round(item.progress * 100)}%` }}
                  />
                </div>
              )}
            </div>
            {item.status === 'done' || item.status === 'error' ? (
              <button
                type="button"
                onClick={() => onDismiss(item.key)}
                aria-label={`Quitar ${item.name} de la lista`}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
