'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, MapPin } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { PublicProject, PublicSiteSettings, buildProjectMediaItems, formatCategoryLabel, getProjectCategories } from '@/lib/public-site'
import { SiteHeader } from '@/components/site-header'
import { ProjectDetail } from '@/components/project-detail'

interface ProjectsPageClientProps {
  projects: PublicProject[]
  siteSettings?: PublicSiteSettings
}

function getLocalizedText(project: PublicProject, language: 'es' | 'en' | 'pt', field: 'title' | 'description') {
  if (field === 'title') {
    if (language === 'en' && project.titleEn) return project.titleEn
    if (language === 'pt' && project.titlePt) return project.titlePt
    return project.title
  }

  if (language === 'en' && project.descriptionEn) return project.descriptionEn
  if (language === 'pt' && project.descriptionPt) return project.descriptionPt
  return project.description || ''
}

function getLocalizedNarrative(project: PublicProject, language: 'es' | 'en' | 'pt') {
  if (language === 'en' && project.fullDescriptionEn) return project.fullDescriptionEn
  if (language === 'pt' && project.fullDescriptionPt) return project.fullDescriptionPt
  return project.fullDescription || getLocalizedText(project, language, 'description')
}

interface ProjectPreviewCardProps {
  project: PublicProject
  index: number
  language: 'es' | 'en' | 'pt'
  isMobile: boolean
  pageLinkLabel: string
  onOpen: (project: PublicProject) => void
}

