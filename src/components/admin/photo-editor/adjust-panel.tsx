'use client'

import { RotateCcw, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ADJUSTMENT_FIELDS } from './editor-state'
import type { Adjustments } from './image-pipeline'

type AdjustPanelProps = {
  adjustments: Adjustments
  onChange: (key: keyof Adjustments, value: number) => void
  onCommit: () => void
  onReset: (key: keyof Adjustments) => void
  onAuto: () => void
  autoDisabled?: boolean
}

export function AdjustPanel({ adjustments, onChange, onCommit, onReset, onAuto, autoDisabled }: AdjustPanelProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
        <Button type="button" onClick={onAuto} disabled={autoDisabled} className="w-full bg-sky-600 text-white hover:bg-sky-700">
          <Wand2 aria-hidden /> Auto‑mejorar
        </Button>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
          Analiza la luz y el color de la foto y mueve los deslizadores. Verás exactamente qué valores cambia.
        </p>
      </div>

      <ul className="space-y-4">
        {ADJUSTMENT_FIELDS.map((field) => {
          const value = adjustments[field.key]
          const id = `adjust-${field.key}`

          return (
            <li key={field.key} onDoubleClick={() => onReset(field.key)}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor={id} className="text-sm font-medium text-zinc-800">
                  {field.label}
                </label>
                <div className="flex items-center gap-1">
                  <span
                    className={`min-w-10 rounded-md px-1.5 py-0.5 text-right text-xs tabular-nums ${
                      value === 0 ? 'text-zinc-400' : 'bg-sky-50 font-medium text-sky-700'
                    }`}
                  >
                    {value > 0 ? `+${value}` : value}
                  </span>
                  <button
                    type="button"
                    onClick={() => onReset(field.key)}
                    disabled={value === 0}
                    aria-label={`Restablecer ${field.label}`}
                    className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none disabled:invisible"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                  </button>
                </div>
              </div>
              <Slider
                id={id}
                aria-label={field.label}
                min={field.min}
                max={field.max}
                step={1}
                value={[value]}
                onValueChange={([next]) => onChange(field.key, next)}
                onValueCommit={onCommit}
                className="[&_[data-slot=slider-range]]:bg-sky-600 [&_[data-slot=slider-thumb]]:border-sky-600"
              />
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-zinc-500">Doble clic sobre un ajuste para devolverlo a 0.</p>
    </div>
  )
}
