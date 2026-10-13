import { NextResponse } from 'next/server'
import { getContentType, getStoredObject } from '@/lib/media-storage'

function parseRange(header: string | null): R2Range | undefined {
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null

  if (!match || (!match[1] && !match[2])) {
    return undefined
  }

  if (!match[1]) {
    return { suffix: Number(match[2]) }
  }

  const offset = Number(match[1])
  return match[2] ? { offset, length: Number(match[2]) - offset + 1 } : { offset }
}

export async function GET(request: Request, { params }: { params: Promise<{ fileName: string }> }) {
  const { fileName } = await params
  const range = parseRange(request.headers.get('range'))
  const object = await getStoredObject(fileName, {
    range,
    onlyIf: request.headers.has('if-none-match') ? { etagDoesNotMatch: request.headers.get('if-none-match')!.replace(/"/g, '') } : undefined,
  })

  if (!object) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers as never)
  headers.set('ETag', object.httpEtag)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('X-Content-Type-Options', 'nosniff')

  const contentType = headers.get('Content-Type') || getContentType(fileName)
  headers.set('Content-Type', contentType)

  // Archivos antiguos en SVG: nunca ejecutar scripts en nuestro origen.
  if (contentType === 'image/svg+xml') {
    headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
  }

  if (!('body' in object) || !object.body) {
    return new Response(null, { status: 304, headers })
  }

  if (range && object.range && 'offset' in object.range) {
    const offset = object.range.offset ?? 0
    const length = object.range.length ?? object.size - offset
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`)
    headers.set('Content-Length', String(length))
    return new Response(object.body as unknown as ReadableStream, { status: 206, headers })
  }

  headers.set('Content-Length', String(object.size))
  return new Response(object.body as unknown as ReadableStream, { headers })
}
