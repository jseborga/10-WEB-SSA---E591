'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react'
import {
  ArrowLeft,
  Bold,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  Facebook,
  Heading2,
  ImagePlus,
  Images,
  Info,
  Instagram,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Menu as MenuIcon,
  PenLine,
  Plus,
  Search,
  Sparkles,
  SquarePen,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PublicationContent } from '@/components/publication-content'
import { PublicationGallery } from '@/components/publication-gallery'
import { MediaPicker } from './media-picker'
import { PhotoEditor } from './photo-editor'
import { OPEN_PUBLICATION_KEY, type MediaAssetDTO, type PublicationListItem } from './types'

/* ------------------------------------------------------------------ */
/* Utilidades                                                           */
/* ------------------------------------------------------------------ */

type ListTab = 'all' | 'draft' | 'published' | 'social'

const MANAGED_PAGES: Record<string, string> = {
  estudio: 'Estudio',
  nosotros: 'Estudio',
  'sobre-nosotros': 'Estudio',
  about: 'Estudio',
  servicios: 'Servicios',
  services: 'Servicios',
  servicos: 'Servicios',
  contacto: 'Contacto',
  contact: 'Contacto',
  contato: 'Contacto',
  cotizacion: 'Cotización',
  'cotizacion-de-proyectos': 'Cotización',
  quote: 'Cotización',
  quotation: 'Cotización',
}

const VIDEO_URL = /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i

const dateFormatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function readError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (response.status === 403) return 'Solo un administrador puede hacer esto.'
  return data.error || fallback
}

