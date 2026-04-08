'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
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

  const similarProjects = selectedProject
    ? projects.filter((project) => project.category === selectedProject.category && project.id !== selectedProject.id).slice(0, 3)
    : []

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
            <motion.button
              key={project.id}
              type="button"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: index * 0.04 }}
              onClick={() => setSelectedProject(project)}
              className="group relative overflow-hidden rounded-[28px] bg-zinc-100 text-left"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
                <Image
                  src={project.mainImage || '/images/hero-bg.png'}
                  alt={getLocalizedText(project, language, 'title')}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/18 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
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
                  </div>
                </div>
              </div>
            </motion.button>
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
