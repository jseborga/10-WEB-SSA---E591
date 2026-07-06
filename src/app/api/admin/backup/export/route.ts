import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { exportBackup } from '@/lib/backup'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const url = new URL(request.url)
    const includeAnalytics = url.searchParams.get('analytics') !== '0'

    const { archive } = await exportBackup({ includeAnalytics })
    const fileName = `ssa-portal-backup-${new Date().toISOString().slice(0, 10)}.tar`

    return new NextResponse(new Uint8Array(archive), {
      headers: {
        'Content-Type': 'application/x-tar',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(archive.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exporting backup:', error)
    return NextResponse.json({ error: 'Error al generar el backup' }, { status: 500 })
  }
}
