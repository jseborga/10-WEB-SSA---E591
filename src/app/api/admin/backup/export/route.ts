import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { exportBackupStream } from '@/lib/backup'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const url = new URL(request.url)
    const includeAnalytics = url.searchParams.get('analytics') !== '0'

    const { stream } = await exportBackupStream({ includeAnalytics })
    const fileName = `ssa-portal-backup-${new Date().toISOString().slice(0, 10)}.tar`

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/x-tar',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exporting backup:', error)
    return NextResponse.json({ error: 'Error al generar el backup' }, { status: 500 })
  }
}
