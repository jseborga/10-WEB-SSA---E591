/**
 * Pipeline de imagen propio sobre ImageData (no usa ctx.filter: Safari no lo soporta).
 * Todo es determinista: los mismos ajustes producen siempre el mismo resultado.
 */

export type Adjustments = {
  exposure: number
  brightness: number
  contrast: number
  shadows: number
  saturation: number
  warmth: number
  sharpness: number
}

export const NEUTRAL_ADJUSTMENTS: Adjustments = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  shadows: 0,
  saturation: 0,
  warmth: 0,
  sharpness: 0,
}

export type CropRect = { x: number; y: number; w: number; h: number }

export type Geometry = {
  rotation: number
  flipH: boolean
  crop: CropRect | null
}

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

export function isNeutral(adjustments: Adjustments) {
  return (Object.keys(NEUTRAL_ADJUSTMENTS) as Array<keyof Adjustments>).every((key) => adjustments[key] === 0)
}

/** Tablas por canal: calidez → exposición → brillo → contraste → sombras. */
function buildLuts(adjustments: Adjustments) {
  const warmth = adjustments.warmth / 100
  const exposure = 2 ** (adjustments.exposure / 100)
  const brightness = (adjustments.brightness / 100) * 0.25
  const c = adjustments.contrast / 100
  const contrast = c >= 0 ? 1 + c * 1.2 : 1 + c * 0.85
  const shadows = adjustments.shadows / 100
  const channelGain = [1 + warmth * 0.12, 1 + warmth * 0.02, 1 - warmth * 0.12]

  return channelGain.map((gain) => {
    const lut = new Uint8ClampedArray(256)

    for (let index = 0; index < 256; index += 1) {
      let v = (index / 255) * gain * exposure
      v += brightness
      v = (v - 0.5) * contrast + 0.5
      v = clamp01(v)
      // Curva que solo afecta a tonos oscuros: los negros puros se mantienen.
      v += shadows * 1.2 * v * (1 - v) * (1 - v)
      lut[index] = Math.round(clamp01(v) * 255)
    }

    return lut
  })
}

function sharpen(image: ImageData, amount: number) {
  const { width, height, data } = image
  const source = new Uint8ClampedArray(data)
  const k = amount / 4
  const stride = width * 4

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * stride + x * 4

      for (let ch = 0; ch < 3; ch += 1) {
        const p = i + ch
        const neighbours = source[p - 4] + source[p + 4] + source[p - stride] + source[p + stride]
        data[p] = source[p] * (1 + amount) - neighbours * k
      }
    }
  }
}

/** Aplica los ajustes in situ sobre un ImageData. */
export function applyAdjustments(image: ImageData, adjustments: Adjustments, sharpnessScale = 1) {
  if (isNeutral(adjustments)) return image

  const [lutR, lutG, lutB] = buildLuts(adjustments)
  const saturation = 1 + adjustments.saturation / 100
  const data = image.data

  for (let i = 0; i < data.length; i += 4) {
    let r = lutR[data[i]]
    let g = lutG[data[i + 1]]
    let b = lutB[data[i + 2]]

    if (saturation !== 1) {
      const luma = 0.299 * r + 0.587 * g + 0.114 * b
      r = luma + (r - luma) * saturation
      g = luma + (g - luma) * saturation
      b = luma + (b - luma) * saturation
    }

    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }

  if (adjustments.sharpness > 0) {
    sharpen(image, (adjustments.sharpness / 100) * 1.4 * sharpnessScale)
  }

  return image
}

export function orientedSize(width: number, height: number, rotation: number) {
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width }
}

/**
 * Dibuja la imagen con giro, volteo y recorte en un solo canvas,
 * limitando el lado largo a `maxEdge` (evita canvases enormes en iOS).
 */
