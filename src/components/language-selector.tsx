'use client'

import { useLanguage } from '@/lib/language-context'
import { Globe } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const languages = [
  { code: 'es' as const, name: 'ES', full: 'Español' },
  { code: 'en' as const, name: 'EN', full: 'English' },
  { code: 'pt' as const, name: 'PT', full: 'Português' }
]

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs tracking-wide text-zinc-600 hover:text-zinc-900 transition-colors"
        aria-label="Select language"
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="uppercase">{language}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden z-50 min-w-[120px]">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code)
                setIsOpen(false)
              }}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 transition-colors ${
                language === lang.code ? 'bg-zinc-50 text-zinc-900 font-medium' : 'text-zinc-600'
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
