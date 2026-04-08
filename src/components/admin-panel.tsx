'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Pencil, Trash2, Building2, FileText, Mail, Bot, Save, Image as ImageIcon, Power, Globe, LockKeyhole, LogIn, LogOut, Upload, Video, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/language-context'
import { formatCategoryLabel, getProjectCategories, isVideoUrl, parseUrlList } from '@/lib/public-site'

interface Project {
  id: string
  title: string
  description: string | null
  fullDescription?: string | null
  category: string
  location: string | null
  year: number | null
  area: string | null
  images: string | null
  mainImage?: string | null
  gallery?: string | null
  videoUrl?: string | null
  client?: string | null
  status?: string | null
  featured?: boolean
  published?: boolean
  publishedAt?: string | null
  createdAt: string
}

interface Publication {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string | null
  image?: string | null
  published: boolean
  showInMenu?: boolean
  menuOrder?: number
  category: string | null
  createdAt: string
}

interface Contact {
  id: string; name: string; email: string; phone: string | null
  subject: string | null; message: string; isRead: boolean; createdAt: string
}

interface ChatConfigType {
  id: string; enabled: boolean; provider: string; apiKey?: string | null; apiBaseUrl?: string | null; model: string | null
  systemPrompt: string; systemPromptEn: string | null; systemPromptPt: string | null
  welcomeMessage: string | null; welcomeMessageEn: string | null; welcomeMessagePt: string | null
  fallbackMessage: string | null; fallbackMessageEn: string | null; fallbackMessagePt: string | null
  companyName: string; companyInfo: string | null; companyInfoEn: string | null; companyInfoPt: string | null
  temperature: number; maxTokens: number
}

interface AdminUser {
  id: string
  username: string
  displayName?: string | null
  role: 'admin' | 'editor'
  active: boolean
  createdAt: string
  updatedAt: string
}

interface SiteSettings {
  companyName: string
  legalName: string
  tagline: string
  siteUrl: string
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  logoUrl: string
  faviconUrl: string
  socialShareImageUrl: string
  heroImages: string
  heroImagesMobile: string
  heroImageOpacity: string
  heroImageSaturation: string
  heroImageBrightness: string
  heroImageContrast: string
  heroImageFit: 'cover' | 'contain'
  heroImageTreatment: 'editorial' | 'original' | 'enhanced' | 'monochrome'
  heroShowCompanyName: boolean
  heroTextTone: 'dark' | 'light'
  projectCategories: string
  email: string
  phone: string
  whatsapp: string
  addressLine: string
  city: string
  country: string
  footerText: string
  instagramUrl: string
  facebookUrl: string
  linkedinUrl: string
  youtubeUrl: string
  tiktokUrl: string
}

type TabType = 'projects' | 'publications' | 'site-config' | 'contacts' | 'ai-config' | 'users'
type SessionState = {
  checking: boolean
  configured: boolean
  authenticated: boolean
  role: 'admin' | 'editor' | null
  username: string | null
  root: boolean
}

type ProjectFormState = {
  title: string
  description: string
  fullDescription: string
  category: string
  location: string
  year: string
  area: string
  mainImage: string
  gallery: string
  videoUrl: string
  client: string
  status: string
  featured: boolean
  published: boolean
}

type PublicationFormState = {
  title: string
  slug: string
  excerpt: string
  content: string
  image: string
  category: string
  showInMenu: boolean
  menuOrder: string
}

type SiteFormState = SiteSettings

type UserFormState = {
  username: string
  displayName: string
  password: string
  role: 'admin' | 'editor'
  active: boolean
}

const emptyProjectForm: ProjectFormState = {
  title: '',
  description: '',
  fullDescription: '',
  category: 'residencial',
  location: '',
  year: '',
  area: '',
  mainImage: '',
  gallery: '',
  videoUrl: '',
  client: '',
  status: 'completed',
  featured: false,
  published: false,
}

const emptyPublicationForm: PublicationFormState = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  image: '',
  category: 'informacion',
  showInMenu: false,
  menuOrder: '0',
}

const emptySiteForm: SiteFormState = {
  companyName: '',
  legalName: '',
  tagline: '',
  siteUrl: '',
  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',
  logoUrl: '',
  faviconUrl: '',
  socialShareImageUrl: '',
  heroImages: '',
  heroImagesMobile: '',
  heroImageOpacity: '34',
  heroImageSaturation: '90',
  heroImageBrightness: '100',
  heroImageContrast: '105',
  heroImageFit: 'cover',
  heroImageTreatment: 'original',
  heroShowCompanyName: false,
  heroTextTone: 'dark',
  projectCategories: '',
  email: '',
  phone: '',
  whatsapp: '',
  addressLine: '',
  city: '',
  country: '',
  footerText: '',
  instagramUrl: '',
  facebookUrl: '',
  linkedinUrl: '',
  youtubeUrl: '',
  tiktokUrl: '',
}

const emptyUserForm: UserFormState = {
  username: '',
  displayName: '',
  password: '',
  role: 'editor',
  active: true,
}

const providers = [
  { id: 'default', name: 'Z-AI (Default)', models: ['default'] },
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'openai-compatible', name: 'OpenAI Compatible', models: ['custom-model'] },
  { id: 'google', name: 'Google AI', models: ['gemini-pro', 'gemini-1.5-pro'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] }
]

function clampIntegerString(value: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed)) {
    return String(fallback)
  }

  return String(Math.min(max, Math.max(min, parsed)))
}

function normalizeChoice<T extends string>(value: string, fallback: T, options: readonly T[]): T {
  return options.includes(value as T) ? (value as T) : fallback
}

