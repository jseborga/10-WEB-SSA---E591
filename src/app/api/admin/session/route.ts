import { NextResponse } from 'next/server'
import { getAdminSessionStatus } from '@/lib/admin-auth'

export async function GET(request: Request) {
  return NextResponse.json(await getAdminSessionStatus(request))
}
