import { NextResponse } from 'next/server'
import { requireAdmin, requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { toMediaAssetDTO } from '@/lib/media-assets'
import { deleteStoredFile } from '@/lib/media-storage'

type Context = { params: Promise<{ id: string }> }

/** Devuelve el recurso con su linaje: versión padre y versiones derivadas. */
export async function GET(request: Request, { params }: Context) {
  const unauthorized = await requireAuthenticatedUser(request)
  if (unauthorized) return unauthorized

  const { id } = await params
  const row = await db.mediaAsset.findUnique({ where: { id } })

  if (!row) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }

  const [parent, children] = await Promise.all([
    row.parentId ? db.mediaAsset.findUnique({ where: { id: row.parentId } }) : null,
    db.mediaAsset.findMany({ where: { parentId: row.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ])

  return NextResponse.json({
    asset: toMediaAssetDTO(row),
    editRecipe: row.editRecipe,
    parent: parent ? toMediaAssetDTO(parent) : null,
    children: children.map(toMediaAssetDTO),
  })
}

export async function PATCH(request: Request, { params }: Context) {
  const unauthorized = await requireAuthenticatedUser(request)
  if (unauthorized) return unauthorized

  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const data: { alt?: string | null; originalName?: string | null } = {}

    if (typeof body.alt === 'string' || body.alt === null) {
      data.alt = typeof body.alt === 'string' && body.alt.trim() ? body.alt.trim().slice(0, 500) : null
    }

    if (typeof body.originalName === 'string' && body.originalName.trim()) {
      data.originalName = body.originalName.trim().slice(0, 200)
    }

    const exists = await db.mediaAsset.findUnique({ where: { id }, select: { id: true } })

    if (!exists) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    const row = await db.mediaAsset.update({ where: { id }, data })
    return NextResponse.json(toMediaAssetDTO(row))
  } catch (error) {
    console.error('Error updating media:', error)
    return NextResponse.json({ error: 'No se pudo guardar el cambio' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const unauthorized = await requireAdmin(request)
  if (unauthorized) return unauthorized

  try {
    const { id } = await params
    const row = await db.mediaAsset.findUnique({ where: { id } })

    if (!row) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    // Solo se borra el objeto R2 si ninguna otra fila apunta a la misma clave.
    const key = row.storagePath || row.fileName
    const sharing = await db.mediaAsset.count({ where: { fileName: row.fileName, id: { not: row.id } } })

    if (key && sharing === 0) {
      await deleteStoredFile(key)
    }

    // Las versiones derivadas no se borran: pasan a colgar del abuelo.
    await db.mediaAsset.updateMany({ where: { parentId: row.id }, data: { parentId: row.parentId } })
    await db.mediaAsset.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting media:', error)
    return NextResponse.json({ error: 'No se pudo eliminar el archivo' }, { status: 500 })
  }
}
