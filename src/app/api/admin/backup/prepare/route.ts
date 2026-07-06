import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { prepareBackupFile } from '@/lib/backup'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const body = await request.json().catch(() => null)
    const includeAnalytics = body?.includeAnalytics !== false

    const backup = await prepareBackupFile({ includeAnalytics })

    return NextResponse.json({ success: true, ...backup })
  } catch (error) {
    console.error('Error preparing backup:', error)
    return NextResponse.json({ error: 'Error al generar el backup' }, { status: 500 })
  }
}
