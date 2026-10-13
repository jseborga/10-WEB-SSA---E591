import { defineConfig } from 'prisma/config'

// D1 es SQLite: el CLI usa un archivo local solo para generar/diferenciar el esquema.
// Las migraciones se aplican a D1 con `wrangler d1 migrations apply`.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  },
})
