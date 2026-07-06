import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { listBackups } from '@/lib/backup'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const backups = await listBackups()

    return NextResponse.json({ backups })
  } catch (error) {
    console.error('Error listing backups:', error)
    return NextResponse.json({ error: 'Error al listar los backups' }, { status: 500 })
  }
}
