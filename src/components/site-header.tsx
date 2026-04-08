'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { LanguageSelector } from '@/components/language-selector'
import { useLanguage } from '@/lib/language-context'

const ChatWidget = dynamic(() => import('@/components/chat-widget').then((mod) => mod.ChatWidget), {
  ssr: false,
})

interface SiteHeaderProps {
  tone?: 'light' | 'dark'
  logoUrl?: string | null
  companyName?: string | null
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
}

export function SiteHeader({ tone = 'light', logoUrl, companyName }: SiteHeaderProps) {
  const { t } = useLanguage()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isLight = tone === 'light'
  const iconButtonClass = [
    'inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors backdrop-blur-md overflow-hidden',
    isLight
      ? 'border-white/40 bg-black/12 text-white hover:border-white/70 hover:bg-black/24'
      : 'border-zinc-300 bg-white/92 text-zinc-900 hover:border-zinc-500 hover:bg-white',
  ].join(' ')
  const menuButtonClass = [
    'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.24em] transition-colors backdrop-blur-md',
    isLight
      ? 'border-white/40 bg-black/12 text-white hover:border-white/70 hover:bg-black/24'
      : 'border-zinc-300 bg-white/92 text-zinc-900 hover:border-zinc-500 hover:bg-white',
  ].join(' ')
  const initials = getInitials(companyName || 'SSA Ingenieria')
  const menuItems = [
    { href: '/contacto', label: t.nav.contact || 'Contacto' },
    { href: '/proyectos', label: t.nav.projects },
    { href: '/estudio', label: t.nav.studio },
  ]

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-50">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-end px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Link href="/" aria-label="Inicio" className={iconButtonClass}>
            {logoUrl ? (
              <span className="relative h-full w-full">
                <Image
                  src={logoUrl}
                  alt={companyName || 'Inicio'}
                  fill
                  className="object-cover"
                />
              </span>
            ) : (
              <span className="text-[11px] font-medium tracking-[0.28em]">{initials}</span>
            )}
          </Link>
          <button
            onClick={() => setIsMenuOpen((current) => !current)}
            className={menuButtonClass}
          >
            <span>Menu</span>
            {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <LanguageSelector iconOnly blinking tone={tone} />
        </div>
      </nav>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-4 rounded-3xl border border-white/20 bg-black/18 px-4 py-4 backdrop-blur-xl sm:mx-6"
          >
            <div className="ml-auto flex max-w-7xl flex-col items-end gap-2">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="text-sm text-white/92 transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
    <ChatWidget />
    </>
  )
}
