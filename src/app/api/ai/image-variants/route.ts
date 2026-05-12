import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { generateImageVariants, type ImageTreatment, type ImageVariantFitMode, type ImageVariantTarget } from '@/lib/image-variants'

const VALID_TARGETS: ImageVariantTarget[] = ['project', 'publication', 'hero', 'social']
const VALID_TREATMENTS: ImageTreatment[] = ['original', 'enhanced', 'editorial', 'monochrome']
const VALID_FIT_MODES: ImageVariantFitMode[] = ['cover', 'contain']

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const body = await request.json().catch(() => ({}))
    const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : ''
    const target = VALID_TARGETS.includes(body.target) ? body.target : 'project'
    const treatment = VALID_TREATMENTS.includes(body.treatment) ? body.treatment : 'enhanced'
    const fitMode = VALID_FIT_MODES.includes(body.fitMode) ? body.fitMode : 'cover'

    if (!sourceUrl) {
      return NextResponse.json({ error: 'Selecciona primero una imagen de origen.' }, { status: 400 })
    }

    const result = await generateImageVariants({ sourceUrl, target, treatment, fitMode })

    return NextResponse.json({
      success: true,
      result,
      recommendation:
        treatment === 'editorial'
          ? 'Versión más sobria y limpia, pensada para portadas corporativas.'
          : treatment === 'monochrome'
            ? 'Versión monocromática útil para layouts editoriales y bloques de marca.'
            : treatment === 'enhanced'
              ? 'Versión optimizada con más contraste y nitidez para publicación.'
              : 'Versión neutra, sin tratamiento visual extra.',
    })
  } catch (error) {
    console.error('Error generating image variants:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudieron preparar las variantes de imagen.' },
      { status: 500 },
    )
  }
}
