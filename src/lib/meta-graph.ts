import type {
  SocialConnectionStatus,
  SocialNetwork,
  SocialPostDTO,
  SocialPostMedia,
  SocialPostsResponse,
} from '@/components/admin/types'
import { db } from '@/lib/db'

/**
 * Integración con la Graph API de Meta (Facebook Pages + Instagram profesional).
 * El token de página se guarda en SocialConnection y nunca se devuelve ni se registra en logs.
 */

export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION?.trim() || 'v23.0'
export const META_PROVIDER = 'meta'

const GRAPH_BASE = 'https://graph.facebook.com'

export class MetaGraphError extends Error {
  code: number | null
  status: number

  constructor(message: string, status = 502, code: number | null = null) {
    super(message)
    this.name = 'MetaGraphError'
    this.status = status
    this.code = code
  }
}

type GraphErrorBody = {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number }
}

function scrubToken(message: string, token: string) {
  let clean = message
  if (token) clean = clean.split(token).join('••••')
  // Por si Meta devuelve otro token en el texto.
  return clean.replace(/EAA[A-Za-z0-9]{20,}/g, '••••')
}

/** Pista en español según el error de Meta (permisos faltantes, token vencido…). */
function explainGraphError(code: number | null, message: string) {
  const lower = message.toLowerCase()

  if (code === 190 || lower.includes('session has expired') || lower.includes('invalid oauth')) {
    return 'El token no es válido o expiró. Genera un token de página de larga duración y vuelve a conectar.'
  }

  if (lower.includes('pages_read_engagement') || lower.includes('pages_show_list')) {
    return 'Falta un permiso de página: el token debe incluir pages_show_list y pages_read_engagement.'
  }

  if (lower.includes('instagram_basic') || lower.includes('instagram')) {
    return 'Falta el permiso instagram_basic o la cuenta de Instagram no es profesional/vinculada a la página.'
  }

  if (code === 10 || code === 200 || (code !== null && code >= 200 && code < 300)) {
    return 'Permisos insuficientes. El token debe incluir pages_show_list, pages_read_engagement e instagram_basic.'
  }

  if (code === 4 || code === 17 || code === 32 || code === 613) {
    return 'Meta limitó temporalmente las solicitudes. Espera unos minutos e inténtalo de nuevo.'
  }

  return ''
}

export async function graphGet<T>(path: string, params: Record<string, string | undefined>, token: string): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${META_GRAPH_VERSION}/${path.replace(/^\//, '')}`)

  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }

  url.searchParams.set('access_token', token)

  let response: Response

  try {
    response = await fetch(url.toString(), { headers: { accept: 'application/json' } })
  } catch {
    throw new MetaGraphError('No se pudo contactar a Meta (graph.facebook.com). Revisa la conexión del servidor.')
  }

  const body = (await response.json().catch(() => null)) as (T & GraphErrorBody) | null

  if (!response.ok || !body || body.error) {
    const code = body?.error?.code ?? null
    const rawMessage = scrubToken(body?.error?.message || `HTTP ${response.status}`, token)
    const hint = explainGraphError(code, rawMessage)
    throw new MetaGraphError(
      `Meta respondió: ${rawMessage}${hint ? ` — ${hint}` : ''}`,
      response.status === 400 || response.status === 401 || response.status === 403 ? 400 : 502,
      code,
    )
  }

  return body as T
}

/* ------------------------------------------------------------------ */
/* Conexión                                                             */
/* ------------------------------------------------------------------ */

type ConnectionRow = {
  pageId: string | null
  pageName: string | null
  igUserId: string | null
  igUsername: string | null
  accessToken: string | null
  tokenExpiresAt: Date | null
  autoPublish: boolean
  lastSyncAt: Date | null
  lastSyncError: string | null
}

export async function getMetaConnection() {
  return db.socialConnection.findUnique({ where: { provider: META_PROVIDER } })
}

