'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Calendar, Link2, Linkedin, MapPin, Building2, Instagram, Facebook, Youtube, Ruler, ChevronLeft, ChevronRight, Share2, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { SiteHeader } from '@/components/site-header'
import { useLanguage } from '@/lib/language-context'
import { formatCategoryLabel, parseUrlList, type PublicProject, type PublicSiteSettings } from '@/lib/public-site'
import { buildSocialShareLinks, shareLink } from '@/lib/share'

interface ProjectPageClientProps {
  project: PublicProject
  similarProjects: PublicProject[]
  siteSettings?: PublicSiteSettings
}

const categoryLabels: Record<string, Record<string, string>> = {
  es: { residencial: 'Residencial', comercial: 'Comercial', industrial: 'Industrial', renovacion: 'Renovacion' },
  en: { residencial: 'Residential', comercial: 'Commercial', industrial: 'Industrial', renovacion: 'Renovation' },
  pt: { residencial: 'Residencial', comercial: 'Comercial', industrial: 'Industrial', renovacion: 'Renovacao' },
}

export function ProjectPageClient({ project, similarProjects, siteSettings }: ProjectPageClientProps) {
  const { language } = useLanguage()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isImageExpanded, setIsImageExpanded] = useState(false)

  const getTitle = useCallback(() => {
    if (language === 'en' && project.titleEn) return project.titleEn
    if (language === 'pt' && project.titlePt) return project.titlePt
    return project.title
  }, [language, project.title, project.titleEn, project.titlePt])

  const getDescription = useCallback(() => {
    if (language === 'en' && project.fullDescriptionEn) return project.fullDescriptionEn || project.description || ''
    if (language === 'pt' && project.fullDescriptionPt) return project.fullDescriptionPt || project.description || ''
    return project.fullDescription || project.description || ''
  }, [language, project.description, project.fullDescription, project.fullDescriptionEn, project.fullDescriptionPt])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mediaQuery.matches)

    update()
    mediaQuery.addEventListener('change', update)

    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  const allImages = useMemo(() => {
    const rawGallery = isMobile ? project.galleryMobile || project.gallery : project.gallery
    const leadImage = isMobile ? project.mainImageMobile || project.mainImage : project.mainImage
    const galleryImages = parseUrlList(rawGallery)

    return leadImage
      ? [leadImage, ...galleryImages]
      : galleryImages.length > 0
        ? galleryImages
        : ['/images/projects/house1.png']
  }, [isMobile, project.gallery, project.galleryMobile, project.mainImage, project.mainImageMobile])

  const nextImage = useCallback(() => {
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length)
  }, [allImages.length])

  const prevImage = useCallback(() => {
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length)
  }, [allImages.length])

  const detailCopy =
    language === 'en'
      ? {
          back: 'Back to projects',
          share: 'Share project',
          links: 'References and social',
          similar: 'Related projects',
          location: 'Location',
          year: 'Year',
          area: 'Area',
          client: 'Client',
        }
      : language === 'pt'
        ? {
            back: 'Voltar para projetos',
            share: 'Compartilhar projeto',
            links: 'Referencias e redes',
            similar: 'Projetos relacionados',
            location: 'Localizacao',
            year: 'Ano',
            area: 'Area',
            client: 'Cliente',
          }
        : {
            back: 'Volver a proyectos',
            share: 'Compartir proyecto',
            links: 'Referencias y redes',
            similar: 'Proyectos similares',
            location: 'Ubicacion',
            year: 'Ano',
            area: 'Area',
            client: 'Cliente',
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

  const shareUrl = typeof window !== 'undefined' ? new URL(`/proyectos/${project.id}`, window.location.origin).toString() : `/proyectos/${project.id}`
  const pageTitle = getTitle()
  const pageDescription = getDescription()
  const socialShareLinks = useMemo(
    () =>
      buildSocialShareLinks({
        title: pageTitle,
        text: pageDescription || pageTitle,
        url: shareUrl,
      }),
    [pageDescription, pageTitle, shareUrl],
  )

  const handleShareProject = useCallback(async () => {
    try {
      const result = await shareLink({
        title: pageTitle,
        text: pageDescription || pageTitle,
        url: shareUrl,
      })

      if (result === 'copied') {
        toast.success(language === 'en' ? 'Project link copied' : language === 'pt' ? 'Link do projeto copiado' : 'Enlace del proyecto copiado')
      }
    } catch {
      toast.error(language === 'en' ? 'Could not share the project' : language === 'pt' ? 'Nao foi possivel compartilhar o projeto' : 'No se pudo compartir el proyecto')
    }
  }, [language, pageDescription, pageTitle, shareUrl])

  const categoryLabel = categoryLabels[language]?.[project.category] || formatCategoryLabel(project.category)

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <SiteHeader tone="dark" />

      <section className="mx-auto max-w-7xl px-4 pb-14 pt-28 sm:px-6 sm:pt-32">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{siteSettings?.companyName || 'SSA Ingenieria'}</p>
            <span className="mt-4 inline-flex rounded-full border border-zinc-200 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-zinc-600">
              {categoryLabel}
            </span>
            <h1 className="mt-4 text-3xl font-light tracking-tight sm:text-5xl">{pageTitle}</h1>
            {project.description ? <p className="mt-4 max-w-2xl text-sm text-zinc-600 sm:text-base">{project.description}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/proyectos"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-xs uppercase tracking-[0.22em] text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950"
            >
              {detailCopy.back}
            </Link>
            <button
              type="button"
              onClick={() => void handleShareProject()}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-900 bg-zinc-900 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white transition-colors hover:bg-zinc-800"
            >
              <Share2 className="h-4 w-4" />
              {detailCopy.share}
            </button>
            <a
              href={socialShareLinks.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-xs uppercase tracking-[0.22em] text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950"
            >
              <Send className="h-4 w-4" />
              WhatsApp
            </a>
            <a
              href={socialShareLinks.facebook}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-xs uppercase tracking-[0.22em] text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950"
            >
              <Facebook className="h-4 w-4" />
              Facebook
            </a>
            <a
              href={socialShareLinks.linkedin}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-xs uppercase tracking-[0.22em] text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950"
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </a>
          </div>
        </div>

        <div className="mt-8 space-y-8">
          <div className="relative overflow-hidden rounded-[28px] bg-zinc-100">
            <div
              className="relative aspect-[4/5] sm:aspect-[21/9]"
              onClick={() => setIsImageExpanded(true)}
            >
              <Image
                src={allImages[currentImageIndex]}
                alt={project.mainImageAlt || pageTitle}
                fill
                className={isMobile ? 'object-contain' : 'object-cover'}
                onLoad={() => setIsLoading(false)}
                priority
              />

              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                </div>
              ) : null}

              {allImages.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setIsLoading(true)
                      prevImage()
                    }}
                    className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setIsLoading(true)
                      nextImage()
                    }}
                    className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {project.mainImageCaption ? <p className="text-sm text-zinc-500">{project.mainImageCaption}</p> : null}

          {allImages.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allImages.map((imageUrl, index) => (
                <button
                  key={`${imageUrl}-${index}`}
                  type="button"
                  onClick={() => {
                    setIsLoading(true)
                    setCurrentImageIndex(index)
                  }}
                  className={`relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-2xl border transition-all ${
                    index === currentImageIndex ? 'border-zinc-900' : 'border-zinc-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <Image src={imageUrl} alt="" fill className={isMobile ? 'object-contain bg-zinc-100' : 'object-cover'} />
                </button>
              ))}
            </div>
          ) : null}

          {project.videoUrl ? (
            <div className="overflow-hidden rounded-[28px] bg-black">
              <div className="relative aspect-[16/9]">
                <video src={project.videoUrl} controls preload="metadata" className="h-full w-full object-cover" />
              </div>
            </div>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4 border-t border-zinc-200 pt-6 sm:grid-cols-4">
                {project.location ? (
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-zinc-500">
                      <MapPin className="h-4 w-4" />
                      <span className="text-xs uppercase tracking-[0.22em]">{detailCopy.location}</span>
                    </div>
                    <p className="text-sm text-zinc-900">{project.location}</p>
                  </div>
                ) : null}
                {project.year ? (
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-zinc-500">
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs uppercase tracking-[0.22em]">{detailCopy.year}</span>
                    </div>
                    <p className="text-sm text-zinc-900">{project.year}</p>
                  </div>
                ) : null}
                {project.area ? (
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-zinc-500">
                      <Ruler className="h-4 w-4" />
                      <span className="text-xs uppercase tracking-[0.22em]">{detailCopy.area}</span>
                    </div>
                    <p className="text-sm text-zinc-900">{project.area}</p>
                  </div>
                ) : null}
                {project.client ? (
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-zinc-500">
                      <Building2 className="h-4 w-4" />
                      <span className="text-xs uppercase tracking-[0.22em]">{detailCopy.client}</span>
                    </div>
                    <p className="text-sm text-zinc-900">{project.client}</p>
                  </div>
                ) : null}
              </div>

              <div className="max-w-3xl text-base leading-8 text-zinc-700">
                {pageDescription || 'Sin descripcion ampliada disponible todavia.'}
              </div>

              {projectLinks.length > 0 ? (
                <div className="border-t border-zinc-200 pt-6">
                  <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-500">{detailCopy.links}</p>
                  <div className="flex flex-wrap gap-2">
                    {projectLinks.map((item) => {
                      const Icon = item.icon

                      return (
                        <a
                          key={item.key}
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-2 text-xs text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {item.label}
                        </a>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="space-y-4">
              <h2 className="text-xs uppercase tracking-[0.22em] text-zinc-500">{detailCopy.similar}</h2>
              <div className="space-y-3">
                {similarProjects.map((similar) => (
                  <Link
                    key={similar.id}
                    href={`/proyectos/${similar.id}`}
                    className="group flex gap-3 rounded-[22px] border border-zinc-200 p-3 transition-colors hover:border-zinc-400"
                  >
                    <div className="relative h-16 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-zinc-100">
                      <Image
                        src={(similar.mainImage || similar.mainImageMobile) || '/images/projects/house1.png'}
                        alt=""
                        fill
                        className={isMobile ? 'object-contain bg-zinc-100' : 'object-cover'}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-medium text-zinc-900">
                        {language === 'en' && similar.titleEn ? similar.titleEn : language === 'pt' && similar.titlePt ? similar.titlePt : similar.title}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">{similar.location || formatCategoryLabel(similar.category)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>
      <AnimatePresence>
        {isImageExpanded ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/95"
            onClick={() => setIsImageExpanded(false)}
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
            <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
              <img
                src={allImages[currentImageIndex]}
                alt={project.mainImageAlt || pageTitle}
                className="max-h-full max-w-full object-contain"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
            {allImages.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    prevImage()
                  }}
                  className="absolute left-4 top-1/2 z-[95] inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    nextImage()
                  }}
                  className="absolute right-4 top-1/2 z-[95] inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  )
}