function ProjectPreviewCard({ project, index, language, isMobile, pageLinkLabel, onOpen }: ProjectPreviewCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const previewMedia = useMemo(
    () =>
      buildProjectMediaItems(project, {
        isMobile: false,
        fallbackUrl: '/images/hero-bg.png',
      }),
    [project],
  )
  const currentPreview = previewMedia[previewIndex] || previewMedia[0]
  const title = getLocalizedText(project, language, 'title')
  const shortDescription = getLocalizedText(project, language, 'description')
  const longDescription = getLocalizedNarrative(project, language)

  useEffect(() => {
    if (isMobile || !isHovered || previewMedia.length <= 1) {
      return
    }

    const interval = window.setInterval(() => {
      setPreviewIndex((previous) => (previous + 1) % previewMedia.length)
    }, 2800)

    return () => window.clearInterval(interval)
  }, [isHovered, isMobile, previewMedia.length])

  return (
    <motion.article
      key={project.id}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.04 }}
      className="group relative overflow-hidden rounded-[28px] bg-zinc-100 text-left"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setPreviewIndex(0)
      }}
    >
      <button
        type="button"
        aria-label={`Abrir ${title}`}
        onClick={() => onOpen(project)}
        className="absolute inset-0 z-10"
      />
      <div className="relative aspect-[9/14] overflow-hidden bg-zinc-100 sm:aspect-[4/3]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentPreview?.url || `${project.id}-fallback`}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.01 }}
            transition={{ duration: 1.6, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            <Image
              src={(isMobile ? project.mainImageMobile || project.mainImage : currentPreview?.url || project.mainImage || project.mainImageMobile) || '/images/hero-bg.png'}
              alt={currentPreview?.alt || title}
              fill
              className={`object-cover ${isMobile ? '' : 'transition-transform duration-[1400ms] group-hover:scale-[1.03]'}`}
              priority={index < 3}
            />
          </motion.div>
        </AnimatePresence>
        <div className={`absolute inset-0 bg-gradient-to-t from-black/78 via-black/22 to-transparent transition-opacity duration-500 ${isMobile ? 'opacity-100' : isHovered ? 'opacity-100' : 'opacity-0'}`} />
        <div className="absolute right-4 top-4 z-20">
          <Link
            href={`/proyectos/${project.id}`}
            className="inline-flex items-center gap-1 rounded-full border border-white/28 bg-black/18 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-white backdrop-blur-md transition-colors hover:border-white/48 hover:bg-black/28"
            onClick={(event) => event.stopPropagation()}
          >
            <span>{pageLinkLabel}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-5 pt-12 sm:px-6 sm:pb-6">
          <div className={`space-y-2 text-white transition-opacity duration-500 ${isMobile ? 'opacity-100' : isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/72">
              {formatCategoryLabel(project.category)}
            </p>
            <h2 className="text-2xl font-light tracking-tight">
              {title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/82">
              {project.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{project.location}</span>
                </span>
              ) : null}
              {project.year ? <span>{project.year}</span> : null}
              {project.area ? <span>{project.area}</span> : null}
            </div>
            {!isMobile && longDescription ? (
              <div className="relative h-12 overflow-hidden">
                <motion.p
                  initial={false}
                  animate={isHovered ? { y: [18, -16], opacity: [0.15, 0.95, 0.82] } : { y: 18, opacity: 0 }}
                  transition={isHovered ? { duration: 10, ease: 'linear', repeat: Infinity, repeatType: 'loop' } : { duration: 0.2 }}
                  className="absolute inset-x-0 bottom-0 text-sm leading-6 text-white/84"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {longDescription}
                </motion.p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="space-y-1 border-t border-zinc-200 bg-white px-4 py-3 sm:hidden">
        <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
          {formatCategoryLabel(project.category)}
        </p>
        <h2 className="text-sm font-medium text-zinc-900">
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          {project.location ? <span>{project.location}</span> : null}
          {project.year ? <span>{project.year}</span> : null}
        </div>
        {shortDescription ? (
          <p
            className="text-[11px] leading-5 text-zinc-500"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {shortDescription}
          </p>
        ) : null}
      </div>
    </motion.article>
  )
}

export function ProjectsPageClient({ projects, siteSettings }: ProjectsPageClientProps) {
  const { t, language } = useLanguage()
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedProject, setSelectedProject] = useState<PublicProject | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const categoryOptions = useMemo(
    () => getProjectCategories(siteSettings?.projectCategories, projects.map((project) => project.category)),
    [projects, siteSettings?.projectCategories],
  )

  const filterOptions = useMemo(
    () => [{ key: 'all', label: t.projects.all }, ...categoryOptions.map((category) => ({ key: category, label: formatCategoryLabel(category) }))],
    [categoryOptions, t.projects.all],
  )

  const filteredProjects = activeCategory === 'all'
    ? projects
    : projects.filter((project) => project.category === activeCategory)
  const pageLinkLabel = language === 'en' ? 'Page' : language === 'pt' ? 'Pagina' : 'Pagina'

  const similarProjects = selectedProject
    ? projects.filter((project) => project.category === selectedProject.category && project.id !== selectedProject.id).slice(0, 3)
    : []

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mediaQuery.matches)

    update()
    mediaQuery.addEventListener('change', update)

    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const handleNavigateProject = (event: Event) => {
      const customEvent = event as CustomEvent<string>
      const nextProject = projects.find((project) => project.id === customEvent.detail)

      if (nextProject) {
        setSelectedProject(nextProject)
      }
    }

    window.addEventListener('navigateProject', handleNavigateProject as EventListener)
    return () => window.removeEventListener('navigateProject', handleNavigateProject as EventListener)
  }, [projects])

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <SiteHeader tone="dark" />

      <section className="mx-auto max-w-7xl px-4 pb-12 pt-28 sm:px-6 sm:pt-32">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => setActiveCategory(option.key)}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] transition-colors ${
                activeCategory === option.key
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project, index) => (
            <ProjectPreviewCard
              key={project.id}
              project={project}
              index={index}
              language={language}
              isMobile={isMobile}
              pageLinkLabel={pageLinkLabel}
              onOpen={setSelectedProject}
            />
          ))}
        </div>

        {filteredProjects.length === 0 ? (
          <div className="mt-20 rounded-[28px] border border-dashed border-zinc-200 px-6 py-16 text-center text-sm text-zinc-500">
            No hay proyectos publicados en esta categoria todavia.
          </div>
        ) : null}
      </section>

      {selectedProject ? (
        <ProjectDetail
          project={selectedProject}
          similarProjects={similarProjects}
          onClose={() => setSelectedProject(null)}
        />
      ) : null}
    </main>
  )
}