export function toSocialStatus(row: ConnectionRow | null): SocialConnectionStatus {
  const token = row?.accessToken || ''

  return {
    connected: Boolean(row && token && row.pageId),
    provider: 'meta',
    pageId: row?.pageId ?? null,
    pageName: row?.pageName ?? null,
    igUserId: row?.igUserId ?? null,
    igUsername: row?.igUsername ?? null,
    tokenPreview: token ? `••••${token.slice(-4)}` : null,
    tokenExpiresAt: row?.tokenExpiresAt ? row.tokenExpiresAt.toISOString() : null,
    autoPublish: Boolean(row?.autoPublish),
    lastSyncAt: row?.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    lastSyncError: row?.lastSyncError ?? null,
    graphVersion: META_GRAPH_VERSION,
  }
}

type GraphPage = {
  id: string
  name?: string
  access_token?: string
  instagram_business_account?: { id: string; username?: string }
}

const PAGE_FIELDS = 'id,name,instagram_business_account{id,username}'

/**
 * Valida el token y resuelve la página a usar.
 * - Token de página: se usa tal cual.
 * - Token de usuario: se listan sus páginas (/me/accounts) y se guarda el token de la página elegida.
 */
export async function resolveMetaPage(accessToken: string, requestedPageId?: string | null) {
  const me = await graphGet<{ id: string; name?: string }>('me', { fields: 'id,name' }, accessToken)
  const wantedPageId = requestedPageId?.trim() || null

  // ¿Es un token de página? Un nodo de usuario no tiene instagram_business_account (error #100).
  if (!wantedPageId || wantedPageId === me.id) {
    try {
      const page = await graphGet<GraphPage>(me.id, { fields: PAGE_FIELDS }, accessToken)
      return { page, pageToken: accessToken }
    } catch (error) {
      if (!(error instanceof MetaGraphError) || (error.code !== 100 && error.code !== 2500)) {
        throw error
      }
    }
  }

  const accounts = await graphGet<{ data?: GraphPage[] }>(
    'me/accounts',
    { fields: `${PAGE_FIELDS},access_token`, limit: '100' },
    accessToken,
  )
  const pages = accounts.data || []

  if (pages.length === 0) {
    throw new MetaGraphError(
      'El token es de usuario pero no tiene páginas disponibles. Asegúrate de otorgar pages_show_list y de administrar la página de Facebook.',
      400,
    )
  }

  const page = wantedPageId ? pages.find((item) => item.id === wantedPageId) : pages.length === 1 ? pages[0] : null

  if (!page) {
    const names = pages.map((item) => `${item.name || 'Sin nombre'} (${item.id})`).join(', ')
    throw new MetaGraphError(
      wantedPageId
        ? `La página ${wantedPageId} no está entre las páginas del token. Disponibles: ${names}.`
        : `El token administra varias páginas. Indica el Page ID de una de ellas: ${names}.`,
      400,
    )
  }

  if (!page.access_token) {
    throw new MetaGraphError('Meta no devolvió el token de la página. Falta el permiso pages_show_list o pages_read_engagement.', 400)
  }

  return { page, pageToken: page.access_token }
}

