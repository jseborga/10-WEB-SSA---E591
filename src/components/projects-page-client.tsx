'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight, MapPin } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { PublicProject, PublicSiteSettings, formatCategoryLabel, getProjectCategories } from '@/lib/public-site'
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
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{t.nav.projects}</p>
          <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">{t.projects.title}</h1>
        </div>

        <div className="mt-10 flex flex-wrap gap-2">
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

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project, index) => (
            <motion.article
              key={project.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: index * 0.04 }}
              className="group relative overflow-hidden rounded-[28px] bg-zinc-100 text-left"
            >
              <button
                type="button"
                aria-label={`Abrir ${getLocalizedText(project, language, 'title')}`}
                onClick={() => setSelectedProject(project)}
                className="absolute inset-0 z-10"
              />
              <div className="relative aspect-[9/14] overflow-hidden bg-zinc-100 sm:aspect-[4/3]">
                <Image
                  src={(isMobile ? project.mainImageMobile || project.mainImage : project.mainImage || project.mainImageMobile) || '/images/hero-bg.png'}
                  alt={getLocalizedText(project, language, 'title')}
                  fill
                  className={`object-cover ${isMobile ? '' : 'transition-transform duration-700 group-hover:scale-[1.04]'}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/18 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
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
                <div className="absolute inset-x-0 bottom-0 translate-y-4 px-5 pb-5 pt-12 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 sm:px-6 sm:pb-6">
                  <div className="space-y-2 text-white">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/72">
                      {formatCategoryLabel(project.category)}
                    </p>
                    <h2 className="text-2xl font-light tracking-tight">
                      {getLocalizedText(project, language, 'title')}
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
                    {getLocalizedText(project, language, 'description') ? (
                      <p
                        className="max-w-xl text-sm leading-6 text-white/78"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 5,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {getLocalizedText(project, language, 'description')}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="space-y-1 border-t border-zinc-200 bg-white px-4 py-3 sm:hidden">
                <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                  {formatCategoryLabel(project.category)}
                </p>
                <h2 className="text-sm font-medium text-zinc-900">
                  {getLocalizedText(project, language, 'title')}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                  {project.location ? <span>{project.location}</span> : null}
                  {project.year ? <span>{project.year}</span> : null}
                </div>
              </div>
            </motion.article>
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
