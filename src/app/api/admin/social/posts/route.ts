import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { MetaGraphError, assertConnected, getMetaConnection, listSocialPosts } from '@/lib/meta-graph'

export async function GET(request: Request) {
  const unauthorized = await requireAuthenticatedUser(request)
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const network = searchParams.get('network') === 'facebook' ? 'facebook' : 'instagram'
  const after = (searchParams.get('after') || '').slice(0, 512)

  try {
    const connection = assertConnected(await getMetaConnection())
    return NextResponse.json(await listSocialPosts(connection, network, after))
  } catch (error) {
    if (error instanceof MetaGraphError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Error listing social posts:', error instanceof Error ? error.message : 'desconocido')
    return NextResponse.json({ error: 'No se pudieron obtener las publicaciones de Meta' }, { status: 500 })
  }
}
