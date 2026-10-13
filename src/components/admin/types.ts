/** Contratos compartidos por los módulos del nuevo panel de administración. */

export type AdminRole = 'admin' | 'editor'

export type AdminSessionInfo = {
  configured: boolean
  authenticated: boolean
  role: AdminRole | null
  username: string | null
  root: boolean
}

export type MediaKind = 'image' | 'video' | 'document'

export type MediaAssetDTO = {
  id: string
  url: string
  fileName: string
  originalName: string | null
  kind: MediaKind
  mimeType: string | null
  size: number | null
  width: number | null
  height: number | null
  alt: string | null
  source: string
  parentId: string | null
  createdAt: string
}

export type PublicationDTO = {
  id: string
  title: string
  titleEn: string | null
  titlePt: string | null
  slug: string
  excerpt: string | null
  excerptEn: string | null
  excerptPt: string | null
  content: string | null
  contentEn: string | null
  contentPt: string | null
  image: string | null
  gallery: string | null
  seoTitle: string | null
  seoDescription: string | null
  seoKeywords: string | null
  published: boolean
  showInMenu: boolean
  menuOrder: number
  category: string | null
  source: string
  externalId: string | null
  externalUrl: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AdminSectionId =
  | 'inicio'
  | 'publicaciones'
  | 'medios'
  | 'redes'
  | 'integraciones'
  | 'clasico'

export type MediaPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (assets: MediaAssetDTO[]) => void
  multiple?: boolean
  accept?: 'image' | 'video' | 'all'
  title?: string
}

export type PhotoEditorProps = {
  asset: MediaAssetDTO | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se llama con la nueva versión guardada (el original nunca se sobrescribe). */
  onSaved: (asset: MediaAssetDTO) => void
}

/* ---- Publicaciones y redes sociales (Meta) ---- */

/** Respuesta del API de publicaciones: el DTO más la galería ya parseada y la ruta pública. */
export type PublicationListItem = PublicationDTO & {
  galleryUrls: string[]
  href: string
}

export type SocialNetwork = 'instagram' | 'facebook'

export type SocialConnectionStatus = {
  connected: boolean
  provider: 'meta'
  pageId: string | null
  pageName: string | null
  igUserId: string | null
  igUsername: string | null
  tokenPreview: string | null
  tokenExpiresAt: string | null
  autoPublish: boolean
  lastSyncAt: string | null
  lastSyncError: string | null
  graphVersion: string
}

export type SocialPostMedia = {
  type: 'image' | 'video'
  url: string
  thumbnailUrl?: string
}

export type SocialPostDTO = {
  id: string
  network: SocialNetwork
  caption: string
  permalink: string | null
  timestamp: string | null
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media: SocialPostMedia[]
  alreadyImported: boolean
  publicationId?: string
}

export type SocialPostsResponse = {
  posts: SocialPostDTO[]
  nextCursor: string | null
}

export type SocialImportResult = {
  imported: Array<{ id: string; publicationId: string }>
  skipped: Array<{ id: string; reason: string; publicationId?: string }>
  errors: Array<{ id: string; error: string }>
}

/** Clave de sessionStorage para pedir a la sección Publicaciones que abra una publicación concreta. */
export const OPEN_PUBLICATION_KEY = 'ssa-admin:open-publication'
