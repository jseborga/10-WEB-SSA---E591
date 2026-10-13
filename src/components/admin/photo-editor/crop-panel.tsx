'use client'

import { FlipHorizontal2, RotateCcw, RotateCw, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ASPECTS, type AspectId } from './editor-state'

type CropPanelProps = {
  aspect: AspectId
  onAspect: (aspect: AspectId) => void
  onRotate: (direction: 1 | -1) => void
  onFlip: () => void
  onReset: () => void
}

export function CropPanel({ aspect, onAspect, onRotate, onFlip, onReset }: CropPanelProps) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-zinc-800">Proporción</legend>
        <div className="grid grid-cols-3 gap-2">
          {ASPECTS.map((item) => {
            const selected = item.id === aspect
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onAspect(item.id)}
                className={`rounded-xl border px-2 py-2 text-center transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none ${
                  selected ? 'border-sky-600 bg-sky-50 text-sky-800' : 'border-zinc-200 text-zinc-700 hover:border-zinc-300'
                }`}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="block text-[11px] text-zinc-500">{item.hint}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-800">Girar y voltear</p>
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" onClick={() => onRotate(-1)} aria-label="Girar 90° a la izquierda">
            <RotateCcw aria-hidden /> 90°
          </Button>
          <Button type="button" variant="outline" onClick={() => onRotate(1)} aria-label="Girar 90° a la derecha">
            <RotateCw aria-hidden /> 90°
          </Button>
          <Button type="button" variant="outline" onClick={onFlip} aria-label="Voltear horizontalmente">
            <FlipHorizontal2 aria-hidden /> Voltear
          </Button>
        </div>
      </div>

      <Button type="button" variant="ghost" onClick={onReset} className="w-full text-zinc-600">
        <Undo2 aria-hidden /> Restablecer recorte y giro
      </Button>
      <p className="text-xs leading-relaxed text-zinc-500">
        Arrastra el recuadro para moverlo y sus esquinas para cambiar el tamaño. Con el teclado: flechas (Mayús para pasos grandes).
      </p>
    </div>
  )
}
