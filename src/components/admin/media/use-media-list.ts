'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MediaAssetDTO } from '../types'
import { fetchMediaPage, type MediaCounts, type MediaFilter } from './media-api'

export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}

type ListData = {
  key: string
  items: MediaAssetDTO[]
  nextCursor: string | null
  counts: MediaCounts | null
  error: string | null
}

/** Lista paginada de la biblioteca con búsqueda, filtro y actualización local. */
export function useMediaList({ filter, query, withCounts = false }: { filter: MediaFilter; query: string; withCounts?: boolean }) {
  const q = useDebouncedValue(query.trim(), 300)
  const [reloadToken, setReloadToken] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [data, setData] = useState<ListData>({ key: '', items: [], nextCursor: null, counts: null, error: null })
  const key = `${filter}|${q}|${reloadToken}`

  useEffect(() => {
    let cancelled = false

    fetchMediaPage({ q, filter, withCounts }).then(
      (page) => {
        if (cancelled) return
        setData((previous) => ({
          key,
          items: page.items,
          nextCursor: page.nextCursor,
          counts: page.counts ?? previous.counts,
          error: null,
        }))
      },
      (error: unknown) => {
        if (cancelled) return
        setData((previous) => ({
          ...previous,
          key,
          error: error instanceof Error ? error.message : 'No se pudo cargar la biblioteca',
        }))
      },
    )

    return () => {
      cancelled = true
    }
  }, [key])

  const loadMore = useCallback(async () => {
    if (!data.nextCursor || loadingMore) return
    setLoadingMore(true)

    try {
      const page = await fetchMediaPage({ q, filter, cursor: data.nextCursor })
      setData((previous) => {
        const known = new Set(previous.items.map((item) => item.id))
        return {
          ...previous,
          items: [...previous.items, ...page.items.filter((item) => !known.has(item.id))],
          nextCursor: page.nextCursor,
        }
      })
    } catch (error) {
      setData((previous) => ({ ...previous, error: error instanceof Error ? error.message : 'No se pudo cargar más' }))
    } finally {
      setLoadingMore(false)
    }
  }, [data.nextCursor, loadingMore, q, filter])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  /** Inserta o reemplaza un recurso sin recargar toda la lista. */
  const upsert = useCallback((asset: MediaAssetDTO) => {
    setData((previous) => {
      const exists = previous.items.some((item) => item.id === asset.id)
      return {
        ...previous,
        items: exists ? previous.items.map((item) => (item.id === asset.id ? asset : item)) : [asset, ...previous.items],
      }
    })
  }, [])

  const remove = useCallback((id: string) => {
    setData((previous) => ({ ...previous, items: previous.items.filter((item) => item.id !== id) }))
  }, [])

  return {
    items: data.items,
    counts: data.counts,
    error: data.error,
    loading: data.key !== key,
    initialLoading: data.key === '' && !data.error,
    hasMore: Boolean(data.nextCursor),
    loadingMore,
    loadMore,
    reload,
    upsert,
    remove,
  }
}
