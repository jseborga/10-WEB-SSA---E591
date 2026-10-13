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
