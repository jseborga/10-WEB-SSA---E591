import { NEUTRAL_ADJUSTMENTS, type Adjustments, type CropRect } from './image-pipeline'

export type AspectId = 'free' | '1:1' | '4:5' | '16:9' | '3:2' | '9:16'

export const ASPECTS: Array<{ id: AspectId; label: string; hint: string; ratio: number | null }> = [
  { id: 'free', label: 'Libre', hint: 'Sin proporción fija', ratio: null },
  { id: '1:1', label: '1:1', hint: 'Cuadrado', ratio: 1 },
  { id: '4:5', label: '4:5', hint: 'Instagram', ratio: 4 / 5 },
  { id: '16:9', label: '16:9', hint: 'Web', ratio: 16 / 9 },
  { id: '3:2', label: '3:2', hint: 'Foto clásica', ratio: 3 / 2 },
  { id: '9:16', label: '9:16', hint: 'Historias', ratio: 9 / 16 },
]

export type EditorState = {
  rotation: number
  flipH: boolean
  aspect: AspectId
  crop: CropRect | null
  adjustments: Adjustments
}

export const INITIAL_EDITOR_STATE: EditorState = {
  rotation: 0,
  flipH: false,
  aspect: 'free',
  crop: null,
  adjustments: NEUTRAL_ADJUSTMENTS,
}

export type AdjustmentField = { key: keyof Adjustments; label: string; min: number; max: number }

export const ADJUSTMENT_FIELDS: AdjustmentField[] = [
  { key: 'brightness', label: 'Brillo', min: -100, max: 100 },
  { key: 'contrast', label: 'Contraste', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturación', min: -100, max: 100 },
  { key: 'warmth', label: 'Calidez', min: -100, max: 100 },
  { key: 'exposure', label: 'Exposición', min: -100, max: 100 },
  { key: 'shadows', label: 'Sombras', min: -100, max: 100 },
  { key: 'sharpness', label: 'Nitidez', min: 0, max: 100 },
]

export type FilterPreset = { id: string; label: string; adjustments: Adjustments }

const preset = (values: Partial<Adjustments>): Adjustments => ({ ...NEUTRAL_ADJUSTMENTS, ...values })

export const FILTERS: FilterPreset[] = [
  { id: 'original', label: 'Original', adjustments: preset({}) },
  { id: 'natural', label: 'Natural', adjustments: preset({ brightness: 4, contrast: 8, saturation: 8, shadows: 10, sharpness: 15 }) },
  { id: 'vivo', label: 'Vivo', adjustments: preset({ contrast: 18, saturation: 30, shadows: 8, sharpness: 20 }) },
  { id: 'calido', label: 'Cálido', adjustments: preset({ brightness: 4, warmth: 35, saturation: 8, contrast: 6 }) },
  { id: 'frio', label: 'Frío', adjustments: preset({ warmth: -30, contrast: 8, saturation: -5 }) },
  { id: 'bn', label: 'B/N', adjustments: preset({ saturation: -100, contrast: 20, sharpness: 15 }) },
  { id: 'editorial', label: 'Editorial', adjustments: preset({ contrast: 14, saturation: -22, warmth: -6, shadows: -10, sharpness: 20 }) },
]

export function sameAdjustments(a: Adjustments, b: Adjustments) {
  return ADJUSTMENT_FIELDS.every((field) => a[field.key] === b[field.key])
}

export function matchFilter(adjustments: Adjustments) {
  return FILTERS.find((filter) => sameAdjustments(filter.adjustments, adjustments))?.id ?? null
}

export function getAspectRatio(aspect: AspectId) {
  return ASPECTS.find((item) => item.id === aspect)?.ratio ?? null
}

/** Mayor rectángulo centrado con la proporción indicada (en píxeles) dentro de la imagen orientada. */
export function fitAspect(ratio: number, width: number, height: number): CropRect {
  const imageRatio = width / height

  if (ratio > imageRatio) {
    const h = imageRatio / ratio
    return { x: 0, y: (1 - h) / 2, w: 1, h }
  }

  const w = ratio / imageRatio
  return { x: (1 - w) / 2, y: 0, w, h: 1 }
}

export function isFullCrop(crop: CropRect | null) {
  return !crop || (crop.x < 0.002 && crop.y < 0.002 && crop.w > 0.996 && crop.h > 0.996)
}

export function isPristine(state: EditorState) {
  return (
    state.rotation % 360 === 0 &&
    !state.flipH &&
    isFullCrop(state.crop) &&
    sameAdjustments(state.adjustments, NEUTRAL_ADJUSTMENTS)
  )
}

export type ChangeChip = { id: string; label: string; undo: (state: EditorState) => EditorState }

const signed = (value: number) => (value > 0 ? `+${value}` : String(value))

/** Resumen legible de todo lo que cambia respecto al original, con deshacer individual. */
export function describeChanges(state: EditorState): ChangeChip[] {
  const chips: ChangeChip[] = []

  if (!isFullCrop(state.crop)) {
    const aspect = ASPECTS.find((item) => item.id === state.aspect)
    chips.push({
      id: 'crop',
      label: `Recorte ${aspect && aspect.id !== 'free' ? aspect.label : 'libre'}`,
      undo: (s) => ({ ...s, crop: null, aspect: 'free' }),
    })
  }

  const rotation = ((state.rotation % 360) + 360) % 360
  if (rotation !== 0) {
    chips.push({ id: 'rotation', label: `Giro ${rotation}°`, undo: (s) => ({ ...s, rotation: 0, crop: null, aspect: 'free' }) })
  }

  if (state.flipH) {
    chips.push({
      id: 'flip',
      label: 'Volteo horizontal',
      undo: (s) => ({ ...s, flipH: false, crop: s.crop ? { ...s.crop, x: 1 - s.crop.x - s.crop.w } : null }),
    })
  }

  for (const field of ADJUSTMENT_FIELDS) {
    const value = state.adjustments[field.key]
    if (value !== 0) {
      chips.push({
        id: field.key,
        label: `${field.label} ${signed(value)}`,
        undo: (s) => ({ ...s, adjustments: { ...s.adjustments, [field.key]: 0 } }),
      })
    }
  }

  return chips
}
