import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { deleteBackup, openBackupStream } from '@/lib/backup'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const id = new URL(request.url).searchParams.get('id') || ''
    const backup = await openBackupStream(id)

    if (!backup) {
      return NextResponse.json(
        { error: 'Backup no encontrado o expirado. Genera uno nuevo desde la pestaña Migración.' },
        { status: 404 },
      )
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-tar',
      'Content-Disposition': `attachment; filename="ssa-portal-backup-${id}.tar"`,
      'Cache-Control': 'no-store',
    }

    if (backup.status.size) {
      headers['Content-Length'] = String(backup.status.size)
    }

    return new NextResponse(backup.stream, { headers })
  } catch (error) {
    console.error('Error downloading backup:', error)
    return NextResponse.json({ error: 'Error al descargar el backup' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const id = new URL(request.url).searchParams.get('id') || ''
    const deleted = await deleteBackup(id)

    if (!deleted) {
      return NextResponse.json({ error: 'Identificador de backup inválido' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting backup:', error)
    return NextResponse.json({ error: 'Error al eliminar el backup' }, { status: 500 })
  }
}
