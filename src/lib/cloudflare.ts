import { getCloudflareContext } from '@opennextjs/cloudflare'

export type AppEnv = CloudflareEnv

/** Bindings de Cloudflare (D1, R2) disponibles en la petición actual. */
export function getEnv(): AppEnv {
  return getCloudflareContext().env as unknown as AppEnv
}

/** Igual que getEnv pero para contextos estáticos/ISR (generateMetadata, sitemap…). */
export async function getEnvAsync(): Promise<AppEnv> {
  const context = await getCloudflareContext({ async: true })
  return context.env as unknown as AppEnv
}
