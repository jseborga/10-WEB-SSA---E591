'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { SiteHeader } from '@/components/site-header'
import { PublicProject, PublicSiteSettings, isVideoUrl, parseUrlList } from '@/lib/public-site'

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

export default function HomePageClient({
  initialProjects = [],
  siteSettings,
}: HomePageClientProps) {
  const [activeHeroIndex, setActiveHeroIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

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
  const advanceHero = () => {
    setActiveHeroIndex((current) => (current + 1) % Math.max(heroImages.length, 1))
  }

  useEffect(() => {
    if (heroImages.length <= 1 || !activeHeroItem || isVideoUrl(activeHeroItem)) {
      return
    }

    const timeout = window.setTimeout(() => {
      advanceHero()
    }, 8600)

    return () => window.clearTimeout(timeout)
  }, [activeHeroItem, heroImages.length])

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
      </section>
    </main>
  )
}
