'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type MutableRefObject } from 'react'
import {
  Columns2,
  Crop,
  Eye,
  FileWarning,
  Loader2,
  Palette,
  Redo2,
  Save,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEFAULT_AI_IMAGE_PRESET } from '@/lib/ai-image-presets'
import { AdjustPanel } from './photo-editor/adjust-panel'
import { AiPanel } from './photo-editor/ai-panel'
import { CropOverlay } from './photo-editor/crop-overlay'
import { CropPanel } from './photo-editor/crop-panel'
import {
  INITIAL_EDITOR_STATE,
  describeChanges,
  fitAspect,
  getAspectRatio,
  isFullCrop,
  isPristine,
  type AspectId,
  type EditorState,
} from './photo-editor/editor-state'
import { FiltersPanel } from './photo-editor/filters-panel'
import {
  applyAdjustments,
  canvasToBlob,
  cloneImageData,
  computeAutoAdjustments,
  finalSize,
  orientedSize,
  readImageData,
  renderGeometry,
  type Adjustments,
  type CropRect,
} from './photo-editor/image-pipeline'
import { useHistory } from './photo-editor/use-history'
import { MediaApiError, deleteMediaAsset, displayName, enhanceWithAi, formatBytes, uploadMediaFile } from './media/media-api'
import type { MediaAssetDTO, PhotoEditorProps } from './types'

const PREVIEW_EDGE = 1600
const EXPORT_EDGE = 3200
const STAGE_PADDING = 24

type Tab = 'crop' | 'adjust' | 'filters' | 'ai'

