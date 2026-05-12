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
  aiHeroMessages?: string[]
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

function getUniqueMessages(messages: string[]) {
  return Array.from(new Set(messages.map((message) => message.trim()).filter(Boolean)))
}

function pickRandomMessage(messages: string[], seedKey: string, seed: number) {
  if (messages.length === 0) {
    return ''
  }

  if (messages.length === 1) {
    return messages[0]
  }

  const compositeKey = `${seedKey}:${seed}`
  let hash = 0

  for (const char of compositeKey) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }

  return messages[hash % messages.length] || messages[0]
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
  companyLabelClass: string
  commandTextClass: string
  messageTextClass: string
  shareButtonClass: string
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
  companyLabelClass,
  commandTextClass,
  messageTextClass,
  shareButtonClass,
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
          className="pointer-events-auto max-w-[min(92vw,34rem)] space-y-3"
        >
          {showCompanyName ? (
            <p className={`font-mono text-[10px] uppercase tracking-[0.18em] ${companyLabelClass}`}>
              {companyName}
            </p>
          ) : null}
          <div className="inline-flex max-w-full items-end gap-2">
            <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${commandTextClass}`}>
              ssa@obra:~$
            </span>
            <span className={`whitespace-pre-wrap break-words font-mono text-sm uppercase leading-tight sm:text-lg lg:text-xl ${messageTextClass}`}>
              {message.slice(0, typedLength)}
            </span>
            <span className={`inline-block h-4 w-[2px] shrink-0 animate-pulse rounded-full sm:h-5 ${tone === 'light' ? 'bg-lime-200/85' : 'bg-emerald-950/80'}`} />
          </div>
          <button
            type="button"
            onClick={onShare}
            className={`inline-flex h-8 w-8 items-center justify-center transition-colors ${shareButtonClass}`}
            aria-label={shareCopied ? copiedLabel : shareLabel}
            title={shareCopied ? copiedLabel : shareLabel}
          >
            {shareCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export default function HomePageClient({
  initialProjects = [],
  siteSettings,
  aiHeroMessages = [],
}: HomePageClientProps) {
  const { language } = useLanguage()
  const [activeHeroIndex, setActiveHeroIndex] = useState(0)
  const [heroMessageSeed, setHeroMessageSeed] = useState(() => Math.floor(Math.random() * 1_000_000_000))
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
    const combined = getUniqueMessages([
      ...aiHeroMessages,
      ...configuredMessages,
      siteSettings?.companyName?.trim() || 'SSA Ingenieria',
      siteSettings?.tagline?.trim() || 'Soluciones integrales',
    ])

    return combined
  }, [aiHeroMessages, siteSettings?.companyName, siteSettings?.heroMessages, siteSettings?.tagline])
  const heroRotationMs = clampNumber(siteSettings?.heroRotationMs, 8600, 2500, 20000)
  const heroTone = siteSettings?.heroTextTone === 'light' ? 'light' : 'dark'
  const advanceHero = () => {
    setActiveHeroIndex((current) => (current + 1) % Math.max(heroImages.length, 1))
    setHeroMessageSeed(Math.floor(Math.random() * 1_000_000_000))
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
  const activeHeroMessage = useMemo(
    () => pickRandomMessage(heroMessages, `${resolvedHeroIndex}-${activeHeroItem}`, heroMessageSeed),
    [activeHeroItem, heroMessageSeed, heroMessages, resolvedHeroIndex],
  )
  const heroCompanyLabelClass =
    heroTone === 'light'
      ? 'text-white/72 [text-shadow:0_0_10px_rgba(255,255,255,0.18)]'
      : 'text-zinc-900/68 [text-shadow:0_0_10px_rgba(255,255,255,0.16)]'
  const heroCommandTextClass =
    heroTone === 'light'
      ? 'text-lime-200/72 [text-shadow:0_0_12px_rgba(190,242,100,0.28)]'
      : 'text-emerald-950/62 [text-shadow:0_0_8px_rgba(255,255,255,0.16)]'
  const heroMessageTextClass =
    heroTone === 'light'
      ? 'text-lime-100 [text-shadow:0_0_12px_rgba(217,249,157,0.3)]'
      : 'text-emerald-950 [text-shadow:0_0_10px_rgba(255,255,255,0.18)]'
  const heroShareButtonClass =
    heroTone === 'light'
      ? 'text-white/78 hover:text-white'
      : 'text-zinc-950/74 hover:text-zinc-950'

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
                companyLabelClass={heroCompanyLabelClass}
                commandTextClass={heroCommandTextClass}
                messageTextClass={heroMessageTextClass}
                shareButtonClass={heroShareButtonClass}
                onShare={() => void handleShareSite()}
              />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  )
}
