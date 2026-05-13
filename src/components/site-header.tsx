'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Facebook, Home, Instagram, Menu, MessageCircleMore, X } from 'lucide-react'
import { LanguageSelector } from '@/components/language-selector'
import { useLanguage } from '@/lib/language-context'
import type { MenuItemConfig } from '@/lib/menu-config'
import type { PublicSiteSettings } from '@/lib/public-site'

const ChatWidget = dynamic(() => import('@/components/chat-widget').then((mod) => mod.ChatWidget), {
  ssr: false,
})

interface SiteHeaderProps {
  tone?: 'light' | 'dark'
  chatGuideMessages?: string[]
  siteSettings?: PublicSiteSettings
}

function normalizeWhatsappLink(value: string) {
  return value.replace(/\D/g, '')
}

export function SiteHeader({ tone = 'light', chatGuideMessages, siteSettings }: SiteHeaderProps) {
  const { t } = useLanguage()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuItems, setMenuItems] = useState<MenuItemConfig[]>([])
  const isLight = tone === 'light'
  const surfaceToneClass = isLight
    ? 'border-white/35 bg-black/14 text-white hover:border-white/70 hover:bg-white hover:text-zinc-900'
    : 'border-zinc-300 bg-white/92 text-zinc-900 hover:border-zinc-500 hover:bg-zinc-900 hover:text-white'
  const menuButtonClass = [
    'inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-[10px] uppercase tracking-[0.24em] transition-colors backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:text-[11px]',
    surfaceToneClass,
  ].join(' ')
  const iconButtonClass = [
    'h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300',
    surfaceToneClass,
  ].join(' ')
  const mobileHomeButtonClass = [
    'fixed bottom-5 left-1/2 z-50 inline-flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border shadow-[0_18px_48px_rgba(0,0,0,0.24)] backdrop-blur-md transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 md:hidden',
    surfaceToneClass,
  ].join(' ')
  const menuItemClass = isLight ? 'text-white/88 hover:text-white' : 'text-zinc-900/88 hover:text-zinc-950'
  const menuItemTextClass = isLight ? 'text-white/88' : 'text-zinc-900/88'
  const submenuItemClass = isLight ? 'text-white/66 hover:text-white' : 'text-zinc-700/80 hover:text-zinc-950'
  const submenuTextClass = isLight ? 'text-white/66' : 'text-zinc-700/80'
  const socialIconButtonClass = [
    'inline-flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300',
    surfaceToneClass,
  ].join(' ')
  const socialLinks = useMemo(() => {
    const maybeXUrl = (siteSettings?.xUrl || '').trim()

    return [
      { label: 'Instagram', href: siteSettings?.instagramUrl?.trim() || '', icon: Instagram },
      { label: 'Facebook', href: siteSettings?.facebookUrl?.trim() || '', icon: Facebook },
      { label: 'X', href: maybeXUrl, glyph: 'X' },
      {
        label: 'WhatsApp',
        href: siteSettings?.whatsapp?.trim() ? `https://wa.me/${normalizeWhatsappLink(siteSettings.whatsapp)}` : '',
        icon: MessageCircleMore,
      },
    ].filter((item) => item.href)
  }, [siteSettings])
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
            { id: 'fallback-services', label: 'Servicios', href: '/servicios' },
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
          {socialLinks.map((social) => {
            const Icon = social.icon

            return (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                aria-label={social.label}
                className={socialIconButtonClass}
              >
                {Icon ? <Icon className="h-4 w-4" /> : <span className="text-[11px] font-medium uppercase tracking-[0.12em]">{social.glyph}</span>}
              </a>
            )
          })}
          <Link
            href="/"
            aria-label="Inicio"
            className={`hidden md:inline-flex ${iconButtonClass}`}
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
            className="absolute inset-x-0 top-full"
          >
            <div className="mx-auto flex max-w-7xl justify-end px-4 pt-3 sm:px-6">
              <div className="flex w-fit max-w-[calc(100vw-2rem)] flex-col items-end gap-3 py-1 text-right">
                {menuItems.map((item) => (
                  <div key={item.id} className="flex flex-col items-end gap-2">
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => setIsMenuOpen(false)}
                        target={item.openInNewTab ? '_blank' : undefined}
                        rel={item.openInNewTab ? 'noreferrer' : undefined}
                        className={`inline-flex max-w-full justify-end text-right text-sm transition-colors ${menuItemClass}`}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className={`text-sm ${menuItemTextClass}`}>{item.label}</span>
                    )}
                    {item.children?.length ? (
                      <div className="flex flex-col items-end gap-1 pr-2">
                        {item.children.map((child) =>
                          child.href ? (
                            <Link
                              key={child.id}
                              href={child.href}
                              onClick={() => setIsMenuOpen(false)}
                              target={child.openInNewTab ? '_blank' : undefined}
                              rel={child.openInNewTab ? 'noreferrer' : undefined}
                              className={`inline-flex max-w-full justify-end text-right text-xs transition-colors ${submenuItemClass}`}
                            >
                              {child.label}
                            </Link>
                          ) : (
                            <span key={child.id} className={`text-right text-xs ${submenuTextClass}`}>
                              {child.label}
                            </span>
                          ),
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
    <Link
      href="/"
      aria-label="Inicio"
      className={mobileHomeButtonClass}
    >
      <Home className="h-4 w-4" />
    </Link>
    <ChatWidget buttonTone={tone} guideMessages={chatGuideMessages} />
    </>
  )
}
