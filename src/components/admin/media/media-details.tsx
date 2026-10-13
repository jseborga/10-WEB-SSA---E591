'use client'

import { useEffect, useState } from 'react'
import { Copy, ExternalLink, GitBranch, Loader2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { getAiImagePreset } from '@/lib/ai-image-presets'
import { describeChanges, INITIAL_EDITOR_STATE, type EditorState } from '../photo-editor/editor-state'
import type { MediaAssetDTO } from '../types'
import {
  deleteMediaAsset,
  displayName,
  fetchMediaDetail,
  formatBytes,
  formatDate,
  sourceBadgeClass,
  sourceLabel,
  updateMediaAsset,
  type MediaDetail,
} from './media-api'

type MediaDetailsProps = {
  asset: MediaAssetDTO | null
  open: boolean
  canDelete: boolean
  onOpenChange: (open: boolean) => void
  onChanged: (asset: MediaAssetDTO) => void
  onDeleted: (id: string) => void
  onEdit: (asset: MediaAssetDTO) => void
  onNavigate: (asset: MediaAssetDTO) => void
}

/** Explica en lenguaje llano cómo se creó una versión (transparencia). */
function describeRecipe(raw: string | null): string[] {
  if (!raw) return []

  try {
    const recipe = JSON.parse(raw) as Record<string, unknown>

    if (typeof recipe.model === 'string') {
      const preset = getAiImagePreset(typeof recipe.preset === 'string' ? recipe.preset : null)
      return [
        `Generada con ${recipe.model}`,
        preset ? `Estilo: ${preset.label}` : '',
        typeof recipe.prompt === 'string' && recipe.prompt ? `Instrucción: «${recipe.prompt}»` : '',
      ].filter(Boolean)
    }

    const state: EditorState = {
      ...INITIAL_EDITOR_STATE,
      rotation: typeof recipe.rotation === 'number' ? recipe.rotation : 0,
      flipH: recipe.flipH === true,
      aspect: (typeof recipe.aspect === 'string' ? recipe.aspect : 'free') as EditorState['aspect'],
      crop: (recipe.crop as EditorState['crop']) ?? null,
      adjustments: { ...INITIAL_EDITOR_STATE.adjustments, ...((recipe.adjustments as object) ?? {}) },
    }
    return describeChanges(state).map((chip) => chip.label)
  } catch {
    return []
  }
}

function SmallThumb({ asset, onClick }: { asset: MediaAssetDTO; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 p-2 text-left transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
    >
      {asset.kind === 'image' ? (
        <img src={asset.url} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg bg-zinc-100 object-cover" />
      ) : (
        <span className="size-12 shrink-0 rounded-lg bg-zinc-100" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-800">{displayName(asset)}</span>
        <span className="block text-xs text-zinc-500">
          {sourceLabel(asset.source)} · {formatDate(asset.createdAt)}
        </span>
      </span>
    </button>
  )
}

function AltEditor({ asset, onChanged }: { asset: MediaAssetDTO; onChanged: (asset: MediaAssetDTO) => void }) {
  const [value, setValue] = useState(asset.alt ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const next = value.trim()
    if (next === (asset.alt ?? '')) return
    setSaving(true)

    try {
      onChanged(await updateMediaAsset(asset.id, { alt: next || null }))
      toast.success('Texto alternativo guardado')
    } catch (error) {
      toast.error('No se pudo guardar el texto alternativo', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <label htmlFor={`alt-${asset.id}`} className="mb-1.5 flex items-center justify-between text-sm font-medium text-zinc-800">
        Texto alternativo
        {saving ? <Loader2 className="size-3.5 animate-spin text-zinc-400" aria-label="Guardando" /> : null}
      </label>
      <Textarea
        id={`alt-${asset.id}`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        maxLength={500}
        rows={2}
        placeholder="Describe la foto: p. ej. «Fachada del edificio terminado en Asunción al atardecer»"
      />
      <p className="mt-1 text-xs text-zinc-500">Se guarda al salir del campo. Ayuda al SEO y a la accesibilidad.</p>
    </div>
  )
}

export function MediaDetails({ asset, open, canDelete, onOpenChange, onChanged, onDeleted, onEdit, onNavigate }: MediaDetailsProps) {
  const [detail, setDetail] = useState<MediaDetail | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const assetId = asset?.id ?? null

  useEffect(() => {
    if (!assetId || !open) return
    let cancelled = false
    fetchMediaDetail(assetId).then(
      (result) => {
        if (!cancelled) setDetail(result)
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [assetId, open, asset?.alt])

  const current = detail && detail.asset.id === assetId ? detail : null
  const recipe = describeRecipe(current?.editRecipe ?? null)

  const copyUrl = async () => {
    if (!asset) return
    const absolute = new URL(asset.url, window.location.origin).href
    try {
      await navigator.clipboard.writeText(absolute)
      toast.success('URL copiada', { description: absolute })
    } catch {
      toast.error('No se pudo copiar la URL', { description: absolute })
    }
  }

  const remove = async () => {
    if (!asset) return
    setDeleting(true)

    try {
      await deleteMediaAsset(asset.id)
      toast.success('Archivo eliminado')
      setConfirmDelete(false)
      onDeleted(asset.id)
    } catch (error) {
      toast.error('No se pudo eliminar', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {asset ? (
          <>
            <SheetHeader className="border-b border-zinc-100 pr-12">
              <SheetTitle className="truncate">{displayName(asset)}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${sourceBadgeClass(asset.source)}`}>
                  {sourceLabel(asset.source)}
                </span>
                <span className="text-xs">{formatDate(asset.createdAt)}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 p-4">
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                {asset.kind === 'image' ? (
                  <img src={asset.url} alt={asset.alt || ''} className="mx-auto max-h-[45dvh] w-auto object-contain" />
                ) : asset.kind === 'video' ? (
                  <video src={asset.url} controls preload="metadata" className="max-h-[45dvh] w-full bg-black" />
                ) : (
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-10 text-sm font-medium text-sky-700 hover:underline"
                  >
                    <ExternalLink className="size-4" aria-hidden /> Abrir documento
                  </a>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {asset.kind === 'image' ? (
                  <Button type="button" onClick={() => onEdit(asset)} className="bg-sky-600 text-white hover:bg-sky-700">
                    <Pencil aria-hidden /> Editar foto
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={copyUrl} className={asset.kind === 'image' ? '' : 'col-span-2'}>
                  <Copy aria-hidden /> Copiar URL
                </Button>
              </div>

              <AltEditor key={asset.id} asset={asset} onChanged={onChanged} />

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-zinc-50 p-3 text-sm">
                <div>
                  <dt className="text-xs text-zinc-500">Dimensiones</dt>
                  <dd className="font-medium text-zinc-800 tabular-nums">
                    {asset.width && asset.height ? `${asset.width} × ${asset.height} px` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">Peso</dt>
                  <dd className="font-medium text-zinc-800 tabular-nums">{formatBytes(asset.size)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">Formato</dt>
                  <dd className="font-medium text-zinc-800">{asset.mimeType?.split('/')[1]?.toUpperCase() || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">Origen</dt>
                  <dd className="font-medium text-zinc-800">{sourceLabel(asset.source)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-zinc-500">Archivo</dt>
                  <dd className="truncate font-mono text-xs text-zinc-700">{asset.fileName}</dd>
                </div>
              </dl>

              {recipe.length ? (
                <section>
                  <h3 className="mb-2 text-sm font-medium text-zinc-800">Cómo se hizo esta versión</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {recipe.map((line) => (
                      <li key={line} className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs text-zinc-700">
                        {line}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {current?.parent || current?.children.length ? (
                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-medium text-zinc-800">
                    <GitBranch className="size-4 text-zinc-500" aria-hidden /> Versiones
                  </h3>
                  {current.parent ? (
                    <div>
                      <p className="mb-1 text-xs text-zinc-500">Versión de:</p>
                      <SmallThumb asset={current.parent} onClick={() => onNavigate(current.parent!)} />
                    </div>
                  ) : null}
                  {current.children.length ? (
                    <div>
                      <p className="mb-1 text-xs text-zinc-500">Versiones creadas a partir de esta ({current.children.length}):</p>
                      <ul className="space-y-1.5">
                        {current.children.map((child) => (
                          <li key={child.id}>
                            <SmallThumb asset={child} onClick={() => onNavigate(child)} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              ) : asset.parentId && !current ? (
                <p className="text-xs text-zinc-400">Cargando versiones…</p>
              ) : null}

              {canDelete ? (
                <div className="border-t border-zinc-100 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 aria-hidden /> Eliminar archivo
                  </Button>
                </div>
              ) : null}
            </div>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se borrará «{displayName(asset)}» de la biblioteca y del almacenamiento. Si alguna página lo usa, dejará de
                    verse. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault()
                      void remove()
                    }}
                    disabled={deleting}
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    {deleting ? <Loader2 className="animate-spin" aria-hidden /> : null} Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <SheetTitle className="sr-only">Detalles del archivo</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  )
}
