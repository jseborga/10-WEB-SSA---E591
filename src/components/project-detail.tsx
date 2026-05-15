'use client'

import { useState, useEffect, useMemo, useCallback, useRef, type TouchEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, MapPin, Calendar, Ruler, Building2, ArrowRight, Link2, Instagram, Facebook, Linkedin, Youtube, Share2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/language-context'
import { buildProjectMediaItems, formatTagLabel, normalizeTag, parseTagList } from '@/lib/public-site'
import { buildSocialShareLinks, shareLink } from '@/lib/share'

interface Project {
  id: string
  title: string
  titleEn?: string | null
  titlePt?: string | null
  description: string | null
  descriptionEn?: string | null
  descriptionPt?: string | null
  fullDescription?: string | null
  fullDescriptionEn?: string | null
  fullDescriptionPt?: string | null
  category: string
  location: string | null
  year: number | null
  area: string | null
  mainImage?: string | null
  mainImageAlt?: string | null
  mainImageCaption?: string | null
  mainImageMobile?: string | null
  gallery?: string | null
  galleryMobile?: string | null
  videoUrl?: string | null
  client?: string | null
  referenceUrl?: string | null
  instagramUrl?: string | null
  facebookUrl?: string | null
  linkedinUrl?: string | null
  youtubeUrl?: string | null
  seoKeywords?: string | null
  projectTags?: string | null
  galleryAnnotations?: string | null
  galleryMobileAnnotations?: string | null
  status?: string | null
}

interface ProjectDetailProps {
  project: Project | null
  similarProjects: Project[]
  onClose: () => void
}

const categoryLabels: Record<string, Record<string, string>> = {
  es: { residencial: 'Residencial', comercial: 'Comercial', industrial: 'Industrial', renovacion: 'Renovación' },
  en: { residencial: 'Residential', comercial: 'Commercial', industrial: 'Industrial', renovacion: 'Renovation' },
  pt: { residencial: 'Residencial', comercial: 'Comercial', industrial: 'Industrial', renovacion: 'Renovação' }
}

const PROJECT_DETAIL_IMAGE_HOLD_MS = 15600
const PROJECT_DETAIL_IMAGE_TRANSITION_S = 3.1
const PROJECT_DETAIL_CRAWL_MOBILE_S = 48
const PROJECT_DETAIL_CRAWL_DESKTOP_S = 52

// Internal component with key-based reset
function ProjectDetailContent({ project, similarProjects, onClose }: { project: Project; similarProjects: Project[]; onClose: () => void }) {
  const { language } = useLanguage()
  const router = useRouter()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isImageExpanded, setIsImageExpanded] = useState(false)
  const [activeGalleryFilter, setActiveGalleryFilter] = useState('all')
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)
  const didSwipeRef = useRef(false)

  const getTitle = useCallback(() => {
    if (language === 'en' && project.titleEn) return project.titleEn
    if (language === 'pt' && project.titlePt) return project.titlePt
    return project.title
  }, [language, project])

  const getFullDescription = useCallback(() => {
    if (language === 'en' && project.fullDescriptionEn) return project.fullDescriptionEn
    if (language === 'pt' && project.fullDescriptionPt) return project.fullDescriptionPt
    return project.fullDescription || project.description
  }, [language, project])

  const getCategoryLabel = useCallback(
    () => categoryLabels[language]?.[project.category] || project.category,
    [language, project.category],
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mediaQuery.matches)

    update()
    mediaQuery.addEventListener('change', update)

    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  const projectTags = useMemo(
    () => parseTagList(project.projectTags || project.seoKeywords || ''),
    [project.projectTags, project.seoKeywords],
  )
  const mediaItems = useMemo(
    () =>
      buildProjectMediaItems(project, {
        isMobile,
        fallbackUrl: '/images/projects/house1.png',
      }),
    [isMobile, project],
  )
  const galleryFilters = useMemo(() => {
    const categories = Array.from(new Set(mediaItems.map((item) => item.category.trim()).filter(Boolean)))
    const tags = Array.from(new Set(mediaItems.flatMap((item) => item.tags))).filter(Boolean)

    return [
      { key: 'all', label: language === 'en' ? 'All' : language === 'pt' ? 'Tudo' : 'Todo', match: () => true },
      ...categories.map((category) => ({
        key: `category:${normalizeTag(category)}`,
        label: category,
        match: (item: (typeof mediaItems)[number]) => normalizeTag(item.category) === normalizeTag(category),
      })),
      ...tags
        .filter((tag) => !categories.some((category) => normalizeTag(category) === tag))
        .map((tag) => ({
          key: `tag:${tag}`,
          label: formatTagLabel(tag),
          match: (item: (typeof mediaItems)[number]) => item.tags.includes(tag),
        })),
    ]
  }, [language, mediaItems])
  const resolvedActiveGalleryFilter = galleryFilters.some((item) => item.key === activeGalleryFilter) ? activeGalleryFilter : 'all'
  const filteredMediaItems = useMemo(() => {
    const activeFilter = galleryFilters.find((item) => item.key === resolvedActiveGalleryFilter) || galleryFilters[0]
    return mediaItems.filter((item) => activeFilter.match(item))
  }, [galleryFilters, mediaItems, resolvedActiveGalleryFilter])
  const resolvedCurrentImageIndex = currentImageIndex < filteredMediaItems.length ? currentImageIndex : 0
  const currentMedia = filteredMediaItems[resolvedCurrentImageIndex] || filteredMediaItems[0] || mediaItems[0]
  const technicalSubtitle = useMemo(
    () =>
      [getCategoryLabel(), project.location, project.year ? String(project.year) : '', project.area, project.client]
        .filter(Boolean)
        .join(' · '),
    [getCategoryLabel, project.area, project.client, project.location, project.year],
  )
  const crawlSections = useMemo(
    () =>
      [
        {
          eyebrow: getCategoryLabel(),
          title: getTitle(),
          body: project.description || getFullDescription() || getTitle(),
          extended: getFullDescription() || project.description || '',
          meta: [project.location, project.year ? String(project.year) : '', project.area, project.client].filter(Boolean),
        },
        {
          eyebrow: getCategoryLabel(),
          title: getTitle(),
          body: project.description || getFullDescription() || getTitle(),
          extended: getFullDescription() || project.description || '',
          meta: [project.location, project.year ? String(project.year) : '', project.area, project.client].filter(Boolean),
        },
      ],
    [getCategoryLabel, getFullDescription, getTitle, project.area, project.client, project.description, project.location, project.year],
  )

  const nextImage = useCallback(() => {
    setCurrentImageIndex((prev) => (prev + 1) % Math.max(filteredMediaItems.length, 1))
  }, [filteredMediaItems.length])

  const prevImage = useCallback(() => {
    setCurrentImageIndex((prev) => (prev - 1 + Math.max(filteredMediaItems.length, 1)) % Math.max(filteredMediaItems.length, 1))
  }, [filteredMediaItems.length])

  useEffect(() => {
    if (filteredMediaItems.length <= 1) {
      return
    }

    const interval = window.setInterval(() => {
      setIsLoading(true)
      nextImage()
    }, PROJECT_DETAIL_IMAGE_HOLD_MS)

    return () => window.clearInterval(interval)
  }, [filteredMediaItems.length, nextImage])

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]

    touchStartXRef.current = touch?.clientX ?? null
    touchStartYRef.current = touch?.clientY ?? null
    didSwipeRef.current = false
  }

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (!isMobile || filteredMediaItems.length <= 1) {
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
    setIsLoading(true)

    if (deltaX < 0) {
      nextImage()
      return
    }

    prevImage()
  }

  const handleExpandImage = () => {
    if (didSwipeRef.current) {
      didSwipeRef.current = false
      return
    }

    setIsImageExpanded(true)
  }

  const handleOpenProjectPage = () => {
    onClose()
    router.push(`/proyectos/${project.id}`)
  }

  const projectLinks = useMemo(
    () =>
      [
        { key: 'reference', label: 'Referencia', href: project.referenceUrl || '', icon: Link2 },
        { key: 'instagram', label: 'Instagram', href: project.instagramUrl || '', icon: Instagram },
        { key: 'facebook', label: 'Facebook', href: project.facebookUrl || '', icon: Facebook },
        { key: 'linkedin', label: 'LinkedIn', href: project.linkedinUrl || '', icon: Linkedin },
        { key: 'youtube', label: 'YouTube', href: project.youtubeUrl || '', icon: Youtube },
      ].filter((item) => item.href.trim()),
    [project.facebookUrl, project.instagramUrl, project.linkedinUrl, project.referenceUrl, project.youtubeUrl],
  )
  const shareCopy =
    language === 'en'
      ? {
          share: 'Share project',
          open: 'Open page',
          copied: 'Project link copied',
          error: 'Could not share the project',
          gallery: 'Gallery filters',
          tags: 'Project tags',
        }
      : language === 'pt'
        ? {
            share: 'Compartilhar projeto',
            open: 'Abrir pagina',
            copied: 'Link do projeto copiado',
            error: 'Nao foi possivel compartilhar o projeto',
            gallery: 'Filtros da galeria',
            tags: 'Etiquetas do projeto',
          }
        : {
            share: 'Compartir proyecto',
            open: 'Abrir pagina',
            copied: 'Enlace del proyecto copiado',
            error: 'No se pudo compartir el proyecto',
            gallery: 'Filtros de galeria',
            tags: 'Etiquetas del proyecto',
          }
  const shareUrl = typeof window !== 'undefined' ? new URL(`/proyectos/${project.id}`, window.location.origin).toString() : `/proyectos/${project.id}`
  const socialShareLinks = useMemo(
    () =>
      buildSocialShareLinks({
        title: getTitle(),
        text: project.description || getTitle(),
        url: shareUrl,
      }),
    [getTitle, project.description, shareUrl],
  )

  const handleShareProject = useCallback(async () => {
    try {
      const result = await shareLink({
        title: getTitle(),
        text: project.description || getTitle(),
        url: shareUrl,
      })

      if (result === 'copied') {
        toast.success(shareCopy.copied)
      }
    } catch {
      toast.error(shareCopy.error)
    }
  }, [getTitle, project.description, shareCopy.copied, shareCopy.error, shareUrl])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/90 overflow-y-auto"
      onClick={onClose}
    >
      <div className="min-h-screen py-4 sm:py-8" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-[70] w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="max-w-7xl mx-auto px-4">
          {/* Gallery */}
          <div className="relative mb-6 sm:mb-8" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <div
              className="relative min-h-[72vh] overflow-hidden rounded-[28px] bg-zinc-900 sm:min-h-[78vh]"
              onClick={(event) => {
                event.stopPropagation()
                handleExpandImage()
              }}
            >
              <AnimatePresence mode="sync">
                <motion.div
                  key={currentMedia?.url || 'fallback-image'}
                  initial={{ opacity: 0, scale: 1.03 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.01 }}
                  transition={{ duration: PROJECT_DETAIL_IMAGE_TRANSITION_S, ease: 'easeOut' }}
                  className="absolute inset-0"
                >
                  <Image
                    src={currentMedia?.url || '/images/projects/house1.png'}
                    alt={currentMedia?.alt || project.mainImageAlt || getTitle()}
                    fill
                    className={isMobile ? 'object-contain bg-zinc-950' : 'object-cover'}
                    onLoad={() => setIsLoading(false)}
                    priority
                  />
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}

              {/* Navigation arrows */}
              {filteredMediaItems.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsLoading(true); prevImage() }}
                    className="absolute left-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-black/70 md:flex md:h-12 md:w-12"
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsLoading(true); nextImage() }}
                    className="absolute right-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 transition-colors hover:bg-black/70 md:flex md:h-12 md:w-12"
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </button>
                </>
              )}

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-5 sm:px-6 sm:pb-6">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleOpenProjectPage()
                  }}
                  className={`pointer-events-auto relative overflow-hidden text-left transition-colors ${
                    isMobile ? 'w-full' : 'w-[min(56vw,860px)]'
                  }`}
                >
                  <div className="relative mb-4 space-y-2">
                    <h2 className="text-3xl font-light tracking-tight text-white sm:text-5xl">
                      {getTitle()}
                    </h2>
                    <p
                      className="text-xs uppercase tracking-[0.18em] text-white/72 sm:text-[13px]"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {technicalSubtitle}
                    </p>
                    <p
                      className="text-sm leading-6 text-white/82 sm:max-w-2xl sm:text-base sm:leading-7"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {currentMedia?.label || project.description || getTitle()}
                    </p>
                  </div>
                  <div className={`relative overflow-hidden ${isMobile ? 'h-20' : 'h-28'}`}>
                    <div className={`absolute inset-x-0 top-0 origin-bottom ${isMobile ? '[transform:perspective(700px)_rotateX(16deg)]' : '[transform:perspective(900px)_rotateX(24deg)]'}`}>
                      <div
                        className="will-change-transform"
                        style={{ animation: `projectDetailCrawl ${isMobile ? PROJECT_DETAIL_CRAWL_MOBILE_S : PROJECT_DETAIL_CRAWL_DESKTOP_S}s linear infinite` }}
                      >
                      {crawlSections.map((section, index) => (
                        <div key={`${section.title}-${index}`} className={`${index > 0 ? 'pt-10' : ''}`}>
                          <p
                            className="text-center text-sm leading-7 text-white/88 sm:text-base sm:leading-8"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 4,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {section.body}
                          </p>
                          {section.extended ? (
                            <p
                              className="mt-3 text-center text-sm leading-7 text-white/76 sm:text-base sm:leading-8"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 4,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {section.extended}
                            </p>
                          ) : null}
                          {section.meta.length > 0 ? (
                            <div className="mt-4 flex flex-wrap justify-center gap-3 text-[10px] uppercase tracking-[0.16em] text-white/58 sm:text-[11px]">
                              {section.meta.map((item) => (
                                <span key={`${index}-${item}`}>{item}</span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                      </div>
                    </div>
                  </div>
                  <div className="relative mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-white/66 sm:mt-3 sm:text-[11px]">
                    <span>{shareCopy.open}</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              </div>
            </div>

            {currentMedia?.label ? <p className="mt-3 text-sm text-zinc-400">{currentMedia.label}</p> : null}

            {galleryFilters.length > 1 ? (
              <div className="mt-4 space-y-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">{shareCopy.gallery}</p>
                <div className="flex flex-wrap gap-2">
                  {galleryFilters.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setIsLoading(true)
                        setActiveGalleryFilter(filter.key)
                        setCurrentImageIndex(0)
                      }}
                      className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                        resolvedActiveGalleryFilter === filter.key
                          ? 'border-white bg-white text-zinc-900'
                          : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-900'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Thumbnails */}
            {filteredMediaItems.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                {filteredMediaItems.map((item, idx) => (
                  <button
                    key={`${item.url}-${idx}`}
                    onClick={(e) => { e.stopPropagation(); setIsLoading(true); setCurrentImageIndex(idx) }}
                    className={`relative w-16 h-12 sm:w-20 sm:h-14 flex-shrink-0 rounded overflow-hidden transition-opacity ${
                      idx === resolvedCurrentImageIndex ? 'ring-2 ring-white' : 'opacity-50 hover:opacity-100'
                    }`}
                  >
                    <Image src={item.url} alt={item.alt} fill className={isMobile ? 'object-contain bg-zinc-950' : 'object-cover'} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {project.videoUrl && (
            <div className="mb-6 sm:mb-8">
              <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-black">
                <video
                  src={project.videoUrl}
                  controls
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Main info */}
            <div className="lg:col-span-2">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">{getCategoryLabel()}</span>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-light text-white mt-2 mb-4">{getTitle()}</h1>
              {projectTags.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  {projectTags.map((tag) => (
                    <span key={tag} className="rounded-full border border-zinc-700 px-2.5 py-1 font-mono text-[11px] text-zinc-300">
                      {formatTagLabel(tag)}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mb-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleShareProject()}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-2 text-xs text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {shareCopy.share}
                </button>
                <a
                  href={`/proyectos/${project.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-2 text-xs text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {shareCopy.open}
                </a>
                <a
                  href={socialShareLinks.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-2 text-xs text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
                >
                  <Send className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
                <a
                  href={socialShareLinks.facebook}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-2 text-xs text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
                >
                  <Facebook className="h-3.5 w-3.5" />
                  Facebook
                </a>
                <a
                  href={socialShareLinks.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-2 text-xs text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  LinkedIn
                </a>
              </div>
               
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed mb-6">
                {getFullDescription()}
              </p>

              {/* Project details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-t border-zinc-800">
                {project.location && (
                  <div>
                    <div className="flex items-center gap-2 text-zinc-500 mb-1">
                      <MapPin className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-wider">Ubicación</span>
                    </div>
                    <p className="text-sm text-white">{project.location}</p>
                  </div>
                )}
                {project.year && (
                  <div>
                    <div className="flex items-center gap-2 text-zinc-500 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-wider">Año</span>
                    </div>
                    <p className="text-sm text-white">{project.year}</p>
                  </div>
                )}
                {project.area && (
                  <div>
                    <div className="flex items-center gap-2 text-zinc-500 mb-1">
                      <Ruler className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-wider">Área</span>
                    </div>
                    <p className="text-sm text-white">{project.area}</p>
                  </div>
                )}
                {project.client && (
                  <div>
                    <div className="flex items-center gap-2 text-zinc-500 mb-1">
                      <Building2 className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-wider">Cliente</span>
                    </div>
                    <p className="text-sm text-white">{project.client}</p>
                  </div>
                )}
              </div>

              {projectLinks.length > 0 && (
                <div className="border-t border-zinc-800 pt-6">
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Referencias y redes</p>
                  <div className="flex flex-wrap gap-2">
                    {projectLinks.map((item) => {
                      const Icon = item.icon

                      return (
                        <a
                          key={item.key}
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-2 text-xs text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {item.label}
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Similar projects */}
            {similarProjects.length > 0 && (
              <div className="lg:col-span-1">
                <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-4">Proyectos similares</h3>
                <div className="space-y-4">
                  {similarProjects.slice(0, 3).map((similar) => (
                    <a
                      key={similar.id}
                      href={`#proyecto-${similar.id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        window.dispatchEvent(new CustomEvent('navigateProject', { detail: similar.id }))
                      }}
                      className="flex gap-3 p-3 rounded-lg bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors group"
                    >
                      <div className="relative w-20 h-16 flex-shrink-0 rounded overflow-hidden">
                        <Image
                          src={(isMobile ? similar.mainImageMobile || similar.mainImage : similar.mainImage || similar.mainImageMobile) || '/images/projects/house1.png'}
                          alt=""
                          fill
                          className={isMobile ? 'object-contain bg-zinc-950' : 'object-cover'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-light text-white truncate group-hover:text-zinc-300 transition-colors">
                          {language === 'en' && similar.titleEn ? similar.titleEn : 
                           language === 'pt' && similar.titlePt ? similar.titlePt : similar.title}
                        </h4>
                        <p className="text-xs text-zinc-500 mt-1">{similar.location}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-600 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes projectDetailCrawl {
          0% {
            transform: translate3d(0, 16%, 0);
          }

          100% {
            transform: translate3d(0, -58%, 0);
          }
        }
      `}</style>
      <AnimatePresence>
        {isImageExpanded ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/95"
            onClick={(event) => {
              event.stopPropagation()
              setIsImageExpanded(false)
            }}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setIsImageExpanded(false)
              }}
              className="absolute right-4 top-4 z-[95] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-3">
              <img
                src={currentMedia?.url || '/images/projects/house1.png'}
                alt={currentMedia?.alt || project.mainImageAlt || getTitle()}
                className="h-full w-full object-contain"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
            {filteredMediaItems.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    prevImage()
                  }}
                  className="absolute left-4 top-1/2 z-[95] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    nextImage()
                  }}
                  className="absolute right-4 top-1/2 z-[95] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}

export function ProjectDetail({ project, similarProjects, onClose }: ProjectDetailProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [])

  if (!project) return null

  return (
    <AnimatePresence>
      {/* Key prop resets all internal state when project changes */}
      <ProjectDetailContent
        key={project.id}
        project={project}
        similarProjects={similarProjects}
        onClose={onClose}
      />
    </AnimatePresence>
  )
}
