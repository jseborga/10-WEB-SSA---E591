import { getEnv } from '@/lib/cloudflare'
import { createStoredFileName, getMediaKeyFromUrl, getMediaUrl, getStoredObject, saveUploadedFile } from '@/lib/media-storage'

export type ImageVariantTarget = 'project' | 'publication' | 'hero' | 'social'
export type ImageTreatment = 'original' | 'enhanced' | 'editorial' | 'monochrome'
export type ImageVariantFitMode = 'cover' | 'contain'

type VariantSize = {
  width: number
  height: number
}

const TARGET_SIZES: Record<ImageVariantTarget, { desktop: VariantSize; mobile: VariantSize }> = {
  hero: {
    desktop: { width: 1920, height: 1280 },
    mobile: { width: 1080, height: 1440 },
  },
  project: {
    desktop: { width: 1680, height: 1050 },
    mobile: { width: 1080, height: 1350 },
  },
  publication: {
    desktop: { width: 1600, height: 900 },
    mobile: { width: 1080, height: 1350 },
  },
  social: {
    desktop: { width: 1200, height: 630 },
    mobile: { width: 1080, height: 1350 },
  },
}

const TREATMENTS: Record<ImageTreatment, ImageTransform> = {
  original: {},
  enhanced: { brightness: 1.03, contrast: 1.06, saturation: 1.08, sharpen: 1.2 },
  editorial: { brightness: 1.01, saturation: 0.92, gamma: 1.04, sharpen: 1 },
  monochrome: { saturation: 0, contrast: 1.08, sharpen: 0.9 },
}

function getImages() {
  const images = getEnv().IMAGES

  if (!images) {
    throw new Error('Binding de Cloudflare Images "IMAGES" no configurado en wrangler.jsonc.')
  }

  return images
}

async function loadSourceBytes(sourceUrl: string) {
  const mediaKey = getMediaKeyFromUrl(sourceUrl)

  if (mediaKey) {
    const object = await getStoredObject(mediaKey)

    if (!object) {
      throw new Error('No se encontró la imagen de origen en la biblioteca.')
    }

    return { bytes: new Uint8Array(await object.arrayBuffer()), fileName: mediaKey }
  }

  throw new Error('Selecciona una imagen de la biblioteca de medios (importa primero las URLs externas).')
}

// Los tipos de stream de Workers y del DOM no coinciden aunque en runtime son el mismo objeto.
type WorkerStream = Parameters<ImagesBinding['input']>[0]

function toStream(bytes: Uint8Array): WorkerStream {
  return new Blob([bytes as BlobPart]).stream() as unknown as WorkerStream
}

async function createVariant(
  bytes: Uint8Array,
  sourceSize: { width: number; height: number } | null,
  fileName: string,
  size: VariantSize,
  label: 'desktop' | 'mobile',
  treatment: ImageTreatment,
  fitMode: ImageVariantFitMode,
) {
  const images = getImages()
  const look = TREATMENTS[treatment]
  let transformer: ImageTransformer

  if (fitMode === 'contain' && sourceSize) {
    // Fondo desenfocado a sangre + imagen completa centrada encima.
    const scale = Math.min(size.width / sourceSize.width, size.height / sourceSize.height)
    const width = Math.max(1, Math.round(sourceSize.width * scale))
    const height = Math.max(1, Math.round(sourceSize.height * scale))

    transformer = images
      .input(toStream(bytes))
      .transform({ width: size.width, height: size.height, fit: 'cover', gravity: 'auto', blur: 40, brightness: 0.84, saturation: treatment === 'monochrome' ? 0 : 0.88 })
      .draw(images.input(toStream(bytes)).transform({ ...look, width, height, fit: 'scale-down' }), {
        left: Math.round((size.width - width) / 2),
        top: Math.round((size.height - height) / 2),
      })
  } else {
    transformer = images
      .input(toStream(bytes))
      .transform({ ...look, width: size.width, height: size.height, fit: 'cover', gravity: 'auto' })
  }

  const result = await transformer.output({ format: 'image/webp', quality: 84 })
  const output = new Uint8Array(await new Response(result.image() as unknown as ReadableStream).arrayBuffer())
  const stem = fileName.replace(/\.[a-z0-9]+$/i, '').replace(/^\d+-[a-z0-9]+-/, '') || 'image'
  const outputFileName = createStoredFileName(`${stem}-${label}-${treatment}-${fitMode}.webp`)
  await saveUploadedFile(outputFileName, output, 'image/webp')

  return {
    fileName: outputFileName,
    url: getMediaUrl(outputFileName),
    width: size.width,
    height: size.height,
  }
}

export async function generateImageVariants({
  sourceUrl,
  target,
  treatment,
  fitMode = 'cover',
}: {
  sourceUrl: string
  target: ImageVariantTarget
  treatment: ImageTreatment
  fitMode?: ImageVariantFitMode
}) {
  const { bytes, fileName } = await loadSourceBytes(sourceUrl)
  const info = await getImages().info(toStream(bytes))
  const sourceSize = 'width' in info ? { width: info.width, height: info.height } : null
  const sizes = TARGET_SIZES[target]

  const [desktop, mobile] = await Promise.all([
    createVariant(bytes, sourceSize, fileName, sizes.desktop, 'desktop', treatment, fitMode),
    createVariant(bytes, sourceSize, fileName, sizes.mobile, 'mobile', treatment, fitMode),
  ])

  return {
    target,
    treatment,
    fitMode,
    original: {
      url: sourceUrl,
      width: sourceSize?.width ?? null,
      height: sourceSize?.height ?? null,
      format: info.format,
    },
    desktop,
    mobile,
  }
}
