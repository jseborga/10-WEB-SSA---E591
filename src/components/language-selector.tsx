'use client'

import { useLanguage } from '@/lib/language-context'
import { Globe } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'

const languages = [
  { code: 'es' as const, name: 'ES', full: 'Espanol' },
  { code: 'en' as const, name: 'EN', full: 'English' },
  { code: 'pt' as const, name: 'PT', full: 'Portugues' },
]

interface LanguageSelectorProps {
  iconOnly?: boolean
  tone?: 'light' | 'dark'
  blinking?: boolean
}

export function LanguageSelector({
  iconOnly = false,
  tone = 'light',
  blinking = false,
}: LanguageSelectorProps) {
  const { language, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isLight = tone === 'light'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen((current) => !current)}
        className={[
          'inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs tracking-[0.24em] transition-colors backdrop-blur-md',
          isLight
            ? 'border-white/40 bg-black/12 text-white hover:border-white/70 hover:bg-black/24'
            : 'border-zinc-300 bg-white/92 text-zinc-900 hover:border-zinc-500 hover:bg-white',
          iconOnly ? 'h-11 w-11 px-0 py-0' : 'gap-2',
        ].join(' ')}
        aria-label="Select language"
      >
        <motion.span
          animate={
            blinking
              ? {
                  opacity: [0.35, 1, 0.35],
                  scale: [1, 1.06, 1],
                }
              : undefined
          }
          transition={blinking ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
          className="inline-flex"
        >
          <Globe className="h-4 w-4" />
        </motion.span>
        {!iconOnly ? <span className="uppercase">{language}</span> : null}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[132px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code)
                setIsOpen(false)
              }}
              className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                language === lang.code ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
            >
              {lang.full}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
