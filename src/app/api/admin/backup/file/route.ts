import { createReadStream } from 'fs'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { resolveBackupFile } from '@/lib/backup'

export const dynamic = 'force-dynamic'

function parseRangeHeader(rangeHeader: string | null, size: number) {
  if (!rangeHeader) {
    return null
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())

  if (!match || (!match[1] && !match[2])) {
    return { invalid: true as const }
  }

  let start: number
  let end: number

  if (match[1]) {
    start = Number(match[1])
    end = match[2] ? Number(match[2]) : size - 1
  } else {
    // Sufijo: los últimos N bytes
    const suffixLength = Number(match[2])
    start = Math.max(0, size - suffixLength)
    end = size - 1
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
    return { invalid: true as const }
  }

  return { invalid: false as const, start, end: Math.min(end, size - 1) }
}

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const url = new URL(request.url)
    const id = url.searchParams.get('id') || ''
    const backup = await resolveBackupFile(id)

    if (!backup) {
      return NextResponse.json(
        { error: 'Backup no encontrado o expirado. Genera uno nuevo desde la pestaña Migración.' },
        { status: 404 },
      )
    }

    const range = parseRangeHeader(request.headers.get('range'), backup.size)

    if (range?.invalid) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${backup.size}` },
      })
    }

    const start = range ? range.start : 0
    const end = range ? range.end : backup.size - 1

    const nodeStream = createReadStream(backup.path, { start, end })
    const stream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-tar',
      'Content-Length': String(end - start + 1),
      'Content-Disposition': `attachment; filename="ssa-portal-backup-${id}.tar"`,
      'Accept-Ranges': 'bytes',
      'ETag': `"${id}"`,
      'Cache-Control': 'no-store',
    }

    if (range) {
      headers['Content-Range'] = `bytes ${start}-${end}/${backup.size}`
    }

    return new NextResponse(stream, {
      status: range ? 206 : 200,
      headers,
    })
  } catch (error) {
    console.error('Error downloading backup:', error)
    return NextResponse.json({ error: 'Error al descargar el backup' }, { status: 500 })
  }
}
