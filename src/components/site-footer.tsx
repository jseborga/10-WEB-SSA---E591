'use client'

import Link from 'next/link'
import type { PublicSiteSettings } from '@/lib/public-site'

interface SiteFooterProps {
  siteSettings?: PublicSiteSettings
}

export function SiteFooter({ siteSettings }: SiteFooterProps) {
  const iconUrl = (siteSettings?.faviconUrl || siteSettings?.logoUrl || '/logo.svg').trim() || '/logo.svg'
  const companyName = (siteSettings?.legalName || siteSettings?.companyName || 'SSA Ingenieria SRL').trim()
  const descriptor = (siteSettings?.footerText || 'Empresa de servicios de construccion').trim()
  const country = (siteSettings?.country || 'Bolivia').trim()

  return (
    <footer className="border-t border-zinc-200/70 bg-white/88 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-4 text-center text-[11px] text-zinc-500 sm:px-6 sm:text-xs">
        <Link href="/estudio" className="text-zinc-700 transition-colors hover:text-zinc-950 sm:hidden">
          {companyName}
        </Link>
        <div className="hidden flex-wrap items-center justify-center gap-3 sm:flex">
          <img
            src={iconUrl}
            alt={companyName}
            className="h-5 w-5 shrink-0 rounded-full border border-zinc-200/80 bg-white object-contain p-0.5"
          />
          <p className="flex flex-wrap items-center justify-center gap-1.5">
            <Link href="/estudio" className="font-medium text-zinc-700 transition-colors hover:text-zinc-950">
              {companyName}
            </Link>
            <span aria-hidden="true">-</span>
            <span>{descriptor}</span>
            <span aria-hidden="true">-</span>
            <span>{country}</span>
            <span aria-hidden="true">-</span>
            <span>Todos los derechos reservados</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
