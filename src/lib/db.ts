import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaClient } from '@prisma/client'
import { getEnv } from '@/lib/cloudflare'

export type { Prisma } from '@prisma/client'

const clients = new WeakMap<D1Database, PrismaClient>()

function getClient(): PrismaClient {
  const database = getEnv().DB

  if (!database) {
    throw new Error('Binding D1 "DB" no configurado en wrangler.jsonc.')
  }

  let client = clients.get(database)

  if (!client) {
    client = new PrismaClient({ adapter: new PrismaD1(database) })
    clients.set(database, client)
  }

  return client
}

/**
 * Cliente Prisma sobre Cloudflare D1. Se resuelve de forma perezosa en cada acceso
 * porque el binding D1 solo existe dentro del contexto de una petición.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient()
    const value = Reflect.get(client, property, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