export function PhotoEditor({ asset, open, onOpenChange, onSaved }: PhotoEditorProps) {
  const dirtyRef = useRef(false)

  const requestClose = (next: boolean) => {
    if (!next && dirtyRef.current && !window.confirm('Tienes cambios sin guardar. ¿Cerrar el editor y descartarlos?')) {
      return
    }
    if (!next) dirtyRef.current = false
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-0 left-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-white p-0 sm:max-w-none data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100"
      >
        {open && asset ? (
          asset.kind === 'image' ? (
            <EditorBody
              key={asset.id}
              asset={asset}
              dirtyRef={dirtyRef}
              onClose={() => requestClose(false)}
              onSaved={(saved) => {
                dirtyRef.current = false
                onSaved(saved)
                onOpenChange(false)
              }}
            />
          ) : (
            <NotEditable asset={asset} onClose={() => onOpenChange(false)} />
          )
        ) : (
          <DialogTitle className="sr-only">Editor de fotos</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  )
}

function NotEditable({ asset, onClose }: { asset: MediaAssetDTO; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="rounded-2xl bg-zinc-100 p-4 text-zinc-500">
        <FileWarning className="size-8" aria-hidden />
      </span>
      <DialogTitle className="text-lg font-semibold text-zinc-900">Este archivo no se puede editar</DialogTitle>
      <p className="max-w-sm text-sm text-zinc-600">
        «{displayName(asset)}» es un {asset.kind === 'video' ? 'vídeo' : 'documento'}. Por ahora el editor solo trabaja con
        fotos (JPG, PNG, WebP…).
      </p>
      <Button type="button" variant="outline" onClick={onClose}>
        Volver
      </Button>
    </div>
  )
}

function rotateRect(rect: CropRect, direction: 1 | -1): CropRect {
  return direction === 1
    ? { x: 1 - (rect.y + rect.h), y: rect.x, w: rect.h, h: rect.w }
    : { x: rect.y, y: 1 - (rect.x + rect.w), w: rect.h, h: rect.w }
}

const round4 = (value: number) => Math.round(value * 10000) / 10000

type EditorBodyProps = {
  asset: MediaAssetDTO
  dirtyRef: MutableRefObject<boolean>
  onClose: () => void
  onSaved: (asset: MediaAssetDTO) => void
}

function EditorBody({ asset, dirtyRef, onClose, onSaved }: EditorBodyProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('adjust')
  const [peek, setPeek] = useState(false)
  const [compare, setCompare] = useState(false)
  const [split, setSplit] = useState(50)
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const [estimate, setEstimate] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)

  const [aiPreset, setAiPreset] = useState<string | null>(DEFAULT_AI_IMAGE_PRESET)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiResult, setAiResult] = useState<{ asset: MediaAssetDTO; model: string } | null>(null)

  const history = useHistory<EditorState>(INITIAL_EDITOR_STATE)
  const state = history.state
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const beforeRef = useRef<HTMLCanvasElement>(null)

  // Carga de la imagen (mismo origen, sin contaminar el canvas)
  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      if (!cancelled) setImage(img)
    }
    img.onerror = () => {
      if (!cancelled) setLoadError('No se pudo cargar la imagen. Comprueba que el archivo sigue en la biblioteca.')
    }
    img.src = asset.url
    return () => {
      cancelled = true
    }
  }, [asset.url])

  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setStage({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const pristine = isPristine(state)
  useEffect(() => {
    dirtyRef.current = !pristine
  }, [pristine, dirtyRef])

  const naturalWidth = image?.naturalWidth ?? asset.width ?? 0
  const naturalHeight = image?.naturalHeight ?? asset.height ?? 0
  const oriented = orientedSize(naturalWidth, naturalHeight, state.rotation)
  const showFullFrame = tab === 'crop'
  const cropKey = showFullFrame ? 'full' : JSON.stringify(state.crop)

  // Base de la previsualización: geometría aplicada, sin ajustes de color.
  const base = useMemo(() => {
    if (!image) return null
    const canvas = renderGeometry(
      image,
      { rotation: state.rotation, flipH: state.flipH, crop: showFullFrame ? null : state.crop },
      PREVIEW_EDGE,
    )
    return readImageData(canvas)
  }, [image, state.rotation, state.flipH, cropKey])

  const fullCropKey = JSON.stringify(state.crop)
  const thumbnail = useMemo(() => {
    if (!image || tab !== 'filters') return null
    return readImageData(renderGeometry(image, { rotation: state.rotation, flipH: state.flipH, crop: state.crop }, 180))
  }, [image, tab, state.rotation, state.flipH, fullCropKey])

  // Render de la previsualización con nuestro propio pipeline de píxeles.
  useEffect(() => {
    if (!base) return
    const frame = requestAnimationFrame(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = base.width
      canvas.height = base.height
      canvas.getContext('2d')!.putImageData(applyAdjustments(cloneImageData(base), state.adjustments), 0, 0)
    })
    return () => cancelAnimationFrame(frame)
  }, [base, state.adjustments])

  const compareActive = compare && !showFullFrame
  useEffect(() => {
    const canvas = beforeRef.current
    if (!base || !canvas || !compareActive) return
    canvas.width = base.width
    canvas.height = base.height
    canvas.getContext('2d')!.putImageData(base, 0, 0)
  }, [base, compareActive])

  const output = image
    ? finalSize(naturalWidth, naturalHeight, { rotation: state.rotation, flipH: state.flipH, crop: state.crop }, EXPORT_EDGE)
    : null

  // Peso estimado: se codifica la previsualización y se escala por píxeles.
  useEffect(() => {
    if (!base || !output) return
    const timer = window.setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const area = showFullFrame && state.crop ? state.crop.w * state.crop.h : 1
      const previewPixels = canvas.width * canvas.height * area
      canvas.toBlob(
        (blob) => {
          if (blob && previewPixels > 0) setEstimate((blob.size * area * output.width * output.height) / previewPixels)
        },
        'image/webp',
        0.88,
      )
    }, 700)
    return () => window.clearTimeout(timer)
  }, [base, state.adjustments, state.crop, output?.width, output?.height])

  // Deshacer / rehacer con teclado
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text'))) return
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) history.redo()
        else history.undo()
      } else if (key === 'y') {
        event.preventDefault()
        history.redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history.undo, history.redo])

  const display = useMemo(() => {
    if (!base || stage.width <= 0 || stage.height <= 0) return null
    const availableW = Math.max(1, stage.width - STAGE_PADDING * 2)
    const availableH = Math.max(1, stage.height - STAGE_PADDING * 2)
    const scale = Math.min(availableW / base.width, availableH / base.height)
    return { width: Math.round(base.width * scale), height: Math.round(base.height * scale) }
  }, [base, stage.width, stage.height])

  const chips = describeChanges(state)
  const aspectRatio = getAspectRatio(state.aspect)
  const normalizedRatio = aspectRatio && oriented.width ? (aspectRatio * oriented.height) / oriented.width : null

  // --- Acciones ---

  const onCropChange = (rect: CropRect, commit: boolean) => {
    if (commit) {
      history.set((s) => ({ ...s, crop: s.aspect === 'free' && isFullCrop(rect) ? null : rect }))
    } else {
      history.set((s) => ({ ...s, crop: rect }), { transient: true })
    }
  }

  const onAspect = (aspect: AspectId) => {
    const ratio = getAspectRatio(aspect)
    history.set((s) => ({ ...s, aspect, crop: ratio ? fitAspect(ratio, oriented.width, oriented.height) : s.crop }))
  }

  const onRotate = (direction: 1 | -1) => {
    history.set((s) => {
      const rotation = (((s.rotation + 90 * direction * (s.flipH ? -1 : 1)) % 360) + 360) % 360
      const ratio = getAspectRatio(s.aspect)
      const next = orientedSize(naturalWidth, naturalHeight, rotation)
      const crop = ratio ? fitAspect(ratio, next.width, next.height) : s.crop ? rotateRect(s.crop, direction) : null
      return { ...s, rotation, crop }
    })
  }

  const onFlip = () => {
    history.set((s) => ({ ...s, flipH: !s.flipH, crop: s.crop ? { ...s.crop, x: 1 - s.crop.x - s.crop.w } : null }))
  }

  const onResetGeometry = () => {
    history.set((s) => ({ ...s, rotation: 0, flipH: false, crop: null, aspect: 'free' }))
  }

  const setAdjustment = (key: keyof Adjustments, value: number) => {
    history.set((s) => ({ ...s, adjustments: { ...s.adjustments, [key]: value } }), { transient: true })
  }

  const resetAdjustment = (key: keyof Adjustments) => {
    history.set((s) => (s.adjustments[key] === 0 ? s : { ...s, adjustments: { ...s.adjustments, [key]: 0 } }))
  }

  const onAuto = () => {
    if (!image) return
    const sample = readImageData(
      renderGeometry(image, { rotation: state.rotation, flipH: state.flipH, crop: state.crop }, 800),
    )
    const adjustments = computeAutoAdjustments(sample)
    history.set((s) => ({ ...s, adjustments }))
    const summary = describeChanges({ ...state, crop: null, rotation: 0, flipH: false, adjustments })
      .map((chip) => chip.label)
      .join(' · ')
    toast.success('Auto‑mejora aplicada', { description: summary || 'La foto ya estaba equilibrada.' })
  }

  const save = async () => {
    if (!image || !output) return
    setSaving(true)
    setProgress(0)

    try {
      const geometry = { rotation: state.rotation, flipH: state.flipH, crop: state.crop }
      const canvas = renderGeometry(image, geometry, EXPORT_EDGE)
      const data = readImageData(canvas)
      canvas.getContext('2d')!.putImageData(applyAdjustments(data, state.adjustments), 0, 0)
      const blob = await canvasToBlob(canvas)
      const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
      const baseName = displayName(asset).replace(/\.[a-z0-9]+$/i, '').slice(0, 60) || 'foto'
      const recipe = {
        version: 1,
        from: asset.id,
        rotation: state.rotation,
        flipH: state.flipH,
        aspect: state.aspect,
        crop: state.crop
          ? { x: round4(state.crop.x), y: round4(state.crop.y), w: round4(state.crop.w), h: round4(state.crop.h) }
          : null,
        adjustments: state.adjustments,
      }

      const saved = await uploadMediaFile(
        blob,
        `${baseName}-editada.${extension}`,
        {
          parentId: asset.id,
          width: canvas.width,
          height: canvas.height,
          alt: asset.alt,
          source: 'editor',
          editRecipe: JSON.stringify(recipe),
        },
        setProgress,
      )

      toast.success('Nueva versión guardada', {
        description: `${canvas.width} × ${canvas.height} px · ${formatBytes(saved.size)}. El original sigue intacto.`,
      })
      onSaved(saved)
    } catch (error) {
      toast.error('No se pudo guardar la versión', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      })
    } finally {
      setSaving(false)
    }
  }

  const generateAi = async () => {
    setAiLoading(true)
    setAiError(null)
    setAiResult(null)

    try {
      const result = await enhanceWithAi({ assetId: asset.id, preset: aiPreset ?? undefined, prompt: aiPrompt.trim() || undefined })
      setAiResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo generar la imagen.'
      setAiError(message)
      toast.error('Gemini no pudo mejorar la foto', { description: message })
    } finally {
      setAiLoading(false)
    }
  }

  const discardAi = async () => {
    const result = aiResult
    setAiResult(null)
    if (!result) return

    try {
      await deleteMediaAsset(result.asset.id)
      toast('Resultado descartado')
    } catch (error) {
      if (error instanceof MediaApiError && error.status === 403) {
        toast('Resultado descartado del editor', {
          description: 'Queda guardado en la biblioteca: solo un administrador puede borrarlo.',
        })
      } else {
        toast.error('No se pudo borrar el resultado', { description: error instanceof Error ? error.message : undefined })
      }
    }
  }

  const acceptAiResult = () => {
    if (!aiResult) return
    toast.success('Versión con IA guardada', { description: 'El original sigue intacto.' })
    onSaved(aiResult.asset)
  }

  const peekHandlers = {
    onPointerDown: () => setPeek(true),
    onPointerUp: () => setPeek(false),
    onPointerLeave: () => setPeek(false),
    onPointerCancel: () => setPeek(false),
    onKeyDown: (event: ReactKeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        setPeek(true)
      }
    },
    onKeyUp: () => setPeek(false),
    onContextMenu: (event: ReactMouseEvent) => event.preventDefault(),
    onBlur: () => setPeek(false),
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Cabecera */}
      <header className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 md:px-4">
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar editor">
          <X aria-hidden />
        </Button>
        <div className="min-w-0 flex-1">
          <DialogTitle className="truncate text-sm font-semibold text-zinc-900 md:text-base">Editar foto</DialogTitle>
          <p className="truncate text-xs text-zinc-500">{displayName(asset)}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={history.undo} disabled={!history.canUndo} aria-label="Deshacer (Ctrl+Z)" title="Deshacer (Ctrl+Z)">
            <Undo2 aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={history.redo} disabled={!history.canRedo} aria-label="Rehacer (Ctrl+Mayús+Z)" title="Rehacer (Ctrl+Mayús+Z)">
            <Redo2 aria-hidden />
          </Button>
        </div>
        <div className="hidden text-right text-xs leading-tight text-zinc-500 lg:block">
          {output ? (
            <>
              <span className="block font-medium text-zinc-700 tabular-nums">
                {output.width} × {output.height} px
              </span>
              <span className="block tabular-nums">{estimate ? `≈ ${formatBytes(estimate)} · WebP` : 'Calculando peso…'}</span>
            </>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={save}
          disabled={!image || pristine || saving}
          className="bg-sky-600 text-white hover:bg-sky-700"
          title={pristine ? 'Haz algún cambio para guardar una versión' : undefined}
        >
          {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          <span className="sm:hidden">{saving ? `${Math.round(progress * 100)}%` : 'Guardar'}</span>
          <span className="hidden sm:inline">
            {saving ? `Guardando… ${Math.round(progress * 100)}%` : 'Guardar como nueva versión'}
          </span>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Herramientas */}
        <aside className="order-2 flex max-h-[46dvh] min-h-0 shrink-0 flex-col border-t border-zinc-200 bg-white md:order-1 md:max-h-none md:w-[340px] md:border-t-0 md:border-r">
          <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="flex min-h-0 flex-1 flex-col gap-0">
            <TabsList className="m-3 grid h-auto w-auto grid-cols-4 rounded-xl bg-zinc-100 p-1">
              {[
                { id: 'crop', label: 'Recortar', icon: Crop },
                { id: 'adjust', label: 'Ajustar', icon: SlidersHorizontal },
                { id: 'filters', label: 'Filtros', icon: Palette },
                { id: 'ai', label: 'IA', icon: Sparkles },
              ].map((item) => (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className="flex h-auto flex-col gap-0.5 rounded-lg py-1.5 text-[11px] data-[state=active]:text-sky-700"
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <TabsContent value="crop">
                <CropPanel aspect={state.aspect} onAspect={onAspect} onRotate={onRotate} onFlip={onFlip} onReset={onResetGeometry} />
              </TabsContent>
              <TabsContent value="adjust">
                <AdjustPanel
                  adjustments={state.adjustments}
                  onChange={setAdjustment}
                  onCommit={history.commit}
                  onReset={resetAdjustment}
                  onAuto={onAuto}
                  autoDisabled={!image}
                />
              </TabsContent>
              <TabsContent value="filters">
                <FiltersPanel
                  thumbnail={thumbnail}
                  adjustments={state.adjustments}
                  onSelect={(adjustments) => history.set((s) => ({ ...s, adjustments }))}
                />
              </TabsContent>
              <TabsContent value="ai">
                <AiPanel
                  preset={aiPreset}
                  prompt={aiPrompt}
                  loading={aiLoading}
                  error={aiError}
                  hasLocalEdits={!pristine}
                  onPreset={setAiPreset}
                  onPrompt={setAiPrompt}
                  onGenerate={generateAi}
                />
              </TabsContent>
            </div>
          </Tabs>
        </aside>

        {/* Lienzo */}
        <main className="order-1 flex min-h-0 flex-1 flex-col bg-zinc-100 md:order-2">
          <div ref={stageRef} className="relative min-h-[240px] flex-1">
            {loadError ? (
              <p role="alert" className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-700">
                {loadError}
              </p>
            ) : !base ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> Cargando foto…
              </div>
            ) : null}

            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-sm"
              style={display ? { width: display.width, height: display.height } : { width: 0, height: 0 }}
            >
              <canvas ref={canvasRef} className="block size-full" aria-label="Previsualización de la foto editada" role="img" />
              {compareActive ? (
                <>
                  <canvas
                    ref={beforeRef}
                    className="pointer-events-none absolute inset-0 block size-full"
                    style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                    aria-hidden
                  />
                  <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${split}%` }} />
                  <span className="pointer-events-none absolute top-2 left-2 rounded-md bg-zinc-900/70 px-2 py-0.5 text-xs text-white">
                    Antes
                  </span>
                  <span className="pointer-events-none absolute top-2 right-2 rounded-md bg-sky-600/90 px-2 py-0.5 text-xs text-white">
                    Después
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={split}
                    onChange={(event) => setSplit(Number(event.target.value))}
                    aria-label="Posición de la comparación antes / después"
                    className="absolute inset-x-0 bottom-2 mx-auto w-2/3 accent-sky-600"
                  />
                </>
              ) : null}
              {showFullFrame && base ? (
                <CropOverlay rect={state.crop ?? { x: 0, y: 0, w: 1, h: 1 }} ratio={normalizedRatio} onChange={onCropChange} />
              ) : null}
            </div>

            {peek ? (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 p-6">
                <img src={asset.url} alt="Foto original sin cambios" className="max-h-full max-w-full object-contain shadow-sm" />
                <span className="absolute top-3 left-3 rounded-md bg-zinc-900/75 px-2 py-1 text-xs font-medium text-white">
                  Original
                </span>
              </div>
            ) : null}

            {aiLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 p-6 text-center backdrop-blur-sm" aria-live="polite">
                <Loader2 className="size-8 animate-spin text-sky-600" aria-hidden />
                <p className="text-sm font-medium text-zinc-800">Gemini está mejorando la foto…</p>
                <p className="text-xs text-zinc-500">Suele tardar entre 10 y 40 segundos.</p>
              </div>
            ) : null}

            {aiResult ? (
              <div className="absolute inset-0 flex flex-col gap-3 overflow-y-auto bg-zinc-100 p-3 md:p-6">
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Original', item: asset },
                    { label: `Resultado · ${aiResult.model}`, item: aiResult.asset },
                  ].map(({ label, item }) => (
                    <figure key={item.id} className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
                      <div className="flex min-h-[160px] flex-1 items-center justify-center bg-zinc-50 p-2">
                        <img src={item.url} alt={label} className="max-h-full max-w-full object-contain" />
                      </div>
                      <figcaption className="border-t border-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700">{label}</figcaption>
                    </figure>
                  ))}
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <p className="text-xs text-zinc-500 sm:mr-auto">Ya está guardado como versión nueva; el original no cambia.</p>
                  <Button type="button" variant="outline" onClick={discardAi}>
                    Descartar
                  </Button>
                  <Button type="button" onClick={acceptAiResult} className="bg-sky-600 text-white hover:bg-sky-700">
                    Usar este resultado
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Transparencia: qué ha cambiado */}
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 bg-white px-3 py-2">
            <Button type="button" variant="outline" size="sm" {...peekHandlers} disabled={!image} className="select-none">
              <Eye aria-hidden /> Mantén pulsado para ver el original
            </Button>
            <Button
              type="button"
              variant={compareActive ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={compareActive}
              onClick={() => setCompare((value) => !value)}
              disabled={!image || showFullFrame}
              title={showFullFrame ? 'Disponible fuera de Recortar' : undefined}
            >
              <Columns2 aria-hidden /> Antes / después
            </Button>
            <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" aria-label="Cambios aplicados">
              {chips.length === 0 ? (
                <li className="text-xs text-zinc-400">Sin cambios todavía</li>
              ) : (
                chips.map((chip) => (
                  <li key={chip.id} className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 py-0.5 pr-1 pl-2.5 text-xs text-sky-800">
                    {chip.label}
                    <button
                      type="button"
                      onClick={() => history.set(chip.undo)}
                      aria-label={`Quitar ${chip.label}`}
                      className="rounded-full p-0.5 hover:bg-sky-100 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </li>
                ))
              )}
            </ul>
            {output ? (
              <span className="text-xs text-zinc-500 tabular-nums lg:hidden">
                {output.width}×{output.height} px{estimate ? ` · ≈ ${formatBytes(estimate)}` : ''}
              </span>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
