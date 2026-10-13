'use client'

import { useCallback, useState } from 'react'

type HistoryState<T> = {
  past: T[]
  present: T
  future: T[]
  /** Estado previo a una serie de cambios transitorios (p. ej. arrastrar un deslizador). */
  pending: T | null
}

const LIMIT = 100

/** Historial deshacer/rehacer. Los cambios transitorios se agrupan en un único paso al confirmar. */
export function useHistory<T>(initial: T) {
  const [history, setHistory] = useState<HistoryState<T>>({ past: [], present: initial, future: [], pending: null })

  const set = useCallback((updater: (previous: T) => T, options?: { transient?: boolean }) => {
    setHistory((h) => {
      const next = updater(h.present)
      if (Object.is(next, h.present)) return h

      if (options?.transient) {
        return { ...h, present: next, pending: h.pending ?? h.present }
      }

      return { past: [...h.past, h.pending ?? h.present].slice(-LIMIT), present: next, future: [], pending: null }
    })
  }, [])

  /** Cierra una serie de cambios transitorios como un solo paso. */
  const commit = useCallback(() => {
    setHistory((h) => {
      if (h.pending === null) return h
      if (Object.is(h.pending, h.present)) return { ...h, pending: null }
      return { past: [...h.past, h.pending].slice(-LIMIT), present: h.present, future: [], pending: null }
    })
  }, [])

  const undo = useCallback(() => {
    setHistory((h) => {
      const base = h.pending ?? h.present
      if (h.pending !== null) {
        return { ...h, present: base, pending: null, future: [h.present, ...h.future] }
      }
      if (h.past.length === 0) return h
      const previous = h.past[h.past.length - 1]
      return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future], pending: null }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h
      const [next, ...rest] = h.future
      return { past: [...h.past, h.present].slice(-LIMIT), present: next, future: rest, pending: null }
    })
  }, [])

  return {
    state: history.present,
    set,
    commit,
    undo,
    redo,
    canUndo: history.past.length > 0 || history.pending !== null,
    canRedo: history.future.length > 0,
  }
}
