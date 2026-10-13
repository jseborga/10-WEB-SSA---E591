'use client'

import type { FormEvent } from 'react'
import { Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AI_IMAGE_PRESETS } from '@/lib/ai-image-presets'

type AiPanelProps = {
  preset: string | null
  prompt: string
  loading: boolean
  error: string | null
  hasLocalEdits: boolean
  onPreset: (preset: string | null) => void
  onPrompt: (prompt: string) => void
  onGenerate: () => void
}

export function AiPanel({ preset, prompt, loading, error, hasLocalEdits, onPreset, onPrompt, onGenerate }: AiPanelProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!loading) onGenerate()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        El original nunca se modifica: el resultado de Gemini se guarda como una versión nueva.
      </p>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-zinc-800">¿Qué quieres mejorar?</legend>
        <div className="grid grid-cols-2 gap-2">
          {AI_IMAGE_PRESETS.map((item) => {
            const selected = preset === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onPreset(selected ? null : item.id)}
                className={`rounded-xl border p-2.5 text-left transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none ${
                  selected ? 'border-sky-600 bg-sky-50' : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <span className="block text-sm font-semibold text-zinc-900">{item.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">{item.description}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="ai-prompt" className="mb-2 block text-sm font-medium text-zinc-800">
          Describe el cambio <span className="font-normal text-zinc-500">(opcional)</span>
        </label>
        <Textarea
          id="ai-prompt"
          value={prompt}
          onChange={(event) => onPrompt(event.target.value)}
          placeholder="Ej.: quita la grúa del fondo y aclara la fachada"
          maxLength={1000}
          rows={3}
        />
      </div>

      {hasLocalEdits ? (
        <p className="text-xs leading-relaxed text-amber-700">
          Gemini trabaja sobre la foto guardada; tus recortes y ajustes sin guardar no se envían.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={loading || (!preset && !prompt.trim())}
        className="w-full bg-sky-600 text-white hover:bg-sky-700"
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
        {loading ? 'Generando…' : 'Generar con Gemini'}
      </Button>
    </form>
  )
}
