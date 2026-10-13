'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, ExternalLink, KeyRound, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

const IMAGE_MODELS = [
  { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image — rápido y económico' },
  { id: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image (preview)' },
  { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (preview) — máxima calidad' },
]

type ChatConfigResponse = {
  imageApiKey: string | null
  imageModel: string | null
  automationApiKey: string | null
  automationProvider: string | null
}

export function IntegrationsSettings() {
  const [loaded, setLoaded] = useState(false)
  const [currentKey, setCurrentKey] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(IMAGE_MODELS[0].id)
  const [customModel, setCustomModel] = useState('')
  const [useForText, setUseForText] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    fetch('/api/chat-config', { cache: 'no-store' })
      .then((response) => response.json() as Promise<ChatConfigResponse>)
      .then((config) => {
        setCurrentKey(config.imageApiKey)
        const configuredModel = config.imageModel || IMAGE_MODELS[0].id

        if (IMAGE_MODELS.some((item) => item.id === configuredModel)) {
          setModel(configuredModel)
        } else {
          setModel('custom')
          setCustomModel(configuredModel)
        }
      })
      .catch(() => toast.error('No se pudo cargar la configuración.'))
      .finally(() => setLoaded(true))
  }, [])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)

    const resolvedModel = model === 'custom' ? customModel.trim() : model
    const body: Record<string, unknown> = { imageProvider: 'google', imageModel: resolvedModel }

    if (apiKey.trim()) {
      body.imageApiKey = apiKey.trim()

      if (useForText) {
        body.automationProvider = 'google'
        body.automationApiKey = apiKey.trim()
        body.automationModel = 'gemini-2.5-flash'
      }
    }

    try {
      const response = await fetch('/api/chat-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar.')
      }

      setCurrentKey(data.imageApiKey ?? null)
      setApiKey('')
      toast.success('Integración guardada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)

    try {
      const response = await fetch('/api/admin/integrations/gemini-test', { method: 'POST' })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'La prueba falló.')
      }

      toast.success(`Conexión correcta con ${data.displayName}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'La prueba falló.')
    } finally {
      setTesting(false)
    }
  }

  if (!loaded) {
    return <div className="h-64 animate-pulse rounded-2xl bg-zinc-200/60" aria-busy />
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <form onSubmit={handleSave} className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-sky-50 p-2.5 text-sky-600">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold">Google AI Studio (Gemini)</h2>
            <p className="text-sm text-zinc-500">Mejora fotos con IA desde el editor y redacta textos de publicaciones.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gemini-key">Clave de API</Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <Input
              id="gemini-key"
              type="password"
              autoComplete="off"
              className="pl-9"
              placeholder={currentKey ? `Guardada (${currentKey}) — escribe para reemplazar` : 'AIza…'}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {currentKey ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Clave guardada. Nunca se muestra completa.
              </span>
            ) : (
              'Créala gratis en Google AI Studio → Get API key.'
            )}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gemini-model">Modelo para editar imágenes</Label>
          <select
            id="gemini-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {IMAGE_MODELS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
            <option value="custom">Otro (escribir nombre del modelo)</option>
          </select>
          {model === 'custom' ? (
            <Input aria-label="Nombre del modelo" placeholder="gemini-…" value={customModel} onChange={(event) => setCustomModel(event.target.value)} />
          ) : null}
        </div>

        <label className="flex items-center justify-between gap-4 rounded-xl border border-zinc-100 p-3">
          <span>
            <span className="block text-sm font-medium">Usar la misma clave para textos</span>
            <span className="block text-xs text-zinc-500">Resúmenes, SEO y traducciones de publicaciones con Gemini.</span>
          </span>
          <Switch checked={useForText} onCheckedChange={setUseForText} aria-label="Usar la misma clave para textos" />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="bg-sky-600 hover:bg-sky-700" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Guardar
          </Button>
          <Button type="button" variant="outline" onClick={handleTest} disabled={testing || (!currentKey && !apiKey)}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Probar conexión
          </Button>
        </div>
      </form>

      <aside className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        <h2 className="font-semibold text-zinc-900">Cómo obtener la clave</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Entra a Google AI Studio con tu cuenta de Google.</li>
          <li>
            Pulsa <strong>Get API key</strong> → <strong>Create API key</strong>.
          </li>
          <li>Copia la clave y pégala aquí. Se guarda cifrada en reposo en Cloudflare D1 y nunca vuelve al navegador.</li>
        </ol>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
        >
          Abrir Google AI Studio <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
        <p className="border-t border-zinc-100 pt-4 text-xs">
          Instagram y Facebook se conectan en <strong>Redes sociales</strong>. Telegram, chat y backups siguen en{' '}
          <strong>Proyectos y ajustes</strong>.
        </p>
      </aside>
    </div>
  )
}
