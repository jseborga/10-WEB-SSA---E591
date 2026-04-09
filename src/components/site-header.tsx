'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Home, Menu, X } from 'lucide-react'
import { LanguageSelector } from '@/components/language-selector'
import { useLanguage } from '@/lib/language-context'
import type { MenuItemConfig } from '@/lib/menu-config'

const ChatWidget = dynamic(() => import('@/components/chat-widget').then((mod) => mod.ChatWidget), {
  ssr: false,
})

interface SiteHeaderProps {
  tone?: 'light' | 'dark'
}

export function SiteHeader({ tone = 'light' }: SiteHeaderProps) {
  const { t } = useLanguage()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuItems, setMenuItems] = useState<MenuItemConfig[]>([])
  const isLight = tone === 'light'
  const menuButtonClass = [
    'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.24em] transition-colors backdrop-blur-md',
    isLight
      ? 'border-white/40 bg-black/12 text-white hover:border-white/70 hover:bg-black/24'
      : 'border-zinc-300 bg-white/92 text-zinc-900 hover:border-zinc-500 hover:bg-white',
  ].join(' ')
  useEffect(() => {
    let active = true

    void fetch('/api/menu', { cache: 'no-store' })
      .then(async (response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!active) {
          return
        }

        setMenuItems(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (active) {
          setMenuItems([
            { id: 'fallback-home', label: 'Inicio', href: '/' },
            { id: 'fallback-projects', label: t.nav.projects, href: '/proyectos' },
            { id: 'fallback-studio', label: t.nav.studio, href: '/estudio' },
            { id: 'fallback-contact', label: t.nav.contact || 'Contacto', href: '/contacto' },
          ])
        }
      })

    return () => {
      active = false
    }
  }, [t.nav.contact, t.nav.projects, t.nav.studio])

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-50">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <LanguageSelector blinking tone={tone} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            aria-label="Inicio"
            className={[
              'hidden h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition-colors md:inline-flex',
              isLight
                ? 'border-white/35 bg-black/14 text-white hover:border-white/70 hover:bg-white hover:text-zinc-900'
                : 'border-zinc-300 bg-white/92 text-zinc-900 hover:border-zinc-500 hover:bg-zinc-900 hover:text-white',
            ].join(' ')}
          >
            <Home className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setIsMenuOpen((current) => !current)}
            className={menuButtonClass}
          >
            <span>Menu</span>
            {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
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
                <div key={item.id} className="flex flex-col items-end gap-2">
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      target={item.openInNewTab ? '_blank' : undefined}
                      rel={item.openInNewTab ? 'noreferrer' : undefined}
                      className="text-sm text-white/92 transition-colors hover:text-white"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-sm text-white/92">{item.label}</span>
                  )}
                  {item.children?.length ? (
                    <div className="mr-2 flex flex-col items-end gap-1 border-r border-white/15 pr-3">
                      {item.children.map((child) =>
                        child.href ? (
                          <Link
                            key={child.id}
                            href={child.href}
                            onClick={() => setIsMenuOpen(false)}
                            target={child.openInNewTab ? '_blank' : undefined}
                            rel={child.openInNewTab ? 'noreferrer' : undefined}
                            className="text-xs text-white/70 transition-colors hover:text-white"
                          >
                            {child.label}
                          </Link>
                        ) : (
                          <span key={child.id} className="text-xs text-white/70">
                            {child.label}
                          </span>
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
    <Link
      href="/"
      aria-label="Inicio"
      className="fixed bottom-5 left-1/2 z-50 inline-flex h-14 min-w-[76px] -translate-x-1/2 items-center justify-center rounded-full bg-black px-5 text-white shadow-[0_18px_48px_rgba(0,0,0,0.28)] transition-all duration-300 hover:bg-white hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 md:hidden"
    >
      <span className="h-3.5 w-3.5 rounded-full bg-current" />
    </Link>
    <ChatWidget />
    </>
  )
}
