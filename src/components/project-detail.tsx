'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, MapPin, Calendar, Ruler, Building2, ArrowRight, Link2, Instagram, Facebook, Linkedin, Youtube } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'

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

// Internal component with key-based reset
function ProjectDetailContent({ project, similarProjects, onClose }: { project: Project; similarProjects: Project[]; onClose: () => void }) {
  const { language } = useLanguage()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

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

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mediaQuery.matches)

    update()
    mediaQuery.addEventListener('change', update)

    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  // Parse gallery images
  const allImages = useMemo(() => {
    const rawGallery = isMobile ? project.galleryMobile || project.gallery : project.gallery
    const leadImage = isMobile ? project.mainImageMobile || project.mainImage : project.mainImage
    let galleryImages: string[] = []
    if (rawGallery) {
      try {
        galleryImages = JSON.parse(rawGallery)
      } catch {
        galleryImages = []
      }
    }
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

  const getCategoryLabel = () => categoryLabels[language]?.[project.category] || project.category
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
          <div className="relative mb-6 sm:mb-8">
            <div className="relative aspect-[16/9] sm:aspect-[21/9] rounded-lg overflow-hidden bg-zinc-900">
              <Image
                src={allImages[currentImageIndex]}
                alt={project.mainImageAlt || getTitle()}
                fill
                className="object-cover"
                onLoad={() => setIsLoading(false)}
                priority
              />
              
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}

              {/* Navigation arrows */}
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); prevImage() }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); nextImage() }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </button>
                </>
              )}
            </div>

            {project.mainImageCaption && (
              <p className="mt-3 text-sm text-zinc-400">{project.mainImageCaption}</p>
            )}

            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx) }}
                    className={`relative w-16 h-12 sm:w-20 sm:h-14 flex-shrink-0 rounded overflow-hidden transition-opacity ${
                      idx === currentImageIndex ? 'ring-2 ring-white' : 'opacity-50 hover:opacity-100'
                    }`}
                  >
                    <Image src={img} alt="" fill className="object-cover" />
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
                          src={(isMobile ? similar.mainImageMobile || similar.mainImage : similar.mainImage) || '/images/projects/house1.png'}
                          alt=""
                          fill
                          className="object-cover"
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
