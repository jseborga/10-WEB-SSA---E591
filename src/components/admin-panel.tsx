'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Pencil, Trash2, Building2, FileText, Mail, Bot, Save, Image as ImageIcon, Power, Globe, LockKeyhole, LogIn, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/language-context'

interface Project {
  id: string; title: string; description: string | null; category: string
  location: string | null; year: number | null; area: string | null; images: string | null; mainImage?: string | null; createdAt: string
}

interface Publication {
  id: string; title: string; slug: string; excerpt: string | null
  content: string | null; image?: string | null; published: boolean; category: string | null; createdAt: string
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

type TabType = 'projects' | 'publications' | 'contacts' | 'ai-config'
type SessionState = { checking: boolean; configured: boolean; authenticated: boolean }

const providers = [
  { id: 'default', name: 'Z-AI (Default)', models: ['default'] },
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'openai-compatible', name: 'OpenAI Compatible', models: ['custom-model'] },
  { id: 'google', name: 'Google AI', models: ['gemini-pro', 'gemini-1.5-pro'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] }
]

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
  const [chatConfig, setChatConfig] = useState<ChatConfigType | null>(null)
  const [loading, setLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [aiLangTab, setAiLangTab] = useState<'es' | 'en' | 'pt'>('es')
  const [session, setSession] = useState<SessionState>({ checking: false, configured: false, authenticated: false })
  const [adminPassword, setAdminPassword] = useState('')

  const [projectForm, setProjectForm] = useState({ title: '', description: '', category: 'residencial', location: '', year: '', area: '', images: '' })
  const [publicationForm, setPublicationForm] = useState({ title: '', slug: '', excerpt: '', content: '', image: '', category: 'noticias' })
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
  const [showProjectDialog, setShowProjectDialog] = useState(false)
  const [showPublicationDialog, setShowPublicationDialog] = useState(false)

  const authCopy = useMemo(() => {
    if (language === 'en') {
      return {
        title: 'Admin access',
        description: 'Enter the configured password to unlock the panel.',
        notConfigured: 'Admin is disabled. Define ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Easypanel.',
        password: 'Password',
        login: 'Unlock',
        logout: 'Logout',
        invalid: 'Invalid credentials',
      }
    }

    if (language === 'pt') {
      return {
        title: 'Acesso admin',
        description: 'Digite a senha configurada para liberar o painel.',
        notConfigured: 'O admin está desativado. Defina ADMIN_PASSWORD e ADMIN_SESSION_SECRET no Easypanel.',
        password: 'Senha',
        login: 'Entrar',
        logout: 'Sair',
        invalid: 'Credenciais inválidas',
      }
    }

    return {
      title: 'Acceso admin',
      description: 'Ingresa la contraseña configurada para liberar el panel.',
      notConfigured: 'El admin está desactivado. Define ADMIN_PASSWORD y ADMIN_SESSION_SECRET en Easypanel.',
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
      })
    } catch {
      setSession({ checking: false, configured: false, authenticated: false })
    }
  }

  const loadAdminData = async () => {
    try {
      const [projectsRes, publicationsRes, contactsRes, configRes] = await Promise.all([
        fetch('/api/projects', { cache: 'no-store' }),
        fetch('/api/publications', { cache: 'no-store' }),
        fetch('/api/contact', { cache: 'no-store' }),
        fetch('/api/chat-config', { cache: 'no-store' }),
      ])

      if ([projectsRes, publicationsRes, contactsRes, configRes].some(response => response.status === 401)) {
        setSession(current => ({ ...current, authenticated: false }))
        return
      }

      const [projectsData, publicationsData, contactsData, configData] = await Promise.all([
        projectsRes.json(),
        publicationsRes.json(),
        contactsRes.json(),
        configRes.json(),
      ])

      setProjects(Array.isArray(projectsData) ? projectsData : [])
      setPublications(Array.isArray(publicationsData) ? publicationsData : [])
      setContacts(Array.isArray(contactsData) ? contactsData : [])
      setChatConfig(configData)
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
  }, [isOpen, session.authenticated])

  const handleLogin = async () => {
    setAuthLoading(true)

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        toast.error(data.error || authCopy.invalid)
        return
      }

      setAdminPassword('')
      setSession(current => ({ ...current, authenticated: true }))
    } catch {
      toast.error(authCopy.invalid)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {})
    setSession(current => ({ ...current, authenticated: false }))
  }

  const handleSaveProject = async () => {
    setLoading(true)
    try {
      const url = editingProject ? `/api/projects/${editingProject.id}` : '/api/projects'
      const method = editingProject ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...projectForm, year: projectForm.year ? parseInt(projectForm.year) : null })
      })
      if (res.ok) {
        toast.success(editingProject ? 'Proyecto actualizado' : 'Proyecto creado')
        setShowProjectDialog(false); setEditingProject(null)
        setProjectForm({ title: '', description: '', category: 'residencial', location: '', year: '', area: '', images: '' })
        void loadAdminData()
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
    setProjectForm({ title: project.title, description: project.description || '', category: project.category, location: project.location || '', year: project.year?.toString() || '', area: project.area || '', images: project.mainImage || project.images || '' })
    setShowProjectDialog(true)
  }

  const handleSavePublication = async () => {
    setLoading(true)
    try {
      const url = editingPublication ? `/api/publications/${editingPublication.id}` : '/api/publications'
      const method = editingPublication ? 'PUT' : 'POST'
      const slug = publicationForm.slug || publicationForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...publicationForm, slug, published: true }) })
      if (res.ok) {
        toast.success(editingPublication ? 'Actualizado' : 'Publicado')
        setShowPublicationDialog(false); setEditingPublication(null)
        setPublicationForm({ title: '', slug: '', excerpt: '', content: '', image: '', category: 'noticias' })
        void loadAdminData()
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
    setPublicationForm({ title: pub.title, slug: pub.slug, excerpt: pub.excerpt || '', content: pub.content || '', image: pub.image || '', category: pub.category || 'noticias' })
    setShowPublicationDialog(true)
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
    { key: 'publications' as TabType, label: t.admin.publications, icon: FileText },
    { key: 'contacts' as TabType, label: t.admin.contacts, icon: Mail },
    { key: 'ai-config' as TabType, label: t.admin.aiConfig, icon: Bot }
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
                  <h1 className="text-lg font-light tracking-wide">{t.admin.title}</h1>
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
                      <label className="text-xs font-medium text-zinc-700 mb-1 block">{authCopy.password}</label>
                      <Input
                        type="password"
                        value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && adminPassword.trim()) {
                            void handleLogin()
                          }
                        }}
                      />
                    </div>
                    <Button onClick={() => void handleLogin()} disabled={!adminPassword.trim() || authLoading} className="bg-zinc-900 hover:bg-zinc-800">
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
                        <Button onClick={() => { setEditingProject(null); setProjectForm({ title: '', description: '', category: 'residencial', location: '', year: '', area: '', images: '' }); setShowProjectDialog(true) }} className="bg-zinc-900 hover:bg-zinc-800 text-xs sm:text-sm"><Plus className="w-4 h-4 mr-1" />{t.admin.newProject}</Button>
                      </div>
                      <div className="grid gap-3">
                        {projects.map(p => (
                          <div key={p.id} className="border rounded-lg p-3 sm:p-4 hover:border-zinc-300">
                            <div className="flex justify-between">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-sm truncate">{p.title}</h3>
                                <div className="flex flex-wrap gap-2 mt-1 text-xs text-zinc-500">
                                  <span>{p.category}</span>
                                  {p.location && <><span>•</span><span>{p.location}</span></>}
                                  {p.year && <><span>•</span><span>{p.year}</span></>}
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
                        <h2 className="text-base font-light">{t.admin.publications} ({publications.length})</h2>
                        <Button onClick={() => { setEditingPublication(null); setPublicationForm({ title: '', slug: '', excerpt: '', content: '', image: '', category: 'noticias' }); setShowPublicationDialog(true) }} className="bg-zinc-900 hover:bg-zinc-800 text-xs sm:text-sm"><Plus className="w-4 h-4 mr-1" />{t.admin.newPublication}</Button>
                      </div>
                      <div className="grid gap-3">
                        {publications.map(p => (
                          <div key={p.id} className="border rounded-lg p-3 sm:p-4 hover:border-zinc-300">
                            <div className="flex justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium text-sm truncate">{p.title}</h3>
                                  <span className={`text-xs px-2 py-0.5 rounded ${p.published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.published ? t.admin.published : t.admin.draft}</span>
                                </div>
                                <p className="text-xs text-zinc-400 mt-1 truncate">/{p.slug}</p>
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
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingProject ? t.admin.editProject : t.admin.newProject}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-4">
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
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1 block">Descripción</label>
              <Textarea value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} rows={2} className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1 block flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Imagen URL</label>
              <Input value={projectForm.images} onChange={e => setProjectForm({ ...projectForm, images: e.target.value })} placeholder="/images/projects/..." className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProjectDialog(false)} className="text-sm">{t.admin.cancel}</Button>
            <Button onClick={handleSaveProject} disabled={!projectForm.title || loading} className="bg-zinc-900 hover:bg-zinc-800 text-sm"><Save className="w-4 h-4 mr-1" />{loading ? t.admin.saving : t.admin.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publication Dialog */}
      <Dialog open={showPublicationDialog} onOpenChange={setShowPublicationDialog}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingPublication ? t.admin.editPublication : t.admin.newPublication}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1 block">Título *</label>
              <Input value={publicationForm.title} onChange={e => setPublicationForm({ ...publicationForm, title: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') })} className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1 block">Slug</label>
              <Input value={publicationForm.slug} onChange={e => setPublicationForm({ ...publicationForm, slug: e.target.value })} className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1 block">Resumen</label>
              <Textarea value={publicationForm.excerpt} onChange={e => setPublicationForm({ ...publicationForm, excerpt: e.target.value })} rows={2} className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1 block">Imagen</label>
              <Input value={publicationForm.image} onChange={e => setPublicationForm({ ...publicationForm, image: e.target.value })} className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1 block">Contenido</label>
              <Textarea value={publicationForm.content} onChange={e => setPublicationForm({ ...publicationForm, content: e.target.value })} rows={4} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublicationDialog(false)} className="text-sm">{t.admin.cancel}</Button>
            <Button onClick={handleSavePublication} disabled={!publicationForm.title || loading} className="bg-zinc-900 hover:bg-zinc-800 text-sm"><Save className="w-4 h-4 mr-1" />{loading ? t.admin.saving : t.admin.publish}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
