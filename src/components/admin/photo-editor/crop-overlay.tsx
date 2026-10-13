'use client'

import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { CropRect } from './image-pipeline'

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

type CropOverlayProps = {
  rect: CropRect
  /** Proporción ancho/alto en coordenadas normalizadas, o null si es libre. */
  ratio: number | null
  onChange: (rect: CropRect, commit: boolean) => void
}

const MIN = 0.05
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const HANDLE_POSITIONS: Record<Exclude<Handle, 'move'>, string> = {
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
  ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
  sw: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
  se: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
  n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
  s: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
  e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
}

function resize(start: CropRect, handle: Handle, dx: number, dy: number, ratio: number | null): CropRect {
  if (handle === 'move') {
    return { ...start, x: clamp(start.x + dx, 0, 1 - start.w), y: clamp(start.y + dy, 0, 1 - start.h) }
  }

  if (ratio && handle.length === 2) {
    // Esquina con proporción fija: la esquina opuesta queda anclada.
    const dirX = handle.includes('e') ? 1 : -1
    const dirY = handle.includes('s') ? 1 : -1
    const ax = dirX > 0 ? start.x : start.x + start.w
    const ay = dirY > 0 ? start.y : start.y + start.h
    const px = (dirX > 0 ? start.x + start.w : start.x) + dx
    const py = (dirY > 0 ? start.y + start.h : start.y) + dy
    let w = Math.max(Math.abs(px - ax), Math.abs(py - ay) * ratio, MIN)
    let h = w / ratio
    const maxW = dirX > 0 ? 1 - ax : ax
    const maxH = dirY > 0 ? 1 - ay : ay
    if (w > maxW) {
      w = maxW
      h = w / ratio
    }
    if (h > maxH) {
      h = maxH
      w = h * ratio
    }
    return { x: dirX > 0 ? ax : ax - w, y: dirY > 0 ? ay : ay - h, w, h }
  }

  let { x, y, w, h } = start
  const right = start.x + start.w
  const bottom = start.y + start.h

  if (handle.includes('w')) {
    x = clamp(start.x + dx, 0, right - MIN)
    w = right - x
  }
  if (handle.includes('e')) {
    w = clamp(start.w + dx, MIN, 1 - start.x)
  }
  if (handle.includes('n')) {
    y = clamp(start.y + dy, 0, bottom - MIN)
    h = bottom - y
  }
  if (handle.includes('s')) {
    h = clamp(start.h + dy, MIN, 1 - start.y)
  }

  return { x, y, w, h }
}

export function CropOverlay({ rect, ratio, onChange }: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ handle: Handle; startX: number; startY: number; start: CropRect; last: CropRect } | null>(null)

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const handle = event.currentTarget.dataset.handle as Handle
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { handle, startX: event.clientX, startY: event.clientY, start: rect, last: rect }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!current || !bounds) return
    const dx = (event.clientX - current.startX) / bounds.width
    const dy = (event.clientY - current.startY) / bounds.height
    current.last = resize(current.start, current.handle, dx, dy, ratio)
    onChange(current.last, false)
  }

  const onPointerUp = () => {
    if (!drag.current) return
    onChange(drag.current.last, true)
    drag.current = null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.05 : 0.01
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = delta[event.key]
    if (!move) return
    event.preventDefault()
    onChange(resize(rect, 'move', move[0], move[1], ratio), true)
  }

  const handles = (Object.keys(HANDLE_POSITIONS) as Array<Exclude<Handle, 'move'>>).filter(
    (handle) => !ratio || handle.length === 2,
  )

  const dragHandlers = { onPointerMove, onPointerUp, onPointerCancel: onPointerUp }

  return (
    <div ref={containerRef} className="absolute inset-0 touch-none overflow-hidden select-none">
      <div
        role="group"
        tabIndex={0}
        aria-label="Área de recorte. Arrástrala o usa las flechas para moverla."
        className="absolute cursor-move outline-none ring-sky-400 focus-visible:ring-2"
        style={{
          left: `${rect.x * 100}%`,
          top: `${rect.y * 100}%`,
          width: `${rect.w * 100}%`,
          height: `${rect.h * 100}%`,
          boxShadow: '0 0 0 9999px rgba(9, 9, 11, 0.55)',
          border: '1px solid rgba(255,255,255,0.9)',
        }}
        data-handle="move"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        {...dragHandlers}
      >
        {/* Regla de tercios */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
        </div>
        {handles.map((handle) => (
          <div
            key={handle}
            aria-hidden
            className={`absolute flex size-8 items-center justify-center ${HANDLE_POSITIONS[handle]}`}
            data-handle={handle}
            onPointerDown={onPointerDown}
            {...dragHandlers}
          >
            <span
              className={`block rounded-sm bg-white shadow ring-1 ring-zinc-900/20 ${
                handle.length === 2 ? 'size-3.5' : handle === 'n' || handle === 's' ? 'h-1.5 w-5' : 'h-5 w-1.5'
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
