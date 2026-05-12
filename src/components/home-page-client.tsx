'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { SiteHeader } from '@/components/site-header'
import { useLanguage } from '@/lib/language-context'
import { PublicProject, PublicSiteSettings, isVideoUrl, parseLineList, parseUrlList } from '@/lib/public-site'
import { shareLink } from '@/lib/share'

interface HomePageClientProps {
  initialProjects?: PublicProject[]
  siteSettings?: PublicSiteSettings
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

function shuffleItems<T>(items: T[]) {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }

  return next
}

function pickMessageForScene(messages: string[], key: string) {
  if (messages.length === 0) {
    return ''
  }

  let hash = 0

  for (const char of key) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }

  return messages[hash % messages.length]
}

interface TypedHeroMessageProps {
  companyName: string
  message: string
  rotationMs: number
  tone: 'dark' | 'light'
  showCompanyName: boolean
  shareCopied: boolean
  shareLabel: string
  copiedLabel: string
  shareButtonClass: string
  messageSurfaceClass: string
  onShare: () => void
}

function TypedHeroMessage({
  companyName,
  message,
  rotationMs,
  tone,
  showCompanyName,
  shareCopied,
  shareLabel,
  copiedLabel,
  shareButtonClass,
  messageSurfaceClass,
  onShare,
}: TypedHeroMessageProps) {
  const [typedLength, setTypedLength] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const nextMessage = message.trim()

    if (!nextMessage) {
      return
    }

    const typingWindow = Math.max(1400, Math.floor(rotationMs * 0.38))
    const charDelay = Math.max(32, Math.min(84, Math.floor(typingWindow / Math.max(nextMessage.length, 1))))
    const hideDelay = Math.max(typingWindow + 1400, rotationMs - 540)
    let charIndex = 0

    const typingInterval = window.setInterval(() => {
      charIndex += 1
      setTypedLength(Math.min(charIndex, nextMessage.length))

      if (charIndex >= nextMessage.length) {
        window.clearInterval(typingInterval)
      }
    }, charDelay)

    const hideTimeout = window.setTimeout(() => {
      setIsVisible(false)
    }, hideDelay)

    return () => {
      window.clearInterval(typingInterval)
      window.clearTimeout(hideTimeout)
    }
  }, [message, rotationMs])

  return (
    <AnimatePresence mode="wait">
      {isVisible ? (
        <motion.div
          key={message}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="pointer-events-auto max-w-[min(92vw,42rem)] space-y-3"
        >
          {showCompanyName ? (
            <p className={`text-[11px] uppercase tracking-[0.28em] ${tone === 'light' ? 'text-white/78' : 'text-zinc-900/78'}`}>
              {companyName}
            </p>
          ) : null}
          <div className={`inline-flex max-w-full items-end gap-2 rounded-[24px] border px-4 py-3 backdrop-blur-md sm:px-5 sm:py-4 ${messageSurfaceClass}`}>
            <span className="whitespace-pre-wrap break-words text-xl font-light leading-tight sm:text-3xl lg:text-4xl">
              {message.slice(0, typedLength)}
            </span>
            <span className="inline-block h-5 w-[2px] shrink-0 animate-pulse rounded-full bg-current/80 sm:h-7" />
          </div>
          <button
            type="button"
            onClick={onShare}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.22em] backdrop-blur-md transition-colors ${shareButtonClass}`}
          >
            {shareCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            <span>{shareCopied ? copiedLabel : shareLabel}</span>
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export default function HomePageClient({
  initialProjects = [],
  siteSettings,
}: HomePageClientProps) {
  const { language } = useLanguage()
  const [activeHeroIndex, setActiveHeroIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mediaQuery.matches)

    update()
    mediaQuery.addEventListener('change', update)

    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  const desktopImages = useMemo(() => {
    const configuredDesktop = parseUrlList(siteSettings?.heroImages)
    const projectImages = initialProjects
      .filter((project) => project.showOnHomepage)
      .map((project) => project.mainImage?.trim() || '')
      .filter((value) => value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://'))

    const uniqueProjectImages = projectImages.filter((image, index) => projectImages.indexOf(image) === index && !configuredDesktop.includes(image))
    return shuffleItems([...configuredDesktop, ...uniqueProjectImages])
  }, [initialProjects, siteSettings?.heroImages])

  const mobileImages = useMemo(() => {
    const configuredMobile = parseUrlList(siteSettings?.heroImagesMobile)
    const projectImagesMobile = initialProjects
      .filter((project) => project.showOnHomepage)
      .map((project) => (project.mainImageMobile || project.mainImage || '').trim())
      .filter((value) => value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://'))

    if (configuredMobile.length > 0) {
      const uniqueProjectImages = projectImagesMobile.filter((image, index) => projectImagesMobile.indexOf(image) === index && !configuredMobile.includes(image))
      return shuffleItems([...configuredMobile, ...uniqueProjectImages])
    }

    return projectImagesMobile.length > 0 ? shuffleItems(projectImagesMobile) : desktopImages
  }, [desktopImages, initialProjects, siteSettings?.heroImagesMobile])

  const heroImages = isMobile ? mobileImages : desktopImages
  const resolvedHeroIndex = heroImages.length > 0 ? activeHeroIndex % heroImages.length : 0
  const activeHeroItem = heroImages[resolvedHeroIndex] || ''
  const heroMessages = useMemo(() => {
    const configuredMessages = parseLineList(siteSettings?.heroMessages)

    if (configuredMessages.length > 0) {
      return configuredMessages
    }

    return [
      siteSettings?.companyName?.trim() || 'SSA Ingenieria',
      siteSettings?.tagline?.trim() || 'Soluciones integrales',
    ].filter(Boolean)
  }, [siteSettings?.companyName, siteSettings?.heroMessages, siteSettings?.tagline])
  const heroRotationMs = clampNumber(siteSettings?.heroRotationMs, 8600, 2500, 20000)
  const heroTone = siteSettings?.heroTextTone === 'light' ? 'light' : 'dark'
  const advanceHero = () => {
    setActiveHeroIndex((current) => (current + 1) % Math.max(heroImages.length, 1))
  }

  useEffect(() => {
    if (heroImages.length <= 1 || !activeHeroItem || isVideoUrl(activeHeroItem)) {
      return
    }

    const timeout = window.setTimeout(() => {
      advanceHero()
    }, heroRotationMs)

    return () => window.clearTimeout(timeout)
  }, [activeHeroItem, heroImages.length, heroRotationMs])

  const heroImageFit: 'cover' | 'contain' = siteSettings?.heroImageFit === 'contain' ? 'contain' : 'cover'
  const heroImageTreatment: 'editorial' | 'original' | 'enhanced' | 'monochrome' =
    siteSettings?.heroImageTreatment === 'enhanced' ||
    siteSettings?.heroImageTreatment === 'monochrome' ||
    siteSettings?.heroImageTreatment === 'editorial'
      ? siteSettings.heroImageTreatment
      : 'original'
  const heroImageOpacity = clampNumber(siteSettings?.heroImageOpacity, 34, 5, 70)
  const heroImageSaturation = clampNumber(siteSettings?.heroImageSaturation, 100, 0, 160)
  const heroImageBrightness = clampNumber(siteSettings?.heroImageBrightness, 100, 70, 150)
  const heroImageContrast = clampNumber(siteSettings?.heroImageContrast, 105, 80, 160)
  const activeHeroOpacity = heroImageTreatment === 'original' ? 1 : heroImageOpacity / 100
  const activeHeroGrayscale = heroImageTreatment === 'monochrome' ? 100 : Math.max(0, Math.round(100 - heroImageSaturation * 0.38))
  const activeHeroSaturation = Math.max(0.9, heroImageSaturation / 100)
  const activeHeroMessage = useMemo(
    () => pickMessageForScene(heroMessages, `${resolvedHeroIndex}-${activeHeroItem}`),
    [activeHeroItem, heroMessages, resolvedHeroIndex],
  )
  const companyName = siteSettings?.companyName?.trim() || 'SSA Ingenieria'
  const shareCopy =
    language === 'en'
      ? {
          share: 'Share site',
          copied: 'Link copied',
          error: 'Could not share the site',
        }
      : language === 'pt'
        ? {
            share: 'Compartilhar site',
            copied: 'Link copiado',
            error: 'Nao foi possivel compartilhar o site',
          }
        : {
            share: 'Compartir sitio',
            copied: 'Enlace copiado',
            error: 'No se pudo compartir el sitio',
          }
  const heroMessageSurfaceClass =
    heroTone === 'light'
      ? 'border-white/25 bg-black/18 text-white shadow-[0_18px_48px_rgba(0,0,0,0.22)]'
      : 'border-white/55 bg-white/72 text-zinc-950 shadow-[0_18px_48px_rgba(15,23,42,0.12)]'
  const heroShareButtonClass =
    heroTone === 'light'
      ? 'border-white/25 bg-black/18 text-white hover:border-white/45 hover:bg-black/28'
      : 'border-white/55 bg-white/72 text-zinc-950 hover:border-white hover:bg-white'

  const handleShareSite = async () => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const result = await shareLink({
        title: companyName,
        text: activeHeroMessage || siteSettings?.tagline?.trim() || companyName,
        url: window.location.href,
      })

      if (result === 'copied') {
        setShareCopied(true)
        toast.success(shareCopy.copied)
        window.setTimeout(() => setShareCopied(false), 1800)
      }
    } catch {
      toast.error(shareCopy.error)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950">
      <SiteHeader tone="light" />

      <section className="relative min-h-screen">
        <div className="absolute inset-0">
          {heroImages.length > 0 ? (
            <AnimatePresence mode="sync">
              {heroImages.map((imageUrl, index) =>
                index === resolvedHeroIndex ? (
                  isVideoUrl(imageUrl) ? (
                    <motion.video
                      key={`${imageUrl}-${isMobile ? 'mobile' : 'desktop'}`}
                      src={imageUrl}
                      autoPlay
                      muted
                      playsInline
                      onEnded={() => {
                        if (heroImages.length > 1) {
                          advanceHero()
                        }
                      }}
                      initial={{ opacity: 0, scale: 1.08 }}
                      animate={{ opacity: activeHeroOpacity, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.03 }}
                      transition={{ duration: 1.6, ease: 'easeOut' }}
                      className={`absolute inset-0 h-full w-full ${heroImageFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                      style={{
                        filter:
                          heroImageTreatment === 'original'
                            ? `brightness(${heroImageBrightness / 100}) contrast(${heroImageContrast / 100})`
                            : heroImageTreatment === 'enhanced'
                              ? `grayscale(4%) saturate(${Math.max(1, activeHeroSaturation * 1.06)}) brightness(${heroImageBrightness / 100}) contrast(${heroImageContrast / 100})`
                              : heroImageTreatment === 'monochrome'
                                ? `grayscale(100%) brightness(${heroImageBrightness / 100}) contrast(${heroImageContrast / 100})`
                                : `grayscale(${activeHeroGrayscale}%) saturate(${activeHeroSaturation}) brightness(${heroImageBrightness / 100}) contrast(${heroImageContrast / 100})`,
                      }}
                    />
                  ) : (
                    <motion.img
                      key={`${imageUrl}-${isMobile ? 'mobile' : 'desktop'}`}
                      src={imageUrl}
                      alt=""
                      initial={{ opacity: 0, scale: 1.08 }}
                      animate={{ opacity: activeHeroOpacity, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.03 }}
                      transition={{ duration: 1.6, ease: 'easeOut' }}
                      className={`absolute inset-0 h-full w-full ${heroImageFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                      style={{
                        filter:
                          heroImageTreatment === 'original'
                            ? `brightness(${heroImageBrightness / 100}) contrast(${heroImageContrast / 100})`
                            : heroImageTreatment === 'enhanced'
                              ? `grayscale(4%) saturate(${Math.max(1, activeHeroSaturation * 1.06)}) brightness(${heroImageBrightness / 100}) contrast(${heroImageContrast / 100})`
                              : heroImageTreatment === 'monochrome'
                                ? `grayscale(100%) brightness(${heroImageBrightness / 100}) contrast(${heroImageContrast / 100})`
                                : `grayscale(${activeHeroGrayscale}%) saturate(${activeHeroSaturation}) brightness(${heroImageBrightness / 100}) contrast(${heroImageContrast / 100})`,
                      }}
                    />
                  )
                ) : null,
              )}
            </AnimatePresence>
          ) : (
            <Image src="/images/hero-bg.png" alt="" fill className="object-cover" priority />
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-28 z-20 px-4 sm:bottom-20 sm:px-6 lg:bottom-16">
          <div className="mx-auto flex max-w-7xl">
            {activeHeroMessage ? (
              <TypedHeroMessage
                key={`${activeHeroMessage}-${heroRotationMs}`}
                companyName={companyName}
                message={activeHeroMessage}
                rotationMs={heroRotationMs}
                tone={heroTone}
                showCompanyName={Boolean(siteSettings?.heroShowCompanyName)}
                shareCopied={shareCopied}
                shareLabel={shareCopy.share}
                copiedLabel={shareCopy.copied}
                shareButtonClass={heroShareButtonClass}
                messageSurfaceClass={heroMessageSurfaceClass}
                onShare={() => void handleShareSite()}
              />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  )
}
