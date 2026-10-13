/** Presets de mejora con IA. Módulo puro: lo importan tanto la UI como la API. */

export type AiImagePreset = {
  id: string
  label: string
  description: string
  instruction: string
}

const FAITHFUL =
  'Keep the scene, the architecture, the building geometry, materials and proportions exactly as they are. Do not invent, add or remove structures, windows, floors or construction elements. Keep the same framing and aspect ratio. The result must look like a real, unretouched photograph.'

export const AI_IMAGE_PRESETS: AiImagePreset[] = [
  {
    id: 'mejorar',
    label: 'Mejorar',
    description: 'Luz, color y nitidez naturales.',
    instruction: `Enhance this photo: balance exposure, recover shadows and highlights, correct white balance, give natural colors and crisp but natural sharpness. ${FAITHFUL}`,
  },
  {
    id: 'cielo',
    label: 'Cielo limpio',
    description: 'Cielo despejado y luminoso.',
    instruction: `Replace only the sky with a clean, clear blue sky with a few soft natural clouds, matching the existing light direction and time of day. Keep the edges of buildings and trees precise. ${FAITHFUL}`,
  },
  {
    id: 'limpiar',
    label: 'Limpiar escena',
    description: 'Quita basura, cables, objetos sueltos y personas.',
    instruction: `Remove distracting elements: litter, loose debris, stray objects, dangling cables, plastic bags and people in the frame, filling the gaps seamlessly with the surrounding surfaces. Keep the construction work, scaffolding, machinery and all built elements. ${FAITHFUL}`,
  },
  {
    id: 'enderezar',
    label: 'Enderezar',
    description: 'Corrige perspectiva y verticales.',
    instruction: `Correct the perspective so vertical lines of the building are truly vertical and the horizon is level, as a tilt-shift architectural lens would. Crop minimally to avoid empty borders. ${FAITHFUL}`,
  },
  {
    id: 'atardecer',
    label: 'Hora dorada',
    description: 'Luz cálida de atardecer.',
    instruction: `Relight the scene with warm, soft golden-hour sunlight and a gentle warm sky, with natural long shadows consistent with the scene. ${FAITHFUL}`,
  },
  {
    id: 'render',
    label: 'Foto profesional',
    description: 'Aspecto de fotografía de arquitectura.',
    instruction: `Make it look like a professional architectural photograph for a portfolio: clean balanced light, neutral whites, straight lines, rich but realistic colors, high clarity and no noise. ${FAITHFUL}`,
  },
]

export const DEFAULT_AI_IMAGE_PRESET = 'mejorar'

export function getAiImagePreset(id: string | null | undefined) {
  return AI_IMAGE_PRESETS.find((preset) => preset.id === id) ?? null
}

/** Instrucción final para el modelo combinando preset y texto libre. */
export function buildAiImageInstruction(presetId?: string | null, prompt?: string | null) {
  const preset = getAiImagePreset(presetId)
  const extra = (prompt || '').trim()

  if (preset && extra) {
    return `${preset.instruction}\nAdditional request from the user (may be in Spanish): ${extra}`
  }

  if (extra) {
    return `Edit this photo applying exactly this request from the user (may be in Spanish): ${extra}\nApart from the requested change: ${FAITHFUL}`
  }

  return (preset ?? AI_IMAGE_PRESETS[0]).instruction
}
