'use client'

import { useLanguage } from '@/lib/language-context'
import { Globe } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'

const languages = [
  { code: 'es' as const, name: 'ES', full: 'Español' },
  { code: 'en' as const, name: 'EN', full: 'English' },
  { code: 'pt' as const, name: 'PT', full: 'Português' },
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
  const currentLanguage = languages.find((item) => item.code === language) || languages[0]

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
          'inline-flex items-center justify-center rounded-full border px-3.5 py-2 text-[11px] font-medium tracking-[0.24em] transition-colors backdrop-blur-md',
          isLight
            ? 'border-white/40 bg-black/12 text-white hover:border-white/70 hover:bg-black/24'
            : 'border-zinc-300 bg-white/92 text-zinc-900 hover:border-zinc-500 hover:bg-white'
          ,
          iconOnly ? 'h-11 w-11 px-0 py-0' : 'gap-2.5',
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
          <Globe className="h-4 w-4 text-sky-400" />
        </motion.span>
        {!iconOnly ? <span className="uppercase">{currentLanguage.name}</span> : null}
      </button>

      {isOpen && (
        <div className="absolute left-full top-full z-50 ml-2 mt-2 min-w-[168px] overflow-hidden rounded-2xl border border-zinc-200 bg-white/96 p-1.5 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code)
                setIsOpen(false)
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                language === lang.code ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-sky-50 hover:text-zinc-900'
              }`}
            >
              <span>{lang.full}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-[0.18em] ${
                  language === lang.code ? 'bg-white/14 text-white' : 'bg-sky-100 text-sky-700'
                }`}
              >
                {lang.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