export function renderGeometry(
  source: HTMLImageElement,
  geometry: Geometry,
  maxEdge: number,
): HTMLCanvasElement {
  const sw = source.naturalWidth
  const sh = source.naturalHeight
  const oriented = orientedSize(sw, sh, geometry.rotation)
  const crop = geometry.crop ?? { x: 0, y: 0, w: 1, h: 1 }
  const cropW = crop.w * oriented.width
  const cropH = crop.h * oriented.height
  const scale = Math.min(1, maxEdge / Math.max(cropW, cropH))

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(cropW * scale))
  canvas.height = Math.max(1, Math.round(cropH * scale))

  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.scale(scale, scale)
  ctx.translate(-crop.x * oriented.width, -crop.y * oriented.height)
  ctx.translate(oriented.width / 2, oriented.height / 2)
  if (geometry.flipH) ctx.scale(-1, 1)
  ctx.rotate((geometry.rotation * Math.PI) / 180)
  ctx.drawImage(source, -sw / 2, -sh / 2, sw, sh)

  return canvas
}

export function readImageData(canvas: HTMLCanvasElement) {
  return canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height)
}

export function cloneImageData(image: ImageData) {
  return new ImageData(new Uint8ClampedArray(image.data), image.width, image.height)
}

/** Tamaño final en píxeles que tendrá la exportación. */
export function finalSize(naturalWidth: number, naturalHeight: number, geometry: Geometry, maxEdge: number) {
  const oriented = orientedSize(naturalWidth, naturalHeight, geometry.rotation)
  const crop = geometry.crop ?? { x: 0, y: 0, w: 1, h: 1 }
  const w = crop.w * oriented.width
  const h = crop.h * oriented.height
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

export async function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.88): Promise<Blob> {
  const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
  if (webp && webp.type === 'image/webp') return webp

  // Safari antiguo no codifica WebP: devuelve PNG o null.
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!jpeg) throw new Error('El navegador no pudo generar la imagen.')
  return jpeg
}

/**
 * Auto-mejora a partir del histograma: niveles automáticos, balance de blancos suave
 * y algo de saturación. Devuelve valores de los deslizadores para que el usuario vea qué cambia.
 */
export function computeAutoAdjustments(image: ImageData): Adjustments {
  const { data } = image
  const histogram = new Uint32Array(256)
  let count = 0
  let sumR = 0
  let sumB = 0
  let midCount = 0
  let sumSat = 0
  const step = Math.max(1, Math.floor(data.length / 4 / 250_000)) * 4

  for (let i = 0; i < data.length; i += step) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    histogram[luma] += 1
    count += 1

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    sumSat += max === 0 ? 0 : (max - min) / max

    if (luma > 40 && luma < 215) {
      sumR += r
      sumB += b
      midCount += 1
    }
  }

  const percentile = (fraction: number) => {
    const target = count * fraction
    let acc = 0
    for (let v = 0; v < 256; v += 1) {
      acc += histogram[v]
      if (acc >= target) return v
    }
    return 255
  }

  const low = percentile(0.005) / 255
  const high = percentile(0.995) / 255
  const median = percentile(0.5) / 255
  const range = Math.max(0.05, high - low)

  const contrastFactor = Math.min(1.5, Math.max(1, 0.94 / range))
  const contrast = Math.round(((contrastFactor - 1) / 1.2) * 100)
  const brightness = Math.round(Math.max(-30, Math.min(30, ((0.5 - (low + high) / 2) / 0.25) * 100)))
  const shadows = median < 0.38 ? Math.round(Math.min(35, (0.38 - median) * 140)) : 0

  const castDiff = midCount ? (sumB - sumR) / midCount / 255 : 0
  const warmth = Math.round(Math.max(-30, Math.min(30, (castDiff / 0.12) * 100 * 0.6)))

  const avgSat = count ? sumSat / count : 0
  const saturation = avgSat < 0.2 ? 18 : avgSat < 0.35 ? 12 : 6

  return {
    exposure: 0,
    brightness,
    contrast,
    shadows,
    saturation,
    warmth,
    sharpness: 20,
  }
}