/** Busca el MediaAsset de una URL /api/media/<clave> para poder abrir el editor de fotos. */
async function findAssetByUrl(url: string): Promise<MediaAssetDTO | null> {
  const match = /\/api\/media\/([^/?#]+)/.exec(url)
  if (!match) return null
  const key = decodeURIComponent(match[1])
  const response = await fetch(`/api/admin/media?q=${encodeURIComponent(key)}&limit=10`, { cache: 'no-store' })
  if (!response.ok) return null
  const data = (await response.json().catch(() => ({}))) as { items?: MediaAssetDTO[] }
  return data.items?.find((item) => item.url === url || item.fileName === key) || null
}

function SourceIcon({ source, className = 'h-4 w-4' }: { source: string; className?: string }) {
  if (source === 'instagram') return <Instagram className={`${className} text-pink-600`} aria-label="Instagram" />
  if (source === 'facebook') return <Facebook className={`${className} text-blue-600`} aria-label="Facebook" />
  return <PenLine className={`${className} text-zinc-400`} aria-label="Creada en el panel" />
}

function StatusPill({ published }: { published: boolean }) {
  return published ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> Publicada
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" aria-hidden /> Borrador
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Lista                                                                */
/* ------------------------------------------------------------------ */

export function PublicationsManager() {
  const [items, setItems] = useState<PublicationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<ListTab>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<PublicationListItem | 'new' | null>(null)

  // Encadenado con then(): ningún setState ocurre de forma síncrona, así se puede llamar desde un efecto.
  const fetchItems = useCallback(
    () =>
      fetch('/api/publications?status=all', { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) throw new Error(await readError(response, 'No se pudieron cargar las publicaciones.'))
          const data = (await response.json()) as PublicationListItem[]
          const list = Array.isArray(data) ? data : []
          setItems(list)
          setLoadError('')

          // Otra sección (Redes) puede pedir abrir una publicación concreta.
          let pendingId: string | null = null
          try {
            pendingId = window.sessionStorage.getItem(OPEN_PUBLICATION_KEY)
            window.sessionStorage.removeItem(OPEN_PUBLICATION_KEY)
          } catch {
            pendingId = null
          }
          const target = pendingId ? list.find((item) => item.id === pendingId) : null
          if (target) setEditing(target)
        })
        .catch((error: unknown) => {
          setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar las publicaciones.')
        })
        .finally(() => setLoading(false)),
    [],
  )

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  const reload = () => {
    setLoading(true)
    setLoadError('')
    void fetchItems()
  }

  const counts = useMemo(
    () => ({
      all: items.length,
      draft: items.filter((item) => !item.published).length,
      published: items.filter((item) => item.published).length,
      social: items.filter((item) => item.source !== 'manual').length,
    }),
    [items],
  )

  const visible = useMemo(() => {
    const needle = slugify(query)
    return items.filter((item) => {
      if (tab === 'draft' && item.published) return false
      if (tab === 'published' && !item.published) return false
      if (tab === 'social' && item.source === 'manual') return false
      if (!needle) return true
      return slugify(`${item.title} ${item.excerpt || ''} ${item.category || ''} ${item.slug}`).includes(needle)
    })
  }, [items, query, tab])

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category).filter((value): value is string => Boolean(value)))).sort(),
    [items],
  )

  if (editing) {
    return (
      <PublicationEditor
        key={editing === 'new' ? 'new' : editing.id}
        initial={editing === 'new' ? null : editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setItems((current) => {
            const exists = current.some((item) => item.id === saved.id)
            return exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current]
          })
        }}
        onDeleted={(id) => {
          setItems((current) => current.filter((item) => item.id !== id))
          setEditing(null)
        }}
      />
    )
  }

  const tabs: Array<{ id: ListTab; label: string; count: number }> = [
    { id: 'all', label: 'Todas', count: counts.all },
    { id: 'draft', label: 'Borradores', count: counts.draft },
    { id: 'published', label: 'Publicadas', count: counts.published },
    { id: 'social', label: 'Desde redes', count: counts.social },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Publicaciones</h1>
          <p className="mt-1 text-sm text-zinc-500">Noticias, páginas del sitio y posts importados de tus redes.</p>
        </div>
        <Button onClick={() => setEditing('new')} className="bg-sky-600 text-white hover:bg-sky-700">
          <Plus aria-hidden /> Nueva publicación
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Filtrar publicaciones" className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                tab === item.id ? 'bg-white font-medium text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {item.label}
              <span className="ml-1.5 text-xs tabular-nums text-zinc-400">{item.count}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título o categoría"
            aria-label="Buscar publicaciones"
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50" />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {loadError}{' '}
          <button type="button" onClick={reload} className="font-medium underline">
            Reintentar
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
          <Images className="mx-auto h-8 w-8 text-zinc-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-zinc-700">
            {query ? 'No hay resultados para esa búsqueda.' : tab === 'social' ? 'Aún no importaste posts de tus redes.' : 'Todavía no hay publicaciones aquí.'}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {tab === 'social' ? 'Conecta Instagram o Facebook en la sección Redes para traerlos.' : 'Crea la primera con el botón “Nueva publicación”.'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setEditing(item)}
                className="group flex h-full w-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-left transition hover:border-zinc-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100">
                  {item.image ? (
                    <img src={item.image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-300">
                      <ImagePlus className="h-8 w-8" aria-hidden />
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    <StatusPill published={item.published} />
                    {item.showInMenu ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                        <MenuIcon className="h-3 w-3" aria-hidden /> Menú
                      </span>
                    ) : null}
                  </div>
                  {item.galleryUrls.length > 1 ? (
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                      <Images className="h-3 w-3" aria-hidden /> {item.galleryUrls.length}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h2 className="line-clamp-2 font-medium leading-snug text-zinc-900">{item.title}</h2>
                  {item.excerpt ? <p className="line-clamp-2 text-sm text-zinc-500">{item.excerpt}</p> : null}
                  <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-zinc-500">
                    <SourceIcon source={item.source} className="h-3.5 w-3.5" />
                    <span>{formatDate(item.publishedAt || item.updatedAt)}</span>
                    {item.category ? <span className="truncate">· {item.category}</span> : null}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Editor                                                               */
/* ------------------------------------------------------------------ */

type FormState = {
  title: string
  slug: string
  excerpt: string
  content: string
  titleEn: string
  excerptEn: string
  contentEn: string
  titlePt: string
  excerptPt: string
  contentPt: string
  image: string
  gallery: string[]
  category: string
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  showInMenu: boolean
  menuOrder: string
  published: boolean
}

type AiSuggestion = Partial<Record<'title' | 'excerpt' | 'content' | 'category' | 'seoTitle' | 'seoDescription' | 'seoKeywords' | 'slug', string>>

function toForm(item: PublicationListItem | null): FormState {
  return {
    title: item?.title || '',
    slug: item?.slug || '',
    excerpt: item?.excerpt || '',
    content: item?.content || '',
    titleEn: item?.titleEn || '',
    excerptEn: item?.excerptEn || '',
    contentEn: item?.contentEn || '',
    titlePt: item?.titlePt || '',
    excerptPt: item?.excerptPt || '',
    contentPt: item?.contentPt || '',
    image: item?.image || '',
    gallery: item?.galleryUrls || [],
    category: item?.category || '',
    seoTitle: item?.seoTitle || '',
    seoDescription: item?.seoDescription || '',
    seoKeywords: item?.seoKeywords || '',
    showInMenu: Boolean(item?.showInMenu),
    menuOrder: String(item?.menuOrder ?? 0),
    published: Boolean(item?.published),
  }
}

type PhotoTarget = { asset: MediaAssetDTO; target: 'cover' | number }

function PublicationEditor({
  initial,
  categories,
  onClose,
  onSaved,
  onDeleted,
}: {
  initial: PublicationListItem | null
  categories: string[]
  onClose: () => void
  onSaved: (item: PublicationListItem) => void
  onDeleted: (id: string) => void
}) {
  const [current, setCurrent] = useState<PublicationListItem | null>(initial)
  const [baseline, setBaseline] = useState<FormState>(() => toForm(initial))
  const [form, setForm] = useState<FormState>(() => toForm(initial))
  const [saving, setSaving] = useState<null | 'save' | 'publish' | 'unpublish'>(null)
  const [preview, setPreview] = useState(false)
  const [pickerMode, setPickerMode] = useState<null | 'cover' | 'gallery'>(null)
  const [photoTarget, setPhotoTarget] = useState<PhotoTarget | null>(null)
  const [coverAsset, setCoverAsset] = useState<MediaAssetDTO | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null)
  const [seoOpen, setSeoOpen] = useState(false)
  const [translationsOpen, setTranslationsOpen] = useState(false)
  const [linkDialog, setLinkDialog] = useState<{ text: string; url: string } | null>(null)
  const [origin] = useState(() => (typeof window === 'undefined' ? '' : window.location.origin))
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 })

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline])
  const slugForKind = slugify(form.slug || form.title)
  const managedLabel = MANAGED_PAGES[slugForKind] || null
  const publicHref = current?.href || ''
  const publicUrl = publicHref ? `${origin}${publicHref}` : ''

  // Aviso del navegador al cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }

  /* ---- Guardado ---- */

  const save = async (mode: 'save' | 'publish' | 'unpublish') => {
    if (!form.title.trim()) {
      toast.error('Escribe un título antes de guardar.')
      return
    }

    const published = mode === 'publish' ? true : mode === 'unpublish' ? false : form.published
    setSaving(mode)

    try {
      const response = await fetch(current ? `/api/publications/${current.id}` : '/api/publications', {
        method: current ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          slug: form.slug.trim(),
          published,
          menuOrder: Number.parseInt(form.menuOrder, 10) || 0,
          gallery: form.gallery,
        }),
      })

      if (!response.ok) throw new Error(await readError(response, 'No se pudo guardar la publicación.'))

      const saved = (await response.json()) as PublicationListItem
      const nextForm = toForm(saved)
      setCurrent(saved)
      setForm(nextForm)
      setBaseline(nextForm)
      onSaved(saved)
      toast.success(
        mode === 'publish' ? 'Publicación publicada' : mode === 'unpublish' ? 'Publicación pasada a borrador' : 'Cambios guardados',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la publicación.')
    } finally {
      setSaving(null)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void save('save')
  }

  const handleDelete = async () => {
    if (!current) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/publications/${current.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await readError(response, 'No se pudo eliminar.'))
      toast.success('Publicación eliminada')
      onDeleted(current.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar.')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  /* ---- Portada y galería ---- */

  const uploadCover = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('La portada debe ser una imagen.')
      return
    }
    setUploadingCover(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('source', 'manual')
      const response = await fetch('/api/media/upload', { method: 'POST', body })
      if (!response.ok) throw new Error(await readError(response, 'No se pudo subir la imagen.'))
      const data = (await response.json()) as { id: string; url: string; fileName: string; originalName: string; contentType: string; size: number }
      update('image', data.url)
      setCoverAsset({
        id: data.id,
        url: data.url,
        fileName: data.fileName,
        originalName: data.originalName,
        kind: 'image',
        mimeType: data.contentType,
        size: data.size,
        width: null,
        height: null,
        alt: null,
        source: 'manual',
        parentId: null,
        createdAt: new Date().toISOString(),
      })
      toast.success('Portada subida')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo subir la imagen.')
    } finally {
      setUploadingCover(false)
    }
  }

  const handleCoverDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void uploadCover(file)
  }

  const handlePickerSelect = (assets: MediaAssetDTO[]) => {
    if (pickerMode === 'cover') {
      const asset = assets.find((item) => item.kind === 'image') || assets[0]
      if (asset) {
        update('image', asset.url)
        setCoverAsset(asset)
      }
    } else if (pickerMode === 'gallery') {
      setForm((prev) => ({
        ...prev,
        gallery: [...prev.gallery, ...assets.map((asset) => asset.url).filter((url) => !prev.gallery.includes(url))],
      }))
    }
    setPickerMode(null)
  }

  const openPhotoEditor = async (url: string, target: 'cover' | number) => {
    const asset = target === 'cover' && coverAsset?.url === url ? coverAsset : await findAssetByUrl(url)
    if (!asset) {
      toast.error('Esta imagen no está en la biblioteca de medios, así que no se puede editar aquí.')
      return
    }
    setPhotoTarget({ asset, target })
  }

  const handlePhotoSaved = (asset: MediaAssetDTO) => {
    if (!photoTarget) return
    if (photoTarget.target === 'cover') {
      update('image', asset.url)
      setCoverAsset(asset)
    } else {
      const index = photoTarget.target
      setForm((prev) => ({ ...prev, gallery: prev.gallery.map((url, position) => (position === index ? asset.url : url)) }))
    }
    setPhotoTarget(null)
    toast.success('Foto editada: se usará la nueva versión')
  }

  const moveGalleryItem = (from: number, to: number) => {
    setForm((prev) => {
      if (to < 0 || to >= prev.gallery.length) return prev
      const next = [...prev.gallery]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return { ...prev, gallery: next }
    })
  }

  const dragIndexRef = useRef<number | null>(null)

  /* ---- Barra de formato del contenido ---- */

  const applyToContent = (transform: (value: string, start: number, end: number) => { value: string; start: number; end: number }) => {
    const textarea = contentRef.current
    const start = textarea?.selectionStart ?? form.content.length
    const end = textarea?.selectionEnd ?? form.content.length
    const result = transform(form.content, start, end)
    update('content', result.value)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(result.start, result.end)
    })
  }

  const wrapBold = () =>
    applyToContent((value, start, end) => {
      const selected = value.slice(start, end) || 'texto en negrita'
      const next = `${value.slice(0, start)}**${selected}**${value.slice(end)}`
      return { value: next, start: start + 2, end: start + 2 + selected.length }
    })

  const prefixLines = (kind: 'ul' | 'ol' | 'h2') =>
    applyToContent((value, start, end) => {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const lineEndIndex = value.indexOf('\n', end)
      const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex
      const block = value.slice(lineStart, lineEnd) || (kind === 'h2' ? 'Subtítulo' : 'Elemento')
      const lines = block.split('\n')
      const formatted = lines
        .map((line, index) => {
          const clean = line.replace(/^(#{1,3}\s+|[-*•]\s+|\d+[.)]\s+)/, '')
          if (kind === 'h2') return `## ${clean}`
          return kind === 'ul' ? `- ${clean}` : `${index + 1}. ${clean}`
        })
        .join('\n')
      const next = `${value.slice(0, lineStart)}${formatted}${value.slice(lineEnd)}`
      return { value: next, start: lineStart, end: lineStart + formatted.length }
    })

  const openLinkDialog = () => {
    const textarea = contentRef.current
    const start = textarea?.selectionStart ?? form.content.length
    const end = textarea?.selectionEnd ?? form.content.length
    selectionRef.current = { start, end }
    setLinkDialog({ text: form.content.slice(start, end), url: 'https://' })
  }

  const insertLink = () => {
    if (!linkDialog) return
    const url = linkDialog.url.trim()
    if (!/^(https?:\/\/[^\s]+|\/[^\s]*|mailto:[^\s]+|tel:[^\s]+)$/i.test(url) || url === 'https://') {
      toast.error('Escribe una dirección válida (https://…).')
      return
    }
    const text = linkDialog.text.trim() || url
    const { start, end } = selectionRef.current
    const snippet = `[${text}](${url})`
    update('content', `${form.content.slice(0, start)}${snippet}${form.content.slice(end)}`)
    setLinkDialog(null)
    requestAnimationFrame(() => {
      contentRef.current?.focus()
      contentRef.current?.setSelectionRange(start + snippet.length, start + snippet.length)
    })
  }

  /* ---- IA ---- */

  const generateWithAi = async () => {
    setAiLoading(true)
    try {
      const response = await fetch('/api/ai/publication-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          excerpt: form.excerpt,
          content: form.content,
          category: form.category,
          seoTitle: form.seoTitle,
          seoDescription: form.seoDescription,
          seoKeywords: form.seoKeywords,
          showInMenu: form.showInMenu,
        }),
      })
      if (!response.ok) throw new Error(await readError(response, 'La IA no pudo generar sugerencias.'))
      const data = (await response.json()) as { suggestion?: AiSuggestion }
      if (!data.suggestion) throw new Error('La IA no devolvió sugerencias.')
      setAiSuggestion(data.suggestion)
      setSeoOpen(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'La IA no pudo generar sugerencias.')
    } finally {
      setAiLoading(false)
    }
  }

  const applySuggestion = (keys: Array<keyof AiSuggestion>) => {
    if (!aiSuggestion) return
    setForm((prev) => {
      const next = { ...prev }
      for (const key of keys) {
        const value = aiSuggestion[key]
        if (value) (next as Record<string, unknown>)[key] = value
      }
      return next
    })
  }

  /* ---- Render ---- */

  const sourceLabel = current?.source === 'instagram' ? 'Instagram' : current?.source === 'facebook' ? 'Facebook' : null
  const busy = saving !== null

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Barra superior fija con acciones */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Button type="button" variant="ghost" size="sm" onClick={requestClose} aria-label="Volver a la lista">
          <ArrowLeft aria-hidden /> <span className="hidden sm:inline">Publicaciones</span>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <StatusPill published={form.published} />
          {dirty ? <span className="truncate text-xs text-amber-600">Cambios sin guardar</span> : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setPreview((value) => !value)} aria-pressed={preview}>
          {preview ? <SquarePen aria-hidden /> : <Eye aria-hidden />}
          <span className="hidden sm:inline">{preview ? 'Editar' : 'Vista previa'}</span>
        </Button>
        <Button
          type={preview ? 'button' : 'submit'}
          form={preview ? undefined : 'publication-form'}
          onClick={preview ? () => void save('save') : undefined}
          variant="outline"
          size="sm"
          disabled={busy || (!dirty && Boolean(current))}
        >
          {saving === 'save' ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Guardar
        </Button>
        {form.published ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void save('unpublish')} disabled={busy}>
            {saving === 'unpublish' ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Despublicar
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={() => void save('publish')} disabled={busy} className="bg-sky-600 text-white hover:bg-sky-700">
            {saving === 'publish' ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Publicar
          </Button>
        )}
      </div>

      {sourceLabel ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          <SourceIcon source={current?.source || 'manual'} />
          <span>
            Importada desde {sourceLabel}
            {current?.publishedAt ? ` · ${formatDate(current.publishedAt)}` : ''}
          </span>
          {current?.externalUrl ? (
            <a href={current.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline">
              · Ver original <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      ) : null}

      {form.published && publicUrl ? (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm sm:flex-row sm:items-center">
          <span className="text-emerald-800">Visible en</span>
          <code className="min-w-0 flex-1 truncate rounded-md bg-white px-2 py-1 text-xs text-zinc-700 ring-1 ring-emerald-200">{publicUrl}</code>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(publicUrl).then(
                  () => toast.success('Enlace copiado'),
                  () => toast.error('No se pudo copiar'),
                )
              }}
            >
              <Copy aria-hidden /> Copiar
            </Button>
            <Button type="button" variant="ghost" size="sm" asChild>
              <a href={publicHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden /> Abrir
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      {preview ? (
        <PublicationPreview form={form} />
      ) : (
        <form id="publication-form" onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">
            {/* Portada */}
            <section aria-labelledby="cover-label" className="space-y-2">
              <h2 id="cover-label" className="text-sm font-medium text-zinc-700">
                Portada
              </h2>
              {form.image ? (
                <div className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                  <img src={form.image} alt="Portada" className="aspect-[16/9] w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <Button type="button" size="sm" variant="secondary" onClick={() => setPickerMode('cover')}>
                      <ImagePlus aria-hidden /> Cambiar
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => void openPhotoEditor(form.image, 'cover')}>
                      <SquarePen aria-hidden /> Editar foto
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => update('image', '')} aria-label="Quitar portada">
                      <X aria-hidden /> Quitar
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleCoverDrop}
                  className={`rounded-xl border-2 border-dashed transition ${dragOver ? 'border-sky-500 bg-sky-50' : 'border-zinc-300 bg-zinc-50'}`}
                >
                  <button
                    type="button"
                    onClick={() => setPickerMode('cover')}
                    disabled={uploadingCover}
                    className="flex aspect-[16/7] w-full flex-col items-center justify-center gap-2 rounded-xl text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {uploadingCover ? <Loader2 className="h-8 w-8 animate-spin" aria-hidden /> : <ImagePlus className="h-8 w-8" aria-hidden />}
                    <span className="text-sm font-medium text-zinc-700">{uploadingCover ? 'Subiendo…' : 'Elegir portada'}</span>
                    <span className="text-xs">Arrastra una imagen aquí o haz clic para abrir la biblioteca</span>
                  </button>
                </div>
              )}
            </section>

            {/* Título y resumen */}
            <div className="space-y-2">
              <Label htmlFor="pub-title">Título</Label>
              <Input
                id="pub-title"
                value={form.title}
                onChange={(event) => update('title', event.target.value)}
                placeholder="Ej. Avance de obra en el edificio Las Palmas"
                required
                className="h-11 text-base"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="pub-excerpt">Resumen</Label>
                <span className="text-xs tabular-nums text-zinc-400">{form.excerpt.length}/200</span>
              </div>
              <Textarea
                id="pub-excerpt"
                value={form.excerpt}
                onChange={(event) => update('excerpt', event.target.value)}
                placeholder="Una o dos frases que aparecen en la tarjeta y en buscadores."
                rows={2}
              />
            </div>

            {/* Contenido */}
            <div className="space-y-2">
              <Label htmlFor="pub-content">Contenido</Label>
              {managedLabel ? (
                <p className="flex gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  Esta es la página «{managedLabel}» del sitio. Mantén las líneas de sección (las que empiezan con ## o terminan en “:”)
                  para que el diseño se arme correctamente. Para la edición guiada por secciones usa el panel clásico.
                </p>
              ) : null}
              <div className="overflow-hidden rounded-xl border border-zinc-200 focus-within:ring-2 focus-within:ring-sky-500/40">
                <div role="toolbar" aria-label="Formato del contenido" className="flex flex-wrap gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5">
                  <ToolbarButton label="Negrita" onClick={wrapBold}>
                    <Bold className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton label="Subtítulo" onClick={() => prefixLines('h2')}>
                    <Heading2 className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton label="Lista con viñetas" onClick={() => prefixLines('ul')}>
                    <List className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton label="Lista numerada" onClick={() => prefixLines('ol')}>
                    <ListOrdered className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton label="Enlace" onClick={openLinkDialog}>
                    <Link2 className="h-4 w-4" />
                  </ToolbarButton>
                  <span className="ml-auto hidden self-center pr-1 text-xs text-zinc-400 sm:inline">Deja una línea en blanco entre párrafos</span>
                </div>
                <textarea
                  id="pub-content"
                  ref={contentRef}
                  value={form.content}
                  onChange={(event) => update('content', event.target.value)}
                  rows={14}
                  placeholder="Escribe el texto de la publicación…"
                  className="block w-full resize-y border-0 bg-white px-3 py-3 font-[inherit] text-sm leading-6 text-zinc-800 outline-none"
                />
              </div>
            </div>

            {/* Galería */}
            <section aria-labelledby="gallery-label" className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 id="gallery-label" className="text-sm font-medium text-zinc-700">
                  Galería <span className="font-normal text-zinc-400">({form.gallery.length})</span>
                </h2>
                <Button type="button" variant="outline" size="sm" onClick={() => setPickerMode('gallery')}>
                  <Plus aria-hidden /> Agregar
                </Button>
              </div>
              {form.gallery.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setPickerMode('gallery')}
                  className="w-full rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Sin fotos adicionales. Agrega imágenes o videos para mostrar una galería en la página.
                </button>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {form.gallery.map((url, index) => (
                    <li
                      key={`${url}-${index}`}
                      draggable
                      onDragStart={() => {
                        dragIndexRef.current = index
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault()
                        if (dragIndexRef.current !== null) moveGalleryItem(dragIndexRef.current, index)
                        dragIndexRef.current = null
                      }}
                      className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
                    >
                      {VIDEO_URL.test(url) ? (
                        <div className="flex aspect-square items-center justify-center bg-zinc-900 text-white">
                          <Video className="h-6 w-6" aria-label="Video" />
                        </div>
                      ) : (
                        <img src={url} alt={`Imagen ${index + 1} de la galería`} loading="lazy" className="aspect-square w-full cursor-grab object-cover" />
                      )}
                      {url === form.image ? (
                        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">Portada</span>
                      ) : null}
                      <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                        <div className="flex gap-1">
                          <TileButton label="Mover antes" onClick={() => moveGalleryItem(index, index - 1)} disabled={index === 0}>
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </TileButton>
                          <TileButton label="Mover después" onClick={() => moveGalleryItem(index, index + 1)} disabled={index === form.gallery.length - 1}>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </TileButton>
                        </div>
                        <div className="flex gap-1">
                          {!VIDEO_URL.test(url) ? (
                            <>
                              <TileButton label="Usar como portada" onClick={() => update('image', url)}>
                                <ImagePlus className="h-3.5 w-3.5" />
                              </TileButton>
                              <TileButton label="Editar foto" onClick={() => void openPhotoEditor(url, index)}>
                                <SquarePen className="h-3.5 w-3.5" />
                              </TileButton>
                            </>
                          ) : null}
                          <TileButton
                            label="Quitar de la galería"
                            onClick={() => setForm((prev) => ({ ...prev, gallery: prev.gallery.filter((_, position) => position !== index) }))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </TileButton>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Traducciones */}
            <Collapsible open={translationsOpen} onOpenChange={setTranslationsOpen} className="rounded-xl border border-zinc-200 bg-white">
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                <span>
                  Traducciones (EN/PT)
                  <span className="ml-2 font-normal text-zinc-400">
                    {[form.titleEn && 'EN', form.titlePt && 'PT'].filter(Boolean).join(' · ') || 'opcional'}
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 text-zinc-400 transition ${translationsOpen ? 'rotate-180' : ''}`} aria-hidden />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-6 border-t border-zinc-200 px-4 py-4">
                <p className="text-xs text-zinc-500">Si dejas un idioma vacío, el sitio muestra el texto en español.</p>
                {(['En', 'Pt'] as const).map((lang) => (
                  <fieldset key={lang} className="space-y-3">
                    <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{lang === 'En' ? 'Inglés' : 'Portugués'}</legend>
                    <div className="space-y-1.5">
                      <Label htmlFor={`pub-title${lang}`}>Título</Label>
                      <Input id={`pub-title${lang}`} value={form[`title${lang}`]} onChange={(event) => update(`title${lang}`, event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`pub-excerpt${lang}`}>Resumen</Label>
                      <Textarea id={`pub-excerpt${lang}`} rows={2} value={form[`excerpt${lang}`]} onChange={(event) => update(`excerpt${lang}`, event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`pub-content${lang}`}>Contenido</Label>
                      <Textarea id={`pub-content${lang}`} rows={6} value={form[`content${lang}`]} onChange={(event) => update(`content${lang}`, event.target.value)} />
                    </div>
                  </fieldset>
                ))}
              </CollapsibleContent>
            </Collapsible>

            {/* SEO */}
            <Collapsible open={seoOpen} onOpenChange={setSeoOpen} className="rounded-xl border border-zinc-200 bg-white">
              <div className="flex items-center gap-2 pr-2">
                <CollapsibleTrigger className="flex flex-1 items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                  <span>
                    SEO y dirección
                    <span className="ml-2 font-normal text-zinc-400">{form.seoTitle ? 'configurado' : 'opcional'}</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 text-zinc-400 transition ${seoOpen ? 'rotate-180' : ''}`} aria-hidden />
                </CollapsibleTrigger>
                <Button type="button" variant="outline" size="sm" onClick={() => void generateWithAi()} disabled={aiLoading || !form.title.trim()}>
                  {aiLoading ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                  <span className="hidden sm:inline">Generar con IA</span>
                  <span className="sr-only sm:hidden">Generar con IA</span>
                </Button>
              </div>
              <CollapsibleContent className="space-y-4 border-t border-zinc-200 px-4 py-4">
                {aiSuggestion ? <AiSuggestionPanel suggestion={aiSuggestion} onApply={applySuggestion} onDismiss={() => setAiSuggestion(null)} /> : null}
                <div className="space-y-1.5">
                  <Label htmlFor="pub-slug">Dirección (slug)</Label>
                  <div className="flex items-center rounded-md border border-input bg-zinc-50 text-sm focus-within:ring-2 focus-within:ring-sky-500/40">
                    <span className="pl-3 text-zinc-400">/info/</span>
                    <input
                      id="pub-slug"
                      value={form.slug}
                      onChange={(event) => update('slug', slugify(event.target.value) || event.target.value.toLowerCase())}
                      placeholder={slugify(form.title) || 'se-genera-del-titulo'}
                      className="h-9 min-w-0 flex-1 bg-transparent px-1 outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="pub-seo-title">Título para buscadores</Label>
                    <span className={`text-xs tabular-nums ${form.seoTitle.length > 60 ? 'text-amber-600' : 'text-zinc-400'}`}>{form.seoTitle.length}/60</span>
                  </div>
                  <Input id="pub-seo-title" value={form.seoTitle} onChange={(event) => update('seoTitle', event.target.value)} placeholder={form.title} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="pub-seo-description">Descripción para buscadores</Label>
                    <span className={`text-xs tabular-nums ${form.seoDescription.length > 155 ? 'text-amber-600' : 'text-zinc-400'}`}>
                      {form.seoDescription.length}/155
                    </span>
                  </div>
                  <Textarea
                    id="pub-seo-description"
                    rows={2}
                    value={form.seoDescription}
                    onChange={(event) => update('seoDescription', event.target.value)}
                    placeholder={form.excerpt}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-seo-keywords">Palabras clave (separadas por coma)</Label>
                  <Input id="pub-seo-keywords" value={form.seoKeywords} onChange={(event) => update('seoKeywords', event.target.value)} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Columna lateral */}
          <aside className="space-y-4">
            <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
              <div className="space-y-1.5">
                <Label htmlFor="pub-category">Categoría</Label>
                <Input
                  id="pub-category"
                  list="pub-category-options"
                  value={form.category}
                  onChange={(event) => update('category', event.target.value)}
                  placeholder="noticias, obras, redes…"
                />
                <datalist id="pub-category-options">
                  {categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label htmlFor="pub-menu">Mostrar en el menú del sitio</Label>
                  <p className="mt-1 text-xs text-zinc-500">Aparece en “Información” del menú principal.</p>
                </div>
                <Switch id="pub-menu" checked={form.showInMenu} onCheckedChange={(checked) => update('showInMenu', checked)} />
              </div>

              {form.showInMenu ? (
                <div className="space-y-1.5">
                  <Label htmlFor="pub-menu-order">Orden en el menú</Label>
                  <Input
                    id="pub-menu-order"
                    type="number"
                    inputMode="numeric"
                    value={form.menuOrder}
                    onChange={(event) => update('menuOrder', event.target.value)}
                    className="w-28"
                  />
                </div>
              ) : null}
            </div>

            {current ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 text-xs text-zinc-500">
                <dl className="space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <dt>Creada</dt>
                    <dd className="text-zinc-700">{formatDate(current.createdAt)}</dd>
                  </div>
                  {current.publishedAt ? (
                    <div className="flex justify-between gap-2">
                      <dt>Publicada</dt>
                      <dd className="text-zinc-700">{formatDate(current.publishedAt)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <dt>Actualizada</dt>
                    <dd className="text-zinc-700">{formatDate(current.updatedAt)}</dd>
                  </div>
                </dl>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="mt-3 w-full text-red-600 hover:bg-red-50 hover:text-red-700">
                  <Trash2 aria-hidden /> Eliminar publicación
                </Button>
              </div>
            ) : null}
          </aside>
        </form>
      )}

      <MediaPicker
        open={pickerMode !== null}
        onOpenChange={(open) => {
          if (!open) setPickerMode(null)
        }}
        onSelect={handlePickerSelect}
        multiple={pickerMode === 'gallery'}
        accept={pickerMode === 'gallery' ? 'all' : 'image'}
        title={pickerMode === 'gallery' ? 'Agregar a la galería' : 'Elegir portada'}
      />

      <PhotoEditor
        asset={photoTarget?.asset ?? null}
        open={photoTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPhotoTarget(null)
        }}
        onSaved={handlePhotoSaved}
      />

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>Tienes cambios sin guardar en esta publicación. Si sales ahora, se perderán.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={onClose} className="bg-red-600 text-white hover:bg-red-700">
              Descartar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{current?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              La publicación desaparecerá del sitio{current?.showInMenu ? ' y del menú' : ''}. Las fotos se conservan en la biblioteca de medios. Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={linkDialog !== null} onOpenChange={(open) => !open && setLinkDialog(null)}>
        <AlertDialogContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              insertLink()
            }}
            className="space-y-4"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Insertar enlace</AlertDialogTitle>
              <AlertDialogDescription>El texto se mostrará subrayado y llevará a la dirección indicada.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="link-text">Texto</Label>
              <Input id="link-text" value={linkDialog?.text || ''} onChange={(event) => setLinkDialog((prev) => (prev ? { ...prev, text: event.target.value } : prev))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-url">Dirección</Label>
              <Input
                id="link-url"
                value={linkDialog?.url || ''}
                onChange={(event) => setLinkDialog((prev) => (prev ? { ...prev, url: event.target.value } : prev))}
                placeholder="https://…"
                autoFocus
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
              <Button type="submit" className="bg-sky-600 text-white hover:bg-sky-700">
                Insertar
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Piezas pequeñas                                                      */
/* ------------------------------------------------------------------ */

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 hover:bg-white hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      {children}
    </button>
  )
}

function TileButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-zinc-800 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-40"
    >
      {children}
    </button>
  )
}

const AI_FIELDS: Array<{ key: keyof AiSuggestion; label: string }> = [
  { key: 'title', label: 'Título' },
  { key: 'excerpt', label: 'Resumen' },
  { key: 'content', label: 'Contenido' },
  { key: 'seoTitle', label: 'Título SEO' },
  { key: 'seoDescription', label: 'Descripción SEO' },
  { key: 'seoKeywords', label: 'Palabras clave' },
]

function AiSuggestionPanel({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: AiSuggestion
  onApply: (keys: Array<keyof AiSuggestion>) => void
  onDismiss: () => void
}) {
  const available = AI_FIELDS.filter((field) => suggestion[field.key])

  return (
    <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-sky-900">
          <Sparkles className="h-4 w-4" aria-hidden /> Sugerencias de IA
        </p>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="outline" onClick={() => onApply(['seoTitle', 'seoDescription', 'seoKeywords'])}>
            Usar SEO
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss} aria-label="Cerrar sugerencias">
            <X aria-hidden />
          </Button>
        </div>
      </div>
      <ul className="space-y-2">
        {available.map((field) => (
          <li key={field.key} className="flex items-start gap-3 rounded-md bg-white p-2 text-sm ring-1 ring-sky-100">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-zinc-500">{field.label}</p>
              <p className="line-clamp-3 whitespace-pre-line text-zinc-800">{suggestion[field.key]}</p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => onApply([field.key])} className="text-sky-700">
              Usar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PublicationPreview({ form }: { form: FormState }) {
  const gallery = form.gallery.filter((url) => url !== form.image)
  const today = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Tarjeta</p>
        <article className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white">
          <div className="aspect-[4/3] bg-zinc-100">
            {form.image ? (
              <img src={form.image} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="space-y-3 p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">{today}</p>
            <h3 className="text-lg font-medium leading-snug tracking-tight text-zinc-900">{form.title || 'Sin título'}</h3>
            {form.excerpt ? <p className="line-clamp-3 text-sm leading-6 text-zinc-600">{form.excerpt}</p> : null}
          </div>
        </article>
      </div>

      <div className="min-w-0">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Página</p>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-8 sm:px-8">
          <div className="border-b border-zinc-200 pb-6">
            <h1 className="text-3xl font-light tracking-tight text-zinc-900 sm:text-4xl">{form.title || 'Sin título'}</h1>
            {form.excerpt ? <p className="mt-4 max-w-3xl text-sm text-zinc-600 sm:text-base">{form.excerpt}</p> : null}
          </div>
          {form.image ? (
            <img src={form.image} alt="" className="mt-8 aspect-[16/8] w-full rounded-3xl object-cover" />
          ) : null}
          <div className="mt-10 max-w-3xl">
            <PublicationContent content={form.content} emptyText="Todavía no hay contenido." />
          </div>
          <PublicationGallery urls={gallery} title={form.title} />
        </div>
      </div>
    </div>
  )
}
