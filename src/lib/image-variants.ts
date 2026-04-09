import path from 'path'
import sharp from 'sharp'
import { createStoredFileName, readStoredFile, saveUploadedFile } from '@/lib/media-storage'

export type ImageVariantTarget = 'project' | 'publication' | 'hero'
export type ImageTreatment = 'original' | 'enhanced' | 'editorial' | 'monochrome'

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
}

function getMediaFileNameFromUrl(sourceUrl: string) {
  try {
    const parsed = sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://')
      ? new URL(sourceUrl)
      : new URL(sourceUrl, 'http://localhost')
    const parts = parsed.pathname.split('/').filter(Boolean)

    if (parts[0] === 'api' && parts[1] === 'media' && parts[2]) {
      return decodeURIComponent(parts.slice(2).join('/'))
    }
  } catch {
    return null
  }

  return null
}

async function loadSourceBuffer(sourceUrl: string) {
  const mediaFileName = getMediaFileNameFromUrl(sourceUrl)

  if (mediaFileName) {
    return {
      buffer: await readStoredFile(path.basename(mediaFileName)),
      fileName: path.basename(mediaFileName),
    }
  }

  if (!sourceUrl.startsWith('http://') && !sourceUrl.startsWith('https://')) {
    throw new Error('Solo se admiten archivos locales del media manager o URLs absolutas.')
  }

  const response = await fetch(sourceUrl)

  if (!response.ok) {
    throw new Error('No se pudo descargar la imagen de origen.')
  }

  const contentType = response.headers.get('content-type') || ''

  if (!contentType.startsWith('image/')) {
    throw new Error('La URL de origen no apunta a una imagen compatible.')
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    fileName: path.basename(new URL(sourceUrl).pathname) || 'source-image',
  }
}

function applyTreatment(instance: sharp.Sharp, treatment: ImageTreatment) {
  switch (treatment) {
    case 'enhanced':
      return instance
        .modulate({ brightness: 1.03, saturation: 1.08 })
        .sharpen(1.1, 1.2, 1.8)
        .normalise()
    case 'editorial':
      return instance
        .modulate({ brightness: 1.01, saturation: 0.92 })
        .gamma(1.04)
        .sharpen(0.9, 1.1, 1.6)
    case 'monochrome':
      return instance
        .grayscale()
        .normalise()
        .sharpen(0.8, 1.05, 1.5)
    default:
      return instance
  }
}

async function createVariant(
  sourceBuffer: Buffer,
  fileName: string,
  size: VariantSize,
  label: 'desktop' | 'mobile',
  treatment: ImageTreatment,
) {
  const processed = applyTreatment(sharp(sourceBuffer).rotate(), treatment)
    .resize(size.width, size.height, {
      fit: 'cover',
      position: 'attention',
      withoutEnlargement: false,
    })
    .webp({
      quality: 84,
      effort: 5,
    })

  const buffer = await processed.toBuffer()
  const stem = path.parse(fileName).name || 'image'
  const outputFileName = createStoredFileName(`${stem}-${label}-${treatment}.webp`)
  await saveUploadedFile(outputFileName, buffer)

  return {
    fileName: outputFileName,
    url: `/api/media/${outputFileName}`,
    width: size.width,
    height: size.height,
  }
}

export async function generateImageVariants({
  sourceUrl,
  target,
  treatment,
}: {
  sourceUrl: string
  target: ImageVariantTarget
  treatment: ImageTreatment
}) {
  const { buffer, fileName } = await loadSourceBuffer(sourceUrl)
  const metadata = await sharp(buffer).metadata()
  const sizes = TARGET_SIZES[target]

  const [desktop, mobile] = await Promise.all([
    createVariant(buffer, fileName, sizes.desktop, 'desktop', treatment),
    createVariant(buffer, fileName, sizes.mobile, 'mobile', treatment),
  ])

  return {
    target,
    treatment,
    original: {
      url: sourceUrl,
      width: metadata.width || null,
      height: metadata.height || null,
      format: metadata.format || null,
    },
    desktop,
    mobile,
  }
}