/** Intenta conocer la expiración del token (si Meta lo permite). Errores se ignoran. */
export async function readTokenExpiration(token: string) {
  try {
    const debug = await graphGet<{ data?: { expires_at?: number; data_access_expires_at?: number } }>(
      'debug_token',
      { input_token: token },
      token,
    )
    const expiresAt = debug.data?.expires_at
    return expiresAt && expiresAt > 0 ? new Date(expiresAt * 1000) : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Lectura de publicaciones                                             */
/* ------------------------------------------------------------------ */

type IgMediaChild = { media_type?: string; media_url?: string; thumbnail_url?: string }
type IgMedia = IgMediaChild & {
  id: string
  caption?: string
  permalink?: string
  timestamp?: string
  children?: { data?: IgMediaChild[] }
}

type FbAttachmentMedia = { image?: { src?: string }; source?: string }
type FbAttachment = {
  media_type?: string
  media?: FbAttachmentMedia
  subattachments?: { data?: Array<{ media_type?: string; media?: FbAttachmentMedia }> }
}
type FbPost = {
  id: string
  message?: string
  created_time?: string
  permalink_url?: string
  full_picture?: string
  attachments?: { data?: FbAttachment[] }
}

type GraphList<T> = { data?: T[]; paging?: { cursors?: { after?: string }; next?: string } }

function igChildToMedia(child: IgMediaChild): SocialPostMedia | null {
  if (child.media_type === 'VIDEO') {
    return child.media_url
      ? { type: 'video', url: child.media_url, thumbnailUrl: child.thumbnail_url }
      : child.thumbnail_url
        ? { type: 'image', url: child.thumbnail_url }
        : null
  }

  return child.media_url ? { type: 'image', url: child.media_url } : null
}

export function normalizeInstagramPost(item: IgMedia): Omit<SocialPostDTO, 'alreadyImported'> {
  const mediaType = item.media_type === 'VIDEO' || item.media_type === 'CAROUSEL_ALBUM' ? item.media_type : 'IMAGE'
  const children = item.children?.data || []
  const media = (mediaType === 'CAROUSEL_ALBUM' && children.length > 0 ? children : [item])
    .map(igChildToMedia)
    .filter((entry): entry is SocialPostMedia => Boolean(entry))

  return {
    id: item.id,
    network: 'instagram',
    caption: item.caption || '',
    permalink: item.permalink || null,
    timestamp: item.timestamp || null,
    mediaType,
    media,
  }
}

function fbAttachmentToMedia(media_type: string | undefined, media: FbAttachmentMedia | undefined): SocialPostMedia | null {
  const image = media?.image?.src
  const isVideo = (media_type || '').includes('video')

  if (isVideo && media?.source) {
    return { type: 'video', url: media.source, thumbnailUrl: image }
  }

  return image ? { type: 'image', url: image } : null
}

export function normalizeFacebookPost(item: FbPost): Omit<SocialPostDTO, 'alreadyImported'> {
  const media: SocialPostMedia[] = []
  let mediaType: SocialPostDTO['mediaType'] = 'IMAGE'

  for (const attachment of item.attachments?.data || []) {
    const subs = attachment.subattachments?.data || []

    if (subs.length > 0) {
      mediaType = 'CAROUSEL_ALBUM'
      for (const sub of subs) {
        const entry = fbAttachmentToMedia(sub.media_type, sub.media)
        if (entry) media.push(entry)
      }
      continue
    }

    const entry = fbAttachmentToMedia(attachment.media_type, attachment.media)
    if (entry) {
      if (entry.type === 'video') mediaType = 'VIDEO'
      media.push(entry)
    }
  }

  if (media.length === 0 && item.full_picture) {
    media.push({ type: 'image', url: item.full_picture })
  }

  if (media.length > 1 && mediaType !== 'CAROUSEL_ALBUM') {
    mediaType = 'CAROUSEL_ALBUM'
  }

  return {
    id: item.id,
    network: 'facebook',
    caption: item.message || '',
    permalink: item.permalink_url || null,
    timestamp: item.created_time || null,
    mediaType,
    media,
  }
}

const IG_FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}'
const FB_FIELDS =
  'id,message,created_time,permalink_url,full_picture,attachments{media_type,media{image{src},source},subattachments{media_type,media{image{src},source}}}'

async function attachImportState(posts: Array<Omit<SocialPostDTO, 'alreadyImported'>>, network: SocialNetwork) {
  const ids = posts.map((post) => post.id)
  const existing = ids.length
    ? await db.publication.findMany({
        where: { source: network, externalId: { in: ids } },
        select: { id: true, externalId: true },
      })
    : []
  const byExternalId = new Map(existing.map((row) => [row.externalId, row.id]))

  return posts.map<SocialPostDTO>((post) => {
    const publicationId = byExternalId.get(post.id)
    return publicationId ? { ...post, alreadyImported: true, publicationId } : { ...post, alreadyImported: false }
  })
}

type ReadyConnection = ConnectionRow & { accessToken: string; pageId: string }

export function assertConnected(row: ConnectionRow | null): ReadyConnection {
  if (!row || !row.accessToken || !row.pageId) {
    throw new MetaGraphError('No hay una cuenta de Meta conectada. Conéctala en la sección Redes.', 400)
  }

  return row as ReadyConnection
}

export async function listSocialPosts(
  connection: ReadyConnection,
  network: SocialNetwork,
  after?: string | null,
  limit = 24,
): Promise<SocialPostsResponse> {
  const cursor = after?.trim() || undefined

  if (network === 'instagram') {
    if (!connection.igUserId) {
      throw new MetaGraphError(
        'La página conectada no tiene una cuenta de Instagram profesional vinculada (o falta el permiso instagram_basic).',
        400,
      )
    }

    const list = await graphGet<GraphList<IgMedia>>(
      `${connection.igUserId}/media`,
      { fields: IG_FIELDS, limit: String(limit), after: cursor },
      connection.accessToken,
    )
    const posts = await attachImportState((list.data || []).map(normalizeInstagramPost), 'instagram')
    return { posts, nextCursor: list.paging?.next ? list.paging.cursors?.after || null : null }
  }

  const list = await graphGet<GraphList<FbPost>>(
    `${connection.pageId}/posts`,
    { fields: FB_FIELDS, limit: String(limit), after: cursor },
    connection.accessToken,
  )
  const posts = await attachImportState((list.data || []).map(normalizeFacebookPost), 'facebook')
  return { posts, nextCursor: list.paging?.next ? list.paging.cursors?.after || null : null }
}

/** Lee un post puntual por id (para importar). */
export async function getSocialPost(connection: ReadyConnection, network: SocialNetwork, id: string) {
  if (network === 'instagram') {
    const item = await graphGet<IgMedia>(id, { fields: IG_FIELDS }, connection.accessToken)
    return normalizeInstagramPost(item)
  }

  const item = await graphGet<FbPost>(id, { fields: FB_FIELDS }, connection.accessToken)
  return normalizeFacebookPost(item)
}

/* ------------------------------------------------------------------ */
/* Texto de la publicación importada                                    */
/* ------------------------------------------------------------------ */

function truncate(value: string, max: number) {
  if (value.length <= max) return value
  const cut = value.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

function formatDateEs(value: string | null) {
  const date = value ? new Date(value) : new Date()
  const safe = Number.isNaN(date.getTime()) ? new Date() : date
  const dd = String(safe.getUTCDate()).padStart(2, '0')
  const mm = String(safe.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${safe.getUTCFullYear()}`
}

const HASHTAG_LINE = /^(\s*#[\p{L}\p{N}_]+\s*)+$/u

/** Título, resumen y contenido a partir del texto del post. Los hashtags quedan al final del contenido. */
export function buildCopyFromCaption(caption: string, network: SocialNetwork, timestamp: string | null) {
  const text = caption.replace(/\r\n/g, '\n').trim()
  const lines = text.split('\n').map((line) => line.trim())
  const bodyLines = lines.filter((line) => !HASHTAG_LINE.test(line))
  const hashtagLines = lines.filter((line) => line && HASHTAG_LINE.test(line))
  const plain = bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  // En título y resumen los hashtags en línea pierden el "#" pero conservan la palabra.
  const unhash = (value: string) => value.replace(/#([\p{L}\p{N}_]+)/gu, '$1').replace(/\s+/g, ' ').trim()
  const firstLine = unhash(bodyLines.find((line) => line.length > 0) || '')
  const networkLabel = network === 'instagram' ? 'Instagram' : 'Facebook'

  const title = firstLine ? truncate(firstLine, 80) : `Publicación de ${networkLabel} ${formatDateEs(timestamp)}`
  const excerptSource = unhash(plain)
  const excerpt = excerptSource ? truncate(excerptSource, 200) : null
  const content = [plain, hashtagLines.join(' ')].filter(Boolean).join('\n\n') || null

  return { title, excerpt, content }
}