function clampPreviewNumber(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

function getHeroPreviewStyles(siteForm: SiteFormState) {
  const treatment = normalizeChoice(siteForm.heroImageTreatment, 'original', ['editorial', 'original', 'enhanced', 'monochrome'] as const)
  const fit = normalizeChoice(siteForm.heroImageFit, 'cover', ['cover', 'contain'] as const)
  const brightness = clampPreviewNumber(siteForm.heroImageBrightness, 100, 70, 150)
  const contrast = clampPreviewNumber(siteForm.heroImageContrast, 105, 80, 160)
  const saturation = clampPreviewNumber(siteForm.heroImageSaturation, 90, 0, 160)
  const opacity = treatment === 'original' ? 1 : clampPreviewNumber(siteForm.heroImageOpacity, 34, 5, 70) / 100
  const overlayOpacity = treatment === 'original' ? 0 : Math.max(0.16, Math.min(0.56, 0.58 - opacity * 0.45))
  const grayscale = treatment === 'monochrome' ? 100 : Math.max(0, Math.round(100 - saturation * 0.38))
  const textTone = siteForm.heroTextTone === 'light' ? 'light' : 'dark'

  const filter =
    treatment === 'original'
      ? `brightness(${brightness / 100}) contrast(${contrast / 100})`
      : treatment === 'enhanced'
        ? `grayscale(8%) saturate(${Math.max(1, saturation / 100 * 1.08)}) brightness(${brightness / 100}) contrast(${contrast / 100})`
        : `grayscale(${grayscale}%) saturate(${Math.max(0, saturation / 100)}) brightness(${brightness / 100}) contrast(${contrast / 100})`

  return {
    fit,
    opacity,
    filter,
    overlayOpacity,
    textTone,
  }
}

interface AdminPanelProps {
  initialOpen?: boolean
  hideLauncher?: boolean
}

export function AdminPanel({ initialOpen = false, hideLauncher = false }: AdminPanelProps) {
  const { t, language } = useLanguage()
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [activeTab, setActiveTab] = useState<TabType>('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [publications, setPublications] = useState<Publication[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [chatConfig, setChatConfig] = useState<ChatConfigType | null>(null)
  const [loading, setLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const [aiLangTab, setAiLangTab] = useState<'es' | 'en' | 'pt'>('es')
  const [session, setSession] = useState<SessionState>({
    checking: false,
    configured: false,
    authenticated: false,
    role: null,
    username: null,
    root: false,
  })
  const [adminUsername, setAdminUsername] = useState('admin')
  const [adminPassword, setAdminPassword] = useState('')

  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm)
  const [publicationForm, setPublicationForm] = useState<PublicationFormState>(emptyPublicationForm)
  const [siteForm, setSiteForm] = useState<SiteFormState>(emptySiteForm)
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm)
  const [aiForm, setAiForm] = useState({
    enabled: false, provider: 'default', apiKey: '', apiBaseUrl: '', model: '',
    systemPrompt: '', systemPromptEn: '', systemPromptPt: '',
    welcomeMessage: '', welcomeMessageEn: '', welcomeMessagePt: '',
    fallbackMessage: '', fallbackMessageEn: '', fallbackMessagePt: '',
    companyName: '', companyInfo: '', companyInfoEn: '', companyInfoPt: '',
    temperature: 0.7, maxTokens: 1000
  })

  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editingPublication, setEditingPublication] = useState<Publication | null>(null)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [showPublicationDialog, setShowPublicationDialog] = useState(false)
  const projectCategoryOptions = useMemo(
    () => getProjectCategories(siteForm.projectCategories, projects.map((project) => project.category)),
    [projects, siteForm.projectCategories],
  )
  const heroPreviewImage = useMemo(() => parseUrlList(siteForm.heroImages)[0] || '', [siteForm.heroImages])
  const heroPreviewMobileImage = useMemo(
    () => parseUrlList(siteForm.heroImagesMobile)[0] || heroPreviewImage,
    [heroPreviewImage, siteForm.heroImagesMobile],
  )
  const heroPreviewStyles = useMemo(() => getHeroPreviewStyles(siteForm), [siteForm])

  const authCopy = useMemo(() => {
    if (language === 'en') {
      return {
        title: 'Admin access',
        description: 'Use admin or another active user to unlock the panel.',
        notConfigured: 'Admin is disabled. Define ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Easypanel.',
        username: 'Username',
        password: 'Password',
        login: 'Unlock',
        logout: 'Logout',
        invalid: 'Invalid credentials',
      }
    }

    if (language === 'pt') {
      return {
        title: 'Acesso admin',
        description: 'Use admin ou outro usuário ativo para liberar o painel.',
        notConfigured: 'O admin está desativado. Defina ADMIN_PASSWORD e ADMIN_SESSION_SECRET no Easypanel.',
        username: 'Usuário',
        password: 'Senha',
        login: 'Entrar',
        logout: 'Sair',
        invalid: 'Credenciais inválidas',
      }
    }

    return {
      title: 'Acceso admin',
      description: 'Usa admin u otro usuario activo para liberar el panel.',
      notConfigured: 'El admin está desactivado. Define ADMIN_PASSWORD y ADMIN_SESSION_SECRET en Easypanel.',
      username: 'Usuario',
      password: 'Contraseña',
      login: 'Entrar',
      logout: 'Salir',
      invalid: 'Credenciales inválidas',
    }
  }, [language])

  const loadSession = async () => {
    setSession(current => ({ ...current, checking: true }))

    try {
      const response = await fetch('/api/admin/session', { cache: 'no-store' })
      const data = await response.json()
      setSession({
        checking: false,
        configured: Boolean(data.configured),
        authenticated: Boolean(data.authenticated),
        role: data.role === 'admin' ? 'admin' : data.role === 'editor' ? 'editor' : null,
        username: typeof data.username === 'string' ? data.username : null,
        root: Boolean(data.root),
      })
    } catch {
      setSession({ checking: false, configured: false, authenticated: false, role: null, username: null, root: false })
    }
  }

  const loadAdminData = async () => {
    try {
      const isAdminUser = session.role === 'admin'
      const [projectsRes, publicationsRes, contactsRes, configRes, siteRes, usersRes] = await Promise.all([
        fetch('/api/projects', { cache: 'no-store' }),
        fetch('/api/publications', { cache: 'no-store' }),
        fetch('/api/contact', { cache: 'no-store' }),
        fetch('/api/chat-config', { cache: 'no-store' }),
        fetch('/api/site-settings', { cache: 'no-store' }),
        isAdminUser ? fetch('/api/admin/users', { cache: 'no-store' }) : Promise.resolve(null),
      ])

      if ([projectsRes, publicationsRes, contactsRes, configRes, siteRes, usersRes].some(response => response?.status === 401)) {
        setSession(current => ({ ...current, authenticated: false, role: null, username: null, root: false }))
        return
      }

      const [projectsData, publicationsData, contactsData, configData, siteData, usersData] = await Promise.all([
        projectsRes.json(),
        publicationsRes.json(),
        contactsRes.json(),
        configRes.json(),
        siteRes.json(),
        usersRes ? usersRes.json() : Promise.resolve([]),
      ])

      setProjects(Array.isArray(projectsData) ? projectsData : [])
      setPublications(Array.isArray(publicationsData) ? publicationsData : [])
      setContacts(Array.isArray(contactsData) ? contactsData : [])
      setUsers(Array.isArray(usersData) ? usersData : [])
      setChatConfig(configData)
      setSiteForm({
        companyName: siteData.companyName || '',
        legalName: siteData.legalName || '',
        tagline: siteData.tagline || '',
        siteUrl: siteData.siteUrl || '',
        seoTitle: siteData.seoTitle || '',
        seoDescription: siteData.seoDescription || '',
        seoKeywords: siteData.seoKeywords || '',
        logoUrl: siteData.logoUrl || '',
        faviconUrl: siteData.faviconUrl || '',
        socialShareImageUrl: siteData.socialShareImageUrl || '',
        heroImages: siteData.heroImages || '',
        heroImagesMobile: siteData.heroImagesMobile || '',
        heroImageOpacity: String(siteData.heroImageOpacity ?? 34),
        heroImageSaturation: String(siteData.heroImageSaturation ?? 90),
        heroImageBrightness: String(siteData.heroImageBrightness ?? 100),
        heroImageContrast: String(siteData.heroImageContrast ?? 105),
        heroImageFit: siteData.heroImageFit === 'contain' ? 'contain' : 'cover',
        heroImageTreatment: ['editorial', 'original', 'enhanced', 'monochrome'].includes(siteData.heroImageTreatment) ? siteData.heroImageTreatment : 'original',
        heroShowCompanyName: Boolean(siteData.heroShowCompanyName),
        heroTextTone: siteData.heroTextTone === 'light' ? 'light' : 'dark',
        projectCategories: siteData.projectCategories || '',
        email: siteData.email || '',
        phone: siteData.phone || '',
        whatsapp: siteData.whatsapp || '',
        addressLine: siteData.addressLine || '',
        city: siteData.city || '',
        country: siteData.country || '',
        footerText: siteData.footerText || '',
        instagramUrl: siteData.instagramUrl || '',
        facebookUrl: siteData.facebookUrl || '',
        linkedinUrl: siteData.linkedinUrl || '',
        youtubeUrl: siteData.youtubeUrl || '',
        tiktokUrl: siteData.tiktokUrl || '',
      })
      setAiForm({
        enabled: configData.enabled,
        provider: configData.provider || 'default',
        apiKey: configData.apiKey || '',
        apiBaseUrl: configData.apiBaseUrl || '',
        model: configData.model || '',
        systemPrompt: configData.systemPrompt || '',
        systemPromptEn: configData.systemPromptEn || '',
        systemPromptPt: configData.systemPromptPt || '',
        welcomeMessage: configData.welcomeMessage || '',
        welcomeMessageEn: configData.welcomeMessageEn || '',
        welcomeMessagePt: configData.welcomeMessagePt || '',
        fallbackMessage: configData.fallbackMessage || '',
        fallbackMessageEn: configData.fallbackMessageEn || '',
        fallbackMessagePt: configData.fallbackMessagePt || '',
        companyName: configData.companyName || '',
        companyInfo: configData.companyInfo || '',
        companyInfoEn: configData.companyInfoEn || '',
        companyInfoPt: configData.companyInfoPt || '',
        temperature: configData.temperature || 0.7,
        maxTokens: configData.maxTokens || 1000,
      })
    } catch {
      toast.error('No se pudo cargar el panel')
    }
  }

  useEffect(() => {
    if (isOpen) {
      void loadSession()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && session.authenticated) {
      void loadAdminData()
    }
  }, [isOpen, session.authenticated, session.role])

  useEffect(() => {
    if (session.role !== 'admin' && ['site-config', 'ai-config', 'users'].includes(activeTab)) {
      setActiveTab('projects')
    }
  }, [activeTab, session.role])

  const buildSlug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const parseGalleryUrls = (value: string) =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

  const uploadFile = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData,
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data.url) {
      throw new Error(data.error || 'No se pudo subir el archivo')
    }

    return data.url as string
  }

  const handleProjectUpload = async (files: FileList | null, target: 'mainImage' | 'gallery' | 'videoUrl') => {
    if (!files || files.length === 0) return

    setUploadingField(target)

    try {
      if (target === 'gallery') {
        const uploadedUrls = []

        for (const file of Array.from(files)) {
          uploadedUrls.push(await uploadFile(file))
        }

        setProjectForm((current) => ({
          ...current,
          gallery: [current.gallery.trim(), ...uploadedUrls].filter(Boolean).join('\n'),
        }))
      } else if (target === 'mainImage') {
        const [file] = Array.from(files)
        const uploadedUrl = await uploadFile(file)
        setProjectForm((current) => ({ ...current, mainImage: uploadedUrl }))
      } else {
        const [file] = Array.from(files)
        const uploadedUrl = await uploadFile(file)
        setProjectForm((current) => ({ ...current, videoUrl: uploadedUrl }))
      }

      toast.success('Archivo subido correctamente')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo subir el archivo')
    } finally {
      setUploadingField(null)
    }
  }

  const handlePublicationImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploadingField('publicationImage')

    try {
      const [file] = Array.from(files)
      const uploadedUrl = await uploadFile(file)
      setPublicationForm((current) => ({ ...current, image: uploadedUrl }))
      toast.success('Imagen subida correctamente')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo subir el archivo')
    } finally {
      setUploadingField(null)
    }
  }

  const handleSiteAssetUpload = async (files: FileList | null, target: 'logoUrl' | 'faviconUrl' | 'socialShareImageUrl') => {
    if (!files || files.length === 0) return

    setUploadingField(target)

    try {
      const [file] = Array.from(files)
      const uploadedUrl = await uploadFile(file)
      setSiteForm((current) => ({ ...current, [target]: uploadedUrl }))
      toast.success('Imagen subida correctamente')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo subir el archivo')
    } finally {
      setUploadingField(null)
    }
  }

  const handleSiteHeroUpload = async (files: FileList | null, target: 'heroImages' | 'heroImagesMobile') => {
    if (!files || files.length === 0) return

    setUploadingField(target)

    try {
      const uploadedUrls = []

      for (const file of Array.from(files)) {
        uploadedUrls.push(await uploadFile(file))
      }

      setSiteForm((current) => ({
        ...current,
        [target]: [...uploadedUrls, current[target].trim()].filter(Boolean).join('\n'),
      }))

      toast.success('Medios del hero subidos correctamente')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo subir el archivo')
    } finally {
      setUploadingField(null)
    }
  }

  const handleLogin = async () => {
    setAuthLoading(true)

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        toast.error(data.error || authCopy.invalid)
        return
      }

      const data = await response.json().catch(() => ({}))
      setAdminUsername(data.username || adminUsername || 'admin')
      setAdminPassword('')
      setSession(current => ({
        ...current,
        authenticated: true,
        role: data.role === 'admin' ? 'admin' : 'editor',
        username: data.username || adminUsername || 'admin',
        root: data.username === 'admin' && data.role === 'admin',
      }))
    } catch {
      toast.error(authCopy.invalid)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {})
    setSession(current => ({ ...current, authenticated: false, role: null, username: null, root: false }))
  }

  const handleSaveProject = async (publishOverride?: boolean) => {
    setLoading(true)
    try {
      const url = editingProject ? `/api/projects/${editingProject.id}` : '/api/projects'
      const method = editingProject ? 'PUT' : 'POST'
      const published = publishOverride ?? projectForm.published
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: projectForm.title,
          description: projectForm.description,
          fullDescription: projectForm.fullDescription,
          category: projectForm.category,
          location: projectForm.location,
          year: projectForm.year ? parseInt(projectForm.year, 10) : null,
          area: projectForm.area,
          mainImage: projectForm.mainImage,
          gallery: parseGalleryUrls(projectForm.gallery),
          videoUrl: projectForm.videoUrl,
          client: projectForm.client,
          status: projectForm.status,
          featured: projectForm.featured,
          published,
        }),
      })
      if (res.ok) {
        toast.success(
          editingProject
            ? published ? 'Proyecto actualizado y publicado' : 'Proyecto actualizado como borrador'
            : published ? 'Proyecto creado y publicado' : 'Proyecto guardado como borrador',
        )
        setShowProjectDialog(false); setEditingProject(null)
        setProjectForm(emptyProjectForm)
        void loadAdminData()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Error al guardar el proyecto')
      }
    } catch { toast.error('Error al guardar') }
    finally { setLoading(false) }
  }

  const handleDeleteProject = async (id: string) => {
    if (!confirm(t.admin.confirmDelete)) return
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Eliminado'); void loadAdminData() }
    } catch { toast.error('Error') }
  }

  const openEditProject = (project: Project) => {
    setEditingProject(project)
    let gallery = ''

    if (project.gallery) {
      try {
        gallery = JSON.parse(project.gallery).join('\n')
      } catch {
        gallery = project.gallery
      }
    }

    setProjectForm({
      title: project.title,
      description: project.description || '',
      fullDescription: project.fullDescription || '',
      category: project.category,
      location: project.location || '',
      year: project.year?.toString() || '',
      area: project.area || '',
      mainImage: project.mainImage || project.images || '',
      gallery,
      videoUrl: project.videoUrl || '',
      client: project.client || '',
      status: project.status || 'completed',
      featured: Boolean(project.featured),
      published: Boolean(project.published),
    })
    setShowProjectDialog(true)
  }

  const handleSavePublication = async () => {
    setLoading(true)
    try {
      const url = editingPublication ? `/api/publications/${editingPublication.id}` : '/api/publications'
      const method = editingPublication ? 'PUT' : 'POST'
      const slug = publicationForm.slug || buildSlug(publicationForm.title)
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...publicationForm,
          slug,
          published: true,
          menuOrder: parseInt(publicationForm.menuOrder, 10) || 0,
        }),
      })
      if (res.ok) {
        toast.success(editingPublication ? 'Actualizado' : 'Publicado')
        setShowPublicationDialog(false); setEditingPublication(null)
        setPublicationForm(emptyPublicationForm)
        void loadAdminData()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'No se pudo guardar la página')
      }
    } catch { toast.error('Error') }
    finally { setLoading(false) }
  }

  const handleDeletePublication = async (id: string) => {
    if (!confirm(t.admin.confirmDelete)) return
    try { await fetch(`/api/publications/${id}`, { method: 'DELETE' }); toast.success('Eliminado'); void loadAdminData() } catch { toast.error('Error') }
  }

  const openEditPublication = (pub: Publication) => {
    setEditingPublication(pub)
    setPublicationForm({
      title: pub.title,
      slug: pub.slug,
      excerpt: pub.excerpt || '',
      content: pub.content || '',
      image: pub.image || '',
      category: pub.category || 'informacion',
      showInMenu: Boolean(pub.showInMenu),
      menuOrder: String(pub.menuOrder ?? 0),
    })
    setShowPublicationDialog(true)
  }

  const handleSaveSiteConfig = async () => {
    setLoading(true)
    try {
      const normalizedSiteForm = {
        ...siteForm,
        heroImageOpacity: clampIntegerString(siteForm.heroImageOpacity, 34, 5, 70),
        heroImageSaturation: clampIntegerString(siteForm.heroImageSaturation, 90, 0, 160),
        heroImageBrightness: clampIntegerString(siteForm.heroImageBrightness, 100, 70, 150),
        heroImageContrast: clampIntegerString(siteForm.heroImageContrast, 105, 80, 160),
        heroImageFit: normalizeChoice(siteForm.heroImageFit, 'cover', ['cover', 'contain'] as const),
        heroImageTreatment: normalizeChoice(siteForm.heroImageTreatment, 'original', ['editorial', 'original', 'enhanced', 'monochrome'] as const),
        heroTextTone: normalizeChoice(siteForm.heroTextTone, 'dark', ['dark', 'light'] as const),
      }

      const res = await fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedSiteForm),
      })

      if (res.ok) {
        toast.success('Configuracion del sitio actualizada')
        setSiteForm(normalizedSiteForm)
        void loadAdminData()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'No se pudo guardar la configuracion del sitio')
      }
    } catch {
      toast.error('Error')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveUser = async () => {
    setLoading(true)
    try {
      const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users'
      const method = editingUser ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      })

      if (res.ok) {
        toast.success(editingUser ? 'Usuario actualizado' : 'Usuario creado')
        setEditingUser(null)
        setUserForm(emptyUserForm)
        void loadAdminData()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'No se pudo guardar el usuario')
      }
    } catch {
      toast.error('Error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm('¿Eliminar este usuario?')) return
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Usuario eliminado')
        if (editingUser?.id === id) {
          setEditingUser(null)
          setUserForm(emptyUserForm)
        }
        void loadAdminData()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'No se pudo eliminar el usuario')
      }
    } catch {
      toast.error('Error')
    }
  }

  const handleSaveAIConfig = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/chat-config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiForm) })
      if (res.ok) { toast.success(t.admin.saveAIConfig); void loadAdminData() }
    } catch { toast.error('Error') }
    finally { setLoading(false) }
  }

  const tabs = [
    { key: 'projects' as TabType, label: t.admin.projects, icon: Building2 },
    { key: 'publications' as TabType, label: 'Paginas/Menu', icon: FileText },
    { key: 'contacts' as TabType, label: t.admin.contacts, icon: Mail },
    ...(session.role === 'admin'
      ? [
          { key: 'site-config' as TabType, label: 'Sitio', icon: Globe },
          { key: 'ai-config' as TabType, label: t.admin.aiConfig, icon: Bot },
          { key: 'users' as TabType, label: 'Usuarios', icon: Users },
        ]
      : []),
  ]

  return (
    <>
      {!hideLauncher && (
        <button onClick={() => setIsOpen(true)} className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 w-11 h-11 sm:w-14 sm:h-14 bg-white text-zinc-900 rounded-full shadow-lg hover:bg-zinc-100 transition-all flex items-center justify-center border border-zinc-200" aria-label="Admin">
          <LockKeyhole className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={() => setIsOpen(false)}>
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25 }} className="absolute left-0 top-0 bottom-0 w-full max-w-md sm:max-w-2xl lg:max-w-4xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b">
                <div className="flex items-center gap-3">
                  <div>
                    <h1 className="text-lg font-light tracking-wide">{t.admin.title}</h1>
                    {session.authenticated && session.username && (
                      <p className="text-[11px] text-zinc-500">@{session.username} · {session.role}</p>
                    )}
                  </div>
                  {session.authenticated && (
                    <Button variant="outline" onClick={handleLogout} className="text-xs sm:text-sm">
                      <LogOut className="w-4 h-4 mr-1" />{authCopy.logout}
                    </Button>
                  )}
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>

              {session.checking ? (
                <div className="p-6 text-sm text-zinc-500">Verificando acceso...</div>
              ) : !session.configured ? (
                <div className="p-6">
                  <div className="border rounded-2xl p-5 bg-zinc-50">
                    <h2 className="text-base font-medium text-zinc-900">{authCopy.title}</h2>
                    <p className="text-sm text-zinc-600 mt-2">{authCopy.notConfigured}</p>
                  </div>
                </div>
              ) : !session.authenticated ? (
                <div className="p-6">
                  <div className="max-w-md border rounded-2xl p-5 bg-zinc-50 space-y-4">
                    <div className="space-y-2">
                      <h2 className="text-base font-medium text-zinc-900">{authCopy.title}</h2>
                      <p className="text-sm text-zinc-600">{authCopy.description}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-700 mb-1 block">{authCopy.username}</label>
                      <Input
                        value={adminUsername}
                        onChange={e => setAdminUsername(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && adminUsername.trim() && adminPassword.trim()) {
                            void handleLogin()
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-700 mb-1 block">{authCopy.password}</label>
                      <Input
                        type="password"
                        value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && adminUsername.trim() && adminPassword.trim()) {
                            void handleLogin()
                          }
                        }}
                      />
                    </div>
                    <Button onClick={() => void handleLogin()} disabled={!adminUsername.trim() || !adminPassword.trim() || authLoading} className="bg-zinc-900 hover:bg-zinc-800">
                      <LogIn className="w-4 h-4 mr-1" />{authLoading ? t.admin.saving : authCopy.login}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex border-b overflow-x-auto">
                    {tabs.map(tab => (
                      <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-1.5 px-4 sm:px-6 py-3 text-xs sm:text-sm whitespace-nowrap transition-colors ${activeTab === tab.key ? 'border-b-2 border-zinc-900 text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}>
                        <tab.icon className="w-4 h-4" />{tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Content */}
                  <ScrollArea className="h-[calc(100vh-130px)]">
                    <div className="p-4 sm:p-6">
                  {/* Projects */}
                  {activeTab === 'projects' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h2 className="text-base font-light">{t.admin.projects} ({projects.length})</h2>
                        <Button
                          onClick={() => {
                            setEditingProject(null)
                            setProjectForm({
                              ...emptyProjectForm,
                              category: projectCategoryOptions[0] || emptyProjectForm.category,
                            })
                            setShowProjectDialog(true)
                          }}
                          className="bg-zinc-900 hover:bg-zinc-800 text-xs sm:text-sm"
                        >
                          <Plus className="w-4 h-4 mr-1" />{t.admin.newProject}
                        </Button>
                      </div>
                      <div className="grid gap-3">
                        {projects.map(p => (
                          <div key={p.id} className="border rounded-lg p-3 sm:p-4 hover:border-zinc-300">
                            <div className="flex justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center flex-wrap gap-2">
                                  <h3 className="font-medium text-sm truncate">{p.title}</h3>
                                  <span className={`text-xs px-2 py-0.5 rounded ${p.published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {p.published ? t.admin.published : t.admin.draft}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-1 text-xs text-zinc-500">
                                  <span>{formatCategoryLabel(p.category)}</span>
                                  {p.location && <><span>•</span><span>{p.location}</span></>}
                                  {p.year && <><span>•</span><span>{p.year}</span></>}
                                  {p.videoUrl && <><span>•</span><span>Video</span></>}
                                </div>
                              </div>
                              <div className="flex gap-1 ml-2">
                                <button onClick={() => openEditProject(p)} className="p-1.5 hover:bg-zinc-100 rounded"><Pencil className="w-4 h-4 text-zinc-500" /></button>
                                <button onClick={() => handleDeleteProject(p.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {projects.length === 0 && <p className="text-center text-zinc-500 py-6 text-sm">{t.admin.noProjects}</p>}
                      </div>
                    </div>
                  )}

                  {/* Publications */}
                  {activeTab === 'publications' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h2 className="text-base font-light">Páginas y menú ({publications.length})</h2>
                        <Button onClick={() => { setEditingPublication(null); setPublicationForm(emptyPublicationForm); setShowPublicationDialog(true) }} className="bg-zinc-900 hover:bg-zinc-800 text-xs sm:text-sm"><Plus className="w-4 h-4 mr-1" />Nueva página</Button>
                      </div>
                      <div className="grid gap-3">
                        {publications.map(p => (
                          <div key={p.id} className="border rounded-lg p-3 sm:p-4 hover:border-zinc-300">
                            <div className="flex justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center flex-wrap gap-2">
                                  <h3 className="font-medium text-sm truncate">{p.title}</h3>
                                  <span className={`text-xs px-2 py-0.5 rounded ${p.published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.published ? t.admin.published : t.admin.draft}</span>
                                  {p.showInMenu && <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">Menú</span>}
                                </div>
                                <p className="text-xs text-zinc-400 mt-1 truncate">/info/{p.slug}</p>
                                <div className="flex flex-wrap gap-2 mt-1 text-xs text-zinc-500">
                                  <span>{p.category || 'informacion'}</span>
                                  {p.showInMenu && <><span>•</span><span>Orden {p.menuOrder ?? 0}</span></>}
                                </div>
                              </div>
                              <div className="flex gap-1 ml-2">
                                <button onClick={() => openEditPublication(p)} className="p-1.5 hover:bg-zinc-100 rounded"><Pencil className="w-4 h-4 text-zinc-500" /></button>
                                <button onClick={() => handleDeletePublication(p.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {publications.length === 0 && <p className="text-center text-zinc-500 py-6 text-sm">{t.admin.noPublications}</p>}
                      </div>
                    </div>
                  )}

                  {activeTab === 'site-config' && (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-base font-light">Configuracion del sitio</h2>
                          <p className="text-xs text-zinc-500 mt-1">Edita marca, SEO, contacto, redes, portada y categorias configurables.</p>
                        </div>
                        <Button onClick={handleSaveSiteConfig} disabled={loading} className="bg-zinc-900 hover:bg-zinc-800 text-xs sm:text-sm">
                          <Save className="w-4 h-4 mr-1" />
                          {loading ? t.admin.saving : 'Guardar sitio'}
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Nombre comercial</label>
                          <Input value={siteForm.companyName} onChange={e => setSiteForm({ ...siteForm, companyName: e.target.value })} className="text-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Razon social</label>
                          <Input value={siteForm.legalName} onChange={e => setSiteForm({ ...siteForm, legalName: e.target.value })} className="text-sm" />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-zinc-700 mb-1 block">Eslogan</label>
                        <Input value={siteForm.tagline} onChange={e => setSiteForm({ ...siteForm, tagline: e.target.value })} className="text-sm" />
                      </div>

                      <div className="rounded-xl border border-zinc-200 p-4 space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-zinc-900">SEO y redes sociales</h3>
                          <p className="text-xs text-zinc-500 mt-1">Estos campos controlan Google, Facebook, WhatsApp, LinkedIn y otros robots.</p>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">URL del sitio</label>
                          <Input value={siteForm.siteUrl} onChange={e => setSiteForm({ ...siteForm, siteUrl: e.target.value })} placeholder="https://tudominio.com" className="text-sm" />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Titulo SEO</label>
                          <Input value={siteForm.seoTitle} onChange={e => setSiteForm({ ...siteForm, seoTitle: e.target.value })} placeholder="SSA Ingenieria | Construccion, supervision y software para el sector" className="text-sm" />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Descripcion SEO</label>
                          <Textarea value={siteForm.seoDescription} onChange={e => setSiteForm({ ...siteForm, seoDescription: e.target.value })} rows={3} className="text-sm" />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Palabras clave SEO</label>
                          <Input value={siteForm.seoKeywords} onChange={e => setSiteForm({ ...siteForm, seoKeywords: e.target.value })} placeholder="ingenieria, construccion, supervision, arquitectura, software, ERP" className="text-sm" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-zinc-700 mb-1 block">Logo cabecera</label>
                            <label className="inline-flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                              {uploadingField === 'logoUrl' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              Subir imagen
                              <input type="file" accept="image/*" className="hidden" onChange={e => void handleSiteAssetUpload(e.target.files, 'logoUrl')} />
                            </label>
                          </div>
                          <Input value={siteForm.logoUrl} onChange={e => setSiteForm({ ...siteForm, logoUrl: e.target.value })} placeholder="/api/media/logo.png o https://..." className="text-sm" />
                        </div>
                        <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-zinc-700 mb-1 block">Favicon / icono</label>
                            <label className="inline-flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                              {uploadingField === 'faviconUrl' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              Subir icono
                              <input type="file" accept="image/*" className="hidden" onChange={e => void handleSiteAssetUpload(e.target.files, 'faviconUrl')} />
                            </label>
                          </div>
                          <Input value={siteForm.faviconUrl} onChange={e => setSiteForm({ ...siteForm, faviconUrl: e.target.value })} placeholder="/api/media/favicon.png o https://..." className="text-sm" />
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Imagen para compartir enlaces</label>
                          <label className="inline-flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                            {uploadingField === 'socialShareImageUrl' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Subir imagen
                            <input type="file" accept="image/*" className="hidden" onChange={e => void handleSiteAssetUpload(e.target.files, 'socialShareImageUrl')} />
                          </label>
                        </div>
                        <Input value={siteForm.socialShareImageUrl} onChange={e => setSiteForm({ ...siteForm, socialShareImageUrl: e.target.value })} placeholder="/api/media/seo-share.jpg o https://..." className="text-sm" />
                        <p className="text-xs text-zinc-500">Se usa al compartir el link en Facebook, WhatsApp, LinkedIn y otras plataformas. Recomendado: 1200 x 630 px.</p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-zinc-700 mb-1 block">Imagenes hero desktop</label>
                            <label className="inline-flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                            {uploadingField === 'heroImages' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              Subir medios
                              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => void handleSiteHeroUpload(e.target.files, 'heroImages')} />
                            </label>
                          </div>
                          <Textarea
                            value={siteForm.heroImages}
                            onChange={e => setSiteForm({ ...siteForm, heroImages: e.target.value })}
                            rows={5}
                            placeholder="Una URL por linea. Acepta imagenes o videos. Si esta vacio, se usan las imagenes principales de proyectos publicados."
                            className="text-sm"
                          />
                        </div>

                        <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-zinc-700 mb-1 block">Imagenes hero mobile</label>
                            <label className="inline-flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                            {uploadingField === 'heroImagesMobile' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              Subir medios
                              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => void handleSiteHeroUpload(e.target.files, 'heroImagesMobile')} />
                            </label>
                          </div>
                          <Textarea
                            value={siteForm.heroImagesMobile}
                            onChange={e => setSiteForm({ ...siteForm, heroImagesMobile: e.target.value })}
                            rows={5}
                            placeholder="Opcional. Acepta imagenes o videos. Si esta vacio, mobile reutiliza los medios desktop."
                            className="text-sm"
                          />
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                        <label className="text-xs font-medium text-zinc-700 mb-1 block">Categorias de proyectos</label>
                        <Textarea
                          value={siteForm.projectCategories}
                          onChange={e => setSiteForm({ ...siteForm, projectCategories: e.target.value })}
                          rows={4}
                          placeholder={'Una categoria por linea.\nConstruccion\nDiseno\nSupervision'}
                          className="text-sm"
                        />
                        <p className="text-xs text-zinc-500">Estas categorias aparecen en la pagina de proyectos y en el formulario de nuevo proyecto.</p>
                      </div>

                      <div className="rounded-xl border border-zinc-200 p-4 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-medium text-zinc-900">Vista previa del hero</h3>
                            <p className="text-xs text-zinc-500 mt-1">La home publica queda solo con imagen y menu.</p>
                          </div>
                          {!heroPreviewImage && !heroPreviewMobileImage ? <span className="text-xs text-zinc-500">Sube una imagen para ver la previsualizacion</span> : null}
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">Desktop</span>
                            <div className="rounded-[28px] border border-zinc-200 bg-zinc-100 p-3">
                              <div className="relative aspect-[16/9] overflow-hidden rounded-[22px] bg-zinc-100">
                                {heroPreviewImage ? (
                                  <>
                                    {isVideoUrl(heroPreviewImage) ? (
                                      <video
                                        src={heroPreviewImage}
                                        autoPlay
                                        muted
                                        loop
                                        playsInline
                                        className={`absolute inset-0 h-full w-full ${heroPreviewStyles.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
                                        style={{
                                          opacity: heroPreviewStyles.opacity,
                                          filter: heroPreviewStyles.filter,
                                        }}
                                      />
                                    ) : (
                                      <img
                                        src={heroPreviewImage}
                                        alt=""
                                        className={`absolute inset-0 h-full w-full ${heroPreviewStyles.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
                                        style={{
                                          opacity: heroPreviewStyles.opacity,
                                          filter: heroPreviewStyles.filter,
                                        }}
                                      />
                                    )}
                                    <div
                                      className="absolute inset-0"
                                      style={{ backgroundColor: `rgba(255,255,255,${heroPreviewStyles.overlayOpacity})` }}
                                    />
                                    <div className="absolute right-4 top-4 flex items-center gap-2">
                                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/16 text-white backdrop-blur-md">
                                        <Globe className="h-4 w-4" />
                                      </div>
                                      <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-black/16 px-3 py-2 text-[10px] uppercase tracking-[0.25em] text-white backdrop-blur-md">
                                        <span>Menu</span>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">Sin imagen</div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">Mobile</span>
                            <div className="max-w-[280px] rounded-[28px] border border-zinc-200 bg-zinc-100 p-3">
                              <div className="relative aspect-[9/16] overflow-hidden rounded-[22px] bg-zinc-100">
                                {heroPreviewMobileImage ? (
                                  <>
                                    {isVideoUrl(heroPreviewMobileImage) ? (
                                      <video
                                        src={heroPreviewMobileImage}
                                        autoPlay
                                        muted
                                        loop
                                        playsInline
                                        className={`absolute inset-0 h-full w-full ${heroPreviewStyles.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
                                        style={{
                                          opacity: heroPreviewStyles.opacity,
                                          filter: heroPreviewStyles.filter,
                                        }}
                                      />
                                    ) : (
                                      <img
                                        src={heroPreviewMobileImage}
                                        alt=""
                                        className={`absolute inset-0 h-full w-full ${heroPreviewStyles.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
                                        style={{
                                          opacity: heroPreviewStyles.opacity,
                                          filter: heroPreviewStyles.filter,
                                        }}
                                      />
                                    )}
                                    <div
                                      className="absolute inset-0"
                                      style={{ backgroundColor: `rgba(255,255,255,${heroPreviewStyles.overlayOpacity})` }}
                                    />
                                    <div className="absolute right-4 top-4 flex items-center gap-2">
                                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/16 text-white backdrop-blur-md">
                                        <Globe className="h-4 w-4" />
                                      </div>
                                      <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-black/16 px-3 py-2 text-[10px] uppercase tracking-[0.25em] text-white backdrop-blur-md">
                                        <span>Menu</span>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">Sin imagen</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-zinc-700 block">Opacidad del hero</label>
                            <span className="text-xs text-zinc-500">{siteForm.heroImageOpacity || '34'}%</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="70"
                            step="1"
                            value={siteForm.heroImageOpacity || '34'}
                            onChange={e => setSiteForm({ ...siteForm, heroImageOpacity: e.target.value })}
                            className="w-full accent-zinc-900"
                          />
                          <Input
                            type="number"
                            min="5"
                            max="70"
                            value={siteForm.heroImageOpacity}
                            onChange={e => setSiteForm({ ...siteForm, heroImageOpacity: e.target.value })}
                            className="text-sm"
                          />
                          <p className="text-xs text-zinc-500">Cuanta presencia tiene la imagen principal del carrusel.</p>
                        </div>

                        <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-zinc-700 block">Saturacion del hero</label>
                            <span className="text-xs text-zinc-500">{siteForm.heroImageSaturation || '90'}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="160"
                            step="5"
                            value={siteForm.heroImageSaturation || '90'}
                            onChange={e => setSiteForm({ ...siteForm, heroImageSaturation: e.target.value })}
                            className="w-full accent-zinc-900"
                          />
                          <Input
                            type="number"
                            min="0"
                            max="160"
                            step="5"
                            value={siteForm.heroImageSaturation}
                            onChange={e => setSiteForm({ ...siteForm, heroImageSaturation: e.target.value })}
                            className="text-sm"
                          />
                          <p className="text-xs text-zinc-500">0 deja el hero en blanco y negro. Valores altos recuperan mas color.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                          <label className="text-xs font-medium text-zinc-700 block">Modo de imagen</label>
                          <select
                            value={siteForm.heroImageTreatment}
                            onChange={e => setSiteForm({ ...siteForm, heroImageTreatment: e.target.value as SiteFormState['heroImageTreatment'] })}
                            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                          >
                            <option value="editorial">Editorial suave</option>
                            <option value="original">Original sin filtros</option>
                            <option value="enhanced">Mejorada</option>
                            <option value="monochrome">Blanco y negro</option>
                          </select>
                          <p className="text-xs text-zinc-500">Original deja la imagen casi intacta. Mejorada aumenta brillo y contraste.</p>
                        </div>

                        <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                          <label className="text-xs font-medium text-zinc-700 block">Encuadre de imagen</label>
                          <select
                            value={siteForm.heroImageFit}
                            onChange={e => setSiteForm({ ...siteForm, heroImageFit: e.target.value as SiteFormState['heroImageFit'] })}
                            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                          >
                            <option value="cover">Llenar pantalla</option>
                            <option value="contain">Mostrar imagen entera</option>
                          </select>
                          <p className="text-xs text-zinc-500">Usa “Mostrar imagen entera” para respetar el encuadre completo.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-zinc-700 block">Brillo del hero</label>
                            <span className="text-xs text-zinc-500">{siteForm.heroImageBrightness || '100'}%</span>
                          </div>
                          <input
                            type="range"
                            min="70"
                            max="150"
                            step="5"
                            value={siteForm.heroImageBrightness || '100'}
                            onChange={e => setSiteForm({ ...siteForm, heroImageBrightness: e.target.value })}
                            className="w-full accent-zinc-900"
                          />
                          <Input
                            type="number"
                            min="70"
                            max="150"
                            step="5"
                            value={siteForm.heroImageBrightness}
                            onChange={e => setSiteForm({ ...siteForm, heroImageBrightness: e.target.value })}
                            className="text-sm"
                          />
                        </div>

                        <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-zinc-700 block">Contraste del hero</label>
                            <span className="text-xs text-zinc-500">{siteForm.heroImageContrast || '105'}%</span>
                          </div>
                          <input
                            type="range"
                            min="80"
                            max="160"
                            step="5"
                            value={siteForm.heroImageContrast || '105'}
                            onChange={e => setSiteForm({ ...siteForm, heroImageContrast: e.target.value })}
                            className="w-full accent-zinc-900"
                          />
                          <Input
                            type="number"
                            min="80"
                            max="160"
                            step="5"
                            value={siteForm.heroImageContrast}
                            onChange={e => setSiteForm({ ...siteForm, heroImageContrast: e.target.value })}
                            className="text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                          <label className="text-xs font-medium text-zinc-700 block">Texto del hero</label>
                          <select
                            value={siteForm.heroTextTone}
                            onChange={e => setSiteForm({ ...siteForm, heroTextTone: e.target.value as SiteFormState['heroTextTone'] })}
                            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                          >
                            <option value="dark">Oscuro</option>
                            <option value="light">Claro</option>
                          </select>
                          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                            <input
                              type="checkbox"
                              checked={siteForm.heroShowCompanyName}
                              onChange={e => setSiteForm({ ...siteForm, heroShowCompanyName: e.target.checked })}
                              className="h-4 w-4 rounded border-zinc-300"
                            />
                            Mostrar nombre de empresa en el hero
                          </label>
                        </div>

                        <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                          <p className="text-xs text-zinc-700 font-medium">Comportamiento recomendado</p>
                          <p className="text-xs text-zinc-500">Para tu estilo actual usa: texto oscuro, modo mejorada u original y “mostrar imagen entera” si quieres respetar el encuadre.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Correo</label>
                          <Input value={siteForm.email} onChange={e => setSiteForm({ ...siteForm, email: e.target.value })} className="text-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Telefono</label>
                          <Input value={siteForm.phone} onChange={e => setSiteForm({ ...siteForm, phone: e.target.value })} className="text-sm" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">WhatsApp</label>
                          <Input value={siteForm.whatsapp} onChange={e => setSiteForm({ ...siteForm, whatsapp: e.target.value })} className="text-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Pie de pagina</label>
                          <Input value={siteForm.footerText} onChange={e => setSiteForm({ ...siteForm, footerText: e.target.value })} className="text-sm" />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-zinc-700 mb-1 block">Direccion</label>
                        <Input value={siteForm.addressLine} onChange={e => setSiteForm({ ...siteForm, addressLine: e.target.value })} className="text-sm" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Ciudad</label>
                          <Input value={siteForm.city} onChange={e => setSiteForm({ ...siteForm, city: e.target.value })} className="text-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Pais</label>
                          <Input value={siteForm.country} onChange={e => setSiteForm({ ...siteForm, country: e.target.value })} className="text-sm" />
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-200 p-4 space-y-4">
                        <h3 className="text-sm font-medium text-zinc-900">Redes sociales</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium text-zinc-700 mb-1 block">Instagram</label>
                            <Input value={siteForm.instagramUrl} onChange={e => setSiteForm({ ...siteForm, instagramUrl: e.target.value })} placeholder="https://instagram.com/..." className="text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-zinc-700 mb-1 block">Facebook</label>
                            <Input value={siteForm.facebookUrl} onChange={e => setSiteForm({ ...siteForm, facebookUrl: e.target.value })} placeholder="https://facebook.com/..." className="text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-zinc-700 mb-1 block">LinkedIn</label>
                            <Input value={siteForm.linkedinUrl} onChange={e => setSiteForm({ ...siteForm, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/..." className="text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-zinc-700 mb-1 block">YouTube</label>
                            <Input value={siteForm.youtubeUrl} onChange={e => setSiteForm({ ...siteForm, youtubeUrl: e.target.value })} placeholder="https://youtube.com/..." className="text-sm" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-xs font-medium text-zinc-700 mb-1 block">TikTok</label>
                            <Input value={siteForm.tiktokUrl} onChange={e => setSiteForm({ ...siteForm, tiktokUrl: e.target.value })} placeholder="https://tiktok.com/..." className="text-sm" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contacts */}
                  {activeTab === 'contacts' && (
                    <div className="space-y-4">
                      <h2 className="text-base font-light">{t.admin.contacts} ({contacts.length})</h2>
                      <div className="grid gap-3">
                        {contacts.map(c => (
                          <div key={c.id} className={`border rounded-lg p-3 sm:p-4 ${c.isRead ? 'border-zinc-200' : 'border-zinc-300 bg-zinc-50'}`}>
                            <div className="flex justify-between items-start mb-1">
                              <div>
                                <h3 className="font-medium text-sm">{c.name}</h3>
                                <p className="text-xs text-zinc-500">{c.email}</p>
                              </div>
                              <span className="text-xs text-zinc-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                            </div>
                            {c.phone && <p className="text-xs text-zinc-500 mb-1">Tel: {c.phone}</p>}
                            <p className="text-xs text-zinc-600">{c.message}</p>
                          </div>
                        ))}
                        {contacts.length === 0 && <p className="text-center text-zinc-500 py-6 text-sm">{t.admin.noContacts}</p>}
                      </div>
                    </div>
                  )}

                  {/* AI Config */}
                  {activeTab === 'ai-config' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <h2 className="text-base font-light">{t.admin.aiTitle}</h2>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${aiForm.enabled ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                          <Power className="w-3 h-3" />{aiForm.enabled ? t.admin.aiActive : t.admin.aiInactive}
                        </div>
                      </div>

                      {/* Enable Toggle */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-medium text-sm">{t.admin.enableAI}</h3>
                          <p className="text-xs text-zinc-500">{t.admin.enableAIDesc}</p>
                        </div>
                        <button onClick={() => setAiForm({ ...aiForm, enabled: !aiForm.enabled })} className={`w-11 h-6 rounded-full transition-colors ${aiForm.enabled ? 'bg-green-500' : 'bg-zinc-300'}`}>
                          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${aiForm.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>

                      {/* Provider Selection */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Proveedor IA</label>
                          <select value={aiForm.provider} onChange={e => setAiForm({ ...aiForm, provider: e.target.value, model: '' })} className="w-full h-9 px-3 border rounded-md text-sm">
                            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Modelo</label>
                          <select value={aiForm.model} onChange={e => setAiForm({ ...aiForm, model: e.target.value })} className="w-full h-9 px-3 border rounded-md text-sm">
                            <option value="">Default</option>
                            {providers.find(p => p.id === aiForm.provider)?.models.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">API Key</label>
                          <Input type="password" value={aiForm.apiKey} onChange={e => setAiForm({ ...aiForm, apiKey: e.target.value })} className="text-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Base URL opcional</label>
                          <Input value={aiForm.apiBaseUrl} onChange={e => setAiForm({ ...aiForm, apiBaseUrl: e.target.value })} placeholder="https://api.openai.com/v1" className="text-sm" />
                        </div>
                      </div>

                      {/* Company Info */}
                      <div>
                        <label className="text-xs font-medium text-zinc-700 mb-1 block">{t.admin.companyName}</label>
                        <Input value={aiForm.companyName} onChange={e => setAiForm({ ...aiForm, companyName: e.target.value })} placeholder="ESTUDIO" className="text-sm" />
                      </div>

                      {/* Language Tabs for Prompts */}
                      <div className="border rounded-lg overflow-hidden">
                        <div className="flex border-b bg-zinc-50">
                          {(['es', 'en', 'pt'] as const).map(lang => (
                            <button key={lang} onClick={() => setAiLangTab(lang)} className={`flex items-center gap-1 px-4 py-2 text-xs transition-colors ${aiLangTab === lang ? 'bg-white border-b-2 border-zinc-900' : 'text-zinc-500'}`}>
                              <Globe className="w-3 h-3" />{lang.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        
                        <div className="p-4 space-y-4">
                          {aiLangTab === 'es' && (
                            <>
                              <div>
                                <label className="text-xs font-medium text-zinc-700 mb-1 block">{t.admin.companyInfo}</label>
                                <Textarea value={aiForm.companyInfo} onChange={e => setAiForm({ ...aiForm, companyInfo: e.target.value })} placeholder={t.admin.companyInfoPlaceholder} rows={2} className="text-sm" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-zinc-700 mb-1 block">{t.admin.systemPrompt}</label>
                                <Textarea value={aiForm.systemPrompt} onChange={e => setAiForm({ ...aiForm, systemPrompt: e.target.value })} rows={6} className="text-sm font-mono" />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-xs font-medium text-zinc-700 mb-1 block">{t.admin.welcomeMsg}</label>
                                  <Input value={aiForm.welcomeMessage} onChange={e => setAiForm({ ...aiForm, welcomeMessage: e.target.value })} className="text-sm" />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-zinc-700 mb-1 block">{t.admin.fallbackMsg}</label>
                                  <Input value={aiForm.fallbackMessage} onChange={e => setAiForm({ ...aiForm, fallbackMessage: e.target.value })} className="text-sm" />
                                </div>
                              </div>
                            </>
                          )}
                          {aiLangTab === 'en' && (
                            <>
                              <div>
                                <label className="text-xs font-medium text-zinc-700 mb-1 block">Company Info (EN)</label>
                                <Textarea value={aiForm.companyInfoEn || ''} onChange={e => setAiForm({ ...aiForm, companyInfoEn: e.target.value })} rows={2} className="text-sm" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-zinc-700 mb-1 block">System Prompt (EN)</label>
                                <Textarea value={aiForm.systemPromptEn || ''} onChange={e => setAiForm({ ...aiForm, systemPromptEn: e.target.value })} rows={6} className="text-sm font-mono" />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-xs font-medium text-zinc-700 mb-1 block">Welcome (EN)</label>
                                  <Input value={aiForm.welcomeMessageEn || ''} onChange={e => setAiForm({ ...aiForm, welcomeMessageEn: e.target.value })} className="text-sm" />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-zinc-700 mb-1 block">Fallback (EN)</label>
                                  <Input value={aiForm.fallbackMessageEn || ''} onChange={e => setAiForm({ ...aiForm, fallbackMessageEn: e.target.value })} className="text-sm" />
                                </div>
                              </div>
                            </>
                          )}
                          {aiLangTab === 'pt' && (
                            <>
                              <div>
                                <label className="text-xs font-medium text-zinc-700 mb-1 block">Informações da Empresa (PT)</label>
                                <Textarea value={aiForm.companyInfoPt || ''} onChange={e => setAiForm({ ...aiForm, companyInfoPt: e.target.value })} rows={2} className="text-sm" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-zinc-700 mb-1 block">System Prompt (PT)</label>
                                <Textarea value={aiForm.systemPromptPt || ''} onChange={e => setAiForm({ ...aiForm, systemPromptPt: e.target.value })} rows={6} className="text-sm font-mono" />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-xs font-medium text-zinc-700 mb-1 block">Boas-vindas (PT)</label>
                                  <Input value={aiForm.welcomeMessagePt || ''} onChange={e => setAiForm({ ...aiForm, welcomeMessagePt: e.target.value })} className="text-sm" />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-zinc-700 mb-1 block">Fallback (PT)</label>
                                  <Input value={aiForm.fallbackMessagePt || ''} onChange={e => setAiForm({ ...aiForm, fallbackMessagePt: e.target.value })} className="text-sm" />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Temperature & Tokens */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Temperatura: {aiForm.temperature}</label>
                          <input type="range" min="0" max="1" step="0.1" value={aiForm.temperature} onChange={e => setAiForm({ ...aiForm, temperature: parseFloat(e.target.value) })} className="w-full" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-zinc-700 mb-1 block">Max Tokens</label>
                          <Input type="number" value={aiForm.maxTokens} onChange={e => setAiForm({ ...aiForm, maxTokens: parseInt(e.target.value) || 1000 })} className="text-sm" />
                        </div>
                      </div>

                      <Button onClick={handleSaveAIConfig} disabled={loading || !aiForm.systemPrompt} className="w-full bg-zinc-900 hover:bg-zinc-800 py-5 text-xs tracking-widest">
                        <Save className="w-4 h-4 mr-2" />{loading ? t.admin.saving : t.admin.saveAIConfig}
                      </Button>
                    </div>
                  )}

                  {activeTab === 'users' && (
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-base font-light">Usuarios del panel</h2>
                        <p className="text-xs text-zinc-500 mt-1">Crea usuarios editores o administradores. La cuenta raíz sigue siendo `admin` con la contraseña configurada en Easypanel.</p>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 p-4 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-medium text-zinc-900">{editingUser ? 'Editar usuario' : 'Nuevo usuario'}</h3>
                          {editingUser && (
                            <Button
                              variant="outline"
                              className="text-xs"
                              onClick={() => {
                                setEditingUser(null)
                                setUserForm(emptyUserForm)
                              }}
                            >
                              Cancelar edición
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium text-zinc-700 mb-1 block">Usuario</label>
                            <Input value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} className="text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-zinc-700 mb-1 block">Nombre visible</label>
                            <Input value={userForm.displayName} onChange={e => setUserForm({ ...userForm, displayName: e.target.value })} className="text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-zinc-700 mb-1 block">Contraseña</label>
                            <Input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className="text-sm" />
                            {editingUser && <p className="text-[11px] text-zinc-500 mt-1">Déjala vacía si no quieres cambiarla.</p>}
                          </div>
                          <div>
                            <label className="text-xs font-medium text-zinc-700 mb-1 block">Rol</label>
                            <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'editor' })} className="w-full h-9 px-3 border rounded-md text-sm">
                              <option value="editor">Editor</option>
                              <option value="admin">Administrador</option>
                            </select>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-zinc-700">
                          <input type="checkbox" checked={userForm.active} onChange={e => setUserForm({ ...userForm, active: e.target.checked })} />
                          Usuario activo
                        </label>
                        <Button onClick={handleSaveUser} disabled={loading || !userForm.username.trim() || (!editingUser && userForm.password.trim().length < 6)} className="bg-zinc-900 hover:bg-zinc-800 text-sm">
                          <Save className="w-4 h-4 mr-1" />
                          {loading ? t.admin.saving : editingUser ? 'Actualizar usuario' : 'Crear usuario'}
                        </Button>
                      </div>

                      <div className="grid gap-3">
                        {users.map(user => (
                          <div key={user.id} className="border rounded-lg p-3 sm:p-4 hover:border-zinc-300">
                            <div className="flex justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center flex-wrap gap-2">
                                  <h3 className="font-medium text-sm truncate">{user.displayName || user.username}</h3>
                                  <span className={`text-xs px-2 py-0.5 rounded ${user.role === 'admin' ? 'bg-zinc-900 text-white' : 'bg-blue-100 text-blue-700'}`}>{user.role}</span>
                                  {!user.active && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">inactivo</span>}
                                </div>
                                <p className="text-xs text-zinc-500 mt-1">@{user.username}</p>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => {
                                    setEditingUser(user)
                                    setUserForm({
                                      username: user.username,
                                      displayName: user.displayName || '',
                                      password: '',
                                      role: user.role,
                                      active: user.active,
                                    })
                                  }}
                                  className="p-1.5 hover:bg-zinc-100 rounded"
                                >
                                  <Pencil className="w-4 h-4 text-zinc-500" />
                                </button>
                                <button onClick={() => void handleDeleteUser(user.id)} className="p-1.5 hover:bg-red-50 rounded">
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {users.length === 0 && <p className="text-center text-zinc-500 py-6 text-sm">No hay usuarios adicionales creados.</p>}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Dialog */}
      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent className="max-w-md sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingProject ? t.admin.editProject : t.admin.newProject}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1 block">Título *</label>
              <Input value={projectForm.title} onChange={e => setProjectForm({ ...projectForm, title: e.target.value })} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Categoría</label>
                <select value={projectForm.category} onChange={e => setProjectForm({ ...projectForm, category: e.target.value })} className="w-full h-9 px-3 border rounded-md text-sm">
                  <option value="residencial">Residencial</option>
                  <option value="comercial">Comercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="renovacion">Renovación</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Año</label>
                <Input value={projectForm.year} onChange={e => setProjectForm({ ...projectForm, year: e.target.value })} type="number" className="text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Ubicación</label>
                <Input value={projectForm.location} onChange={e => setProjectForm({ ...projectForm, location: e.target.value })} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Área</label>
                <Input value={projectForm.area} onChange={e => setProjectForm({ ...projectForm, area: e.target.value })} placeholder="320 m²" className="text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Cliente</label>
                <Input value={projectForm.client} onChange={e => setProjectForm({ ...projectForm, client: e.target.value })} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Estado</label>
                <select value={projectForm.status} onChange={e => setProjectForm({ ...projectForm, status: e.target.value })} className="w-full h-9 px-3 border rounded-md text-sm">
                  <option value="completed">Completado</option>
                  <option value="in-progress">En ejecucion</option>
                  <option value="concept">Concepto</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1 block">Descripción</label>
              <Textarea value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} rows={2} className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1 block">Descripcion completa</label>
              <Textarea value={projectForm.fullDescription} onChange={e => setProjectForm({ ...projectForm, fullDescription: e.target.value })} rows={5} className="text-sm" />
            </div>
            <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Categoria personalizada</label>
                <Input value={projectForm.category} onChange={e => setProjectForm({ ...projectForm, category: e.target.value })} className="text-sm" />
              </div>
              {projectCategoryOptions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {projectCategoryOptions.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setProjectForm({ ...projectForm, category })}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        projectForm.category === category
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900'
                      }`}
                    >
                      {formatCategoryLabel(category)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium text-zinc-700 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Imagen principal</label>
                <label className="inline-flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                  {uploadingField === 'mainImage' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Subir imagen
                  <input type="file" accept="image/*" className="hidden" onChange={e => void handleProjectUpload(e.target.files, 'mainImage')} />
                </label>
              </div>
              <Input value={projectForm.mainImage} onChange={e => setProjectForm({ ...projectForm, mainImage: e.target.value })} placeholder="/api/media/archivo.jpg o https://..." className="text-sm" />
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium text-zinc-700 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Galeria</label>
                <label className="inline-flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                  {uploadingField === 'gallery' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Subir varias imagenes
                  <input type="file" accept="image/*" multiple className="hidden" onChange={e => void handleProjectUpload(e.target.files, 'gallery')} />
                </label>
              </div>
              <Textarea value={projectForm.gallery} onChange={e => setProjectForm({ ...projectForm, gallery: e.target.value })} rows={4} placeholder="Una URL por linea" className="text-sm" />
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium text-zinc-700 flex items-center gap-1"><Video className="w-3 h-3" /> Video del proyecto</label>
                <label className="inline-flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                  {uploadingField === 'videoUrl' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Subir video
                  <input type="file" accept="video/*" className="hidden" onChange={e => void handleProjectUpload(e.target.files, 'videoUrl')} />
                </label>
              </div>
              <Input value={projectForm.videoUrl} onChange={e => setProjectForm({ ...projectForm, videoUrl: e.target.value })} placeholder="/api/media/archivo.mp4 o https://..." className="text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={projectForm.featured} onChange={e => setProjectForm({ ...projectForm, featured: e.target.checked })} />
              Mostrar como destacado
            </label>
            <div className="text-xs text-zinc-500">
              Estado de publicacion actual: <span className="font-medium text-zinc-700">{projectForm.published ? 'Publicado' : 'Borrador'}</span>
            </div>
            <p className="text-xs text-zinc-500">Puedes pegar URLs externas o subir archivos. Las subidas quedan guardadas en el volumen del servidor.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProjectDialog(false)} className="text-sm">{t.admin.cancel}</Button>
            <Button onClick={() => void handleSaveProject(false)} disabled={!projectForm.title || loading || Boolean(uploadingField)} variant="outline" className="text-sm"><Save className="w-4 h-4 mr-1" />{loading ? t.admin.saving : 'Guardar borrador'}</Button>
            <Button onClick={() => void handleSaveProject(true)} disabled={!projectForm.title || loading || Boolean(uploadingField)} className="bg-zinc-900 hover:bg-zinc-800 text-sm"><Save className="w-4 h-4 mr-1" />{loading ? t.admin.saving : 'Guardar y publicar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publication Dialog */}
      <Dialog open={showPublicationDialog} onOpenChange={setShowPublicationDialog}>
        <DialogContent className="max-w-md sm:max-w-xl">
          <DialogHeader><DialogTitle>{editingPublication ? 'Editar pagina' : 'Nueva pagina'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1 block">Título *</label>
              <Input value={publicationForm.title} onChange={e => setPublicationForm({ ...publicationForm, title: e.target.value, slug: buildSlug(e.target.value) })} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Slug</label>
                <Input value={publicationForm.slug} onChange={e => setPublicationForm({ ...publicationForm, slug: buildSlug(e.target.value) })} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Tipo</label>
                <select value={publicationForm.category} onChange={e => setPublicationForm({ ...publicationForm, category: e.target.value })} className="w-full h-9 px-3 border rounded-md text-sm">
                  <option value="informacion">Informacion</option>
                  <option value="noticias">Noticias</option>
                  <option value="servicio">Servicio</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1 block">Resumen</label>
              <Textarea value={publicationForm.excerpt} onChange={e => setPublicationForm({ ...publicationForm, excerpt: e.target.value })} rows={2} className="text-sm" />
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Imagen</label>
                <label className="inline-flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
                  {uploadingField === 'publicationImage' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Subir imagen
                  <input type="file" accept="image/*" className="hidden" onChange={e => void handlePublicationImageUpload(e.target.files)} />
                </label>
              </div>
              <Input value={publicationForm.image} onChange={e => setPublicationForm({ ...publicationForm, image: e.target.value })} className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1 block">Contenido</label>
              <Textarea value={publicationForm.content} onChange={e => setPublicationForm({ ...publicationForm, content: e.target.value })} rows={7} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" checked={publicationForm.showInMenu} onChange={e => setPublicationForm({ ...publicationForm, showInMenu: e.target.checked })} />
                Mostrar en menu
              </label>
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Orden en menu</label>
                <Input value={publicationForm.menuOrder} onChange={e => setPublicationForm({ ...publicationForm, menuOrder: e.target.value })} type="number" className="text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublicationDialog(false)} className="text-sm">{t.admin.cancel}</Button>
            <Button onClick={handleSavePublication} disabled={!publicationForm.title || loading || Boolean(uploadingField)} className="bg-zinc-900 hover:bg-zinc-800 text-sm"><Save className="w-4 h-4 mr-1" />{loading ? t.admin.saving : 'Guardar pagina'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
