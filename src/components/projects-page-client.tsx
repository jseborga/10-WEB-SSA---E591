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
          <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600 sm:text-base">{t.projects.subtitle}</p>
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

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project, index) => (
            <motion.button
              key={project.id}
              type="button"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: index * 0.04 }}
              onClick={() => setSelectedProject(project)}
              className="group overflow-hidden rounded-[28px] border border-zinc-200 bg-white text-left transition-transform hover:-translate-y-1"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
                <Image
                  src={project.mainImage || '/images/hero-bg.png'}
                  alt={getLocalizedText(project, language, 'title')}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="space-y-3 px-5 py-5 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                    {formatCategoryLabel(project.category)}
                  </span>
                  {project.year ? <span className="text-xs text-zinc-400">{project.year}</span> : null}
                </div>
                <h2 className="text-xl font-light tracking-tight text-zinc-900">
                  {getLocalizedText(project, language, 'title')}
                </h2>
                {project.location ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{project.location}</span>
                  </div>
                ) : null}
                {getLocalizedText(project, language, 'description') ? (
                  <p className="text-sm leading-6 text-zinc-600">
                    {getLocalizedText(project, language, 'description')}
                  </p>
                ) : null}
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
