'use client'

import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { useLanguage } from '@/lib/language-context'
import { PublicProject, PublicSiteSettings, isVideoUrl, parseUrlList } from '@/lib/public-site'

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

function isValidMediaUrl(value: string) {
  return value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://')
}

interface HeroItem {
  url: string
  projectId?: string | null
}

export default function HomePageClient({
  initialProjects = [],
  siteSettings,
  aiHeroMessages = [],
}: HomePageClientProps) {
  const router = useRouter()
  const { language } = useLanguage()
  const [activeHeroIndex, setActiveHeroIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)
  const didSwipeRef = useRef(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mediaQuery.matches)

    update()
    mediaQuery.addEventListener('change', update)

    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  const desktopImages = useMemo<HeroItem[]>(() => {
    const configuredDesktop = parseUrlList(siteSettings?.heroImages)
    const projectImages = initialProjects
      .filter((project) => project.showOnHomepage)
      .map((project) => ({
        url: project.mainImage?.trim() || '',
        projectId: project.id,
      }))
      .filter((item) => isValidMediaUrl(item.url))
    const configuredProjectLookup = new Map(projectImages.map((item) => [item.url, item.projectId]))
    const configuredItems = configuredDesktop.map((url) => ({
      url,
      projectId: configuredProjectLookup.get(url) || null,
    }))
    const uniqueProjectItems = projectImages.filter(
      (item, index) =>
        projectImages.findIndex((candidate) => candidate.url === item.url) === index &&
        !configuredDesktop.includes(item.url),
    )

    return shuffleItems([...configuredItems, ...uniqueProjectItems])
  }, [initialProjects, siteSettings?.heroImages])

  const mobileImages = useMemo<HeroItem[]>(() => {
    const configuredMobile = parseUrlList(siteSettings?.heroImagesMobile)
    const projectImagesMobile = initialProjects
      .filter((project) => project.showOnHomepage)
      .map((project) => ({
        url: (project.mainImageMobile || project.mainImage || '').trim(),
        projectId: project.id,
      }))
      .filter((item) => isValidMediaUrl(item.url))

    if (configuredMobile.length > 0) {
      const configuredProjectLookup = new Map(projectImagesMobile.map((item) => [item.url, item.projectId]))
      const configuredItems = configuredMobile.map((url) => ({
        url,
        projectId: configuredProjectLookup.get(url) || null,
      }))
      const uniqueProjectItems = projectImagesMobile.filter(
        (item, index) =>
          projectImagesMobile.findIndex((candidate) => candidate.url === item.url) === index &&
          !configuredMobile.includes(item.url),
      )

      return shuffleItems([...configuredItems, ...uniqueProjectItems])
    }

    return projectImagesMobile.length > 0 ? shuffleItems(projectImagesMobile) : desktopImages
  }, [desktopImages, initialProjects, siteSettings?.heroImagesMobile])

  const heroImages = isMobile ? mobileImages : desktopImages
  const resolvedHeroIndex = heroImages.length > 0 ? activeHeroIndex % heroImages.length : 0
  const activeHeroItem = heroImages[resolvedHeroIndex] || null
  const chatGuideMessages = useMemo(
    () =>
      getUniqueMessages([
        language === 'en' ? 'who we are' : language === 'pt' ? 'quem somos' : 'quienes somos',
        language === 'en' ? 'what we do' : language === 'pt' ? 'o que fazemos' : 'que hacemos',
        language === 'en' ? 'view projects' : language === 'pt' ? 'ver projetos' : 'ver proyectos',
        language === 'en' ? 'request a quote' : language === 'pt' ? 'pedir cotacao' : 'cotizar una obra',
        ...aiHeroMessages.filter((message) => message.trim().length > 0 && message.trim().length <= 34).slice(0, 2),
      ]),
    [aiHeroMessages, language],
  )
  const heroRotationMs = clampNumber(siteSettings?.heroRotationMs, 8600, 2500, 20000)
  const advanceHero = () => {
    setActiveHeroIndex((current) => (current + 1) % Math.max(heroImages.length, 1))
  }
  const rewindHero = () => {
    setActiveHeroIndex((current) => (current - 1 + Math.max(heroImages.length, 1)) % Math.max(heroImages.length, 1))
  }

  useEffect(() => {
    if (heroImages.length <= 1 || !activeHeroItem || isVideoUrl(activeHeroItem.url)) {
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
  const heroControlClass =
    'inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/24 bg-black/18 text-white shadow-[0_18px_48px_rgba(0,0,0,0.24)] backdrop-blur-md transition-colors hover:border-white/58 hover:bg-black/34 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300'
  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]

    touchStartXRef.current = touch?.clientX ?? null
    touchStartYRef.current = touch?.clientY ?? null
    didSwipeRef.current = false
  }
  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (!isMobile || heroImages.length <= 1) {
      return
    }

    const startX = touchStartXRef.current
    const startY = touchStartYRef.current
    const touch = event.changedTouches[0]

    touchStartXRef.current = null
    touchStartYRef.current = null

    if (startX == null || startY == null || !touch) {
      return
    }

    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY

    if (Math.abs(deltaX) < 42 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return
    }

    didSwipeRef.current = true

    if (deltaX < 0) {
      advanceHero()
      return
    }

    rewindHero()
  }
  const handleProjectHeroClick = () => {
    if (didSwipeRef.current) {
      didSwipeRef.current = false
      return
    }

    if (activeHeroItem?.projectId) {
      router.push(`/proyectos/${activeHeroItem.projectId}`)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950">
      <SiteHeader tone="light" chatGuideMessages={chatGuideMessages} siteSettings={siteSettings} />

      <section className="relative min-h-screen" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="absolute inset-0">
          {heroImages.length > 0 ? (
            <AnimatePresence mode="sync">
              {heroImages.map((item, index) =>
                index === resolvedHeroIndex ? (
                  isVideoUrl(item.url) ? (
                    <motion.video
                      key={`${item.url}-${isMobile ? 'mobile' : 'desktop'}`}
                      src={item.url}
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
                      key={`${item.url}-${isMobile ? 'mobile' : 'desktop'}`}
                      src={item.url}
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

        {activeHeroItem?.projectId ? (
          <button
            type="button"
            aria-label="Abrir proyecto"
            onClick={handleProjectHeroClick}
            className="absolute inset-0 z-10 cursor-pointer"
          />
        ) : null}

        {heroImages.length > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 hidden justify-center px-4 md:flex">
            <div className="pointer-events-auto flex items-center gap-3">
              <button type="button" onClick={rewindHero} className={heroControlClass} aria-label="Imagen anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={advanceHero} className={heroControlClass} aria-label="Imagen siguiente">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
