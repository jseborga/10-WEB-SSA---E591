'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatTagLabel } from '@/lib/public-site'

interface ProjectMediaOverlayProps {
  category: string
  label: string
  tags?: string[]
  className?: string
}

export function ProjectMediaOverlay({
  category,
  label,
  tags = [],
  className = '',
}: ProjectMediaOverlayProps) {
  const [typedLength, setTypedLength] = useState(0)
  const message = useMemo(() => {
    const normalizedCategory = category.trim()
    const normalizedLabel = label.trim()

    if (!normalizedCategory) {
      return normalizedLabel
    }

    if (!normalizedLabel || normalizedLabel.toLowerCase() === normalizedCategory.toLowerCase()) {
      return normalizedCategory
    }

    return `${normalizedLabel} // ${normalizedCategory}`
  }, [category, label])

  useEffect(() => {
    const nextMessage = message.trim()

    if (!nextMessage) {
      return
    }

    let charIndex = 0

    const typingInterval = window.setInterval(() => {
      charIndex += 1
      setTypedLength(Math.min(charIndex, nextMessage.length))

      if (charIndex >= nextMessage.length) {
        window.clearInterval(typingInterval)
      }
    }, 34)

    return () => {
      window.clearInterval(typingInterval)
    }
  }, [message])

  const visibleTags = tags.slice(0, 4)

  return (
    <div className={`pointer-events-none absolute bottom-4 left-4 z-10 max-w-[80%] space-y-1.5 ${className}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/72 drop-shadow-md">
        {category}
      </p>
      <div className="inline-flex max-w-full items-end gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-lime-200/70 drop-shadow-md">
          ssa@obra:~$
        </span>
        <span className="whitespace-pre-wrap break-words font-mono text-[11px] uppercase leading-tight text-lime-100 drop-shadow-md sm:text-xs">
          {message.slice(0, typedLength)}
        </span>
        <span className="inline-block h-3.5 w-[2px] shrink-0 animate-pulse rounded-full bg-lime-200/85 drop-shadow-md" />
      </div>
      {visibleTags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {visibleTags.map((tag) => (
            <span key={tag} className="font-mono text-[10px] text-white/76 drop-shadow-md">
              {formatTagLabel(tag)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
