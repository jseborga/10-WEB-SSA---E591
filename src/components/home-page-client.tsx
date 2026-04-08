'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ArrowRight, MapPin, Instagram, Linkedin, Facebook } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LanguageSelector } from '@/components/language-selector'
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
  gallery?: string | null
  videoUrl?: string | null
  client?: string | null
  status?: string | null
  published?: boolean
}

interface HomePageClientProps {
  initialProjects?: Project[]
  menuPages?: MenuPage[]
  siteSettings?: SiteSettings
}

interface MenuPage {
  id: string
  title: string
  slug: string
}

interface SiteSettings {
  companyName?: string | null
  legalName?: string | null
  tagline?: string | null
  logoUrl?: string | null
  faviconUrl?: string | null
  heroImages?: string | null
  heroImageOpacity?: number | null
  heroImageSaturation?: number | null
  heroImageBrightness?: number | null
  heroImageContrast?: number | null
  heroImageFit?: string | null
  heroImageTreatment?: string | null
  heroShowCompanyName?: boolean | null
  heroTextTone?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  addressLine?: string | null
  city?: string | null
  country?: string | null
  footerText?: string | null
  instagramUrl?: string | null
  facebookUrl?: string | null
  linkedinUrl?: string | null
  youtubeUrl?: string | null
  tiktokUrl?: string | null
}

const ChatWidget = dynamic(() => import('@/components/chat-widget').then((mod) => mod.ChatWidget), {
  ssr: false,
})

const ProjectDetail = dynamic(() => import('@/components/project-detail').then((mod) => mod.ProjectDetail), {
  ssr: false,
})

function normalizePhoneLink(value: string) {
  return value.replace(/[^\d+]/g, '')
}

function normalizeWhatsappLink(value: string) {
  return value.replace(/\D/g, '')
}

function parseUrlList(value: string | null | undefined) {
  const rawValue = (value || '').trim()

  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue)

    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.startsWith('/') || item.startsWith('http://') || item.startsWith('https://'))
    }
  } catch {
    // Site settings are usually stored one URL per line.
  }

  return rawValue
    .split('\n')
    .map((line) => line.trim().replace(/^['"]|['"]$/g, ''))
    .filter((line) => line.startsWith('/') || line.startsWith('http://') || line.startsWith('https://'))
}

function shuffleItems<T>(items: T[]) {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }

  return next
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

const defaultProjects: Project[] = [
  {
    id: '1',
    title: 'Casa Minimalista',
    titleEn: 'Minimalist House',
    titlePt: 'Casa Minimalista',
    description: 'Diseño contemporáneo con líneas limpias',
    descriptionEn: 'Contemporary design with clean lines',
    descriptionPt: 'Design contemporâneo com linhas limpas',
    fullDescription: 'Una residencia que explora la simplicidad y la funcionalidad. Espacios abiertos conectados visualmente, materiales naturales y una paleta de colores neutros crean un ambiente de calma y serenidad.',
    fullDescriptionEn: 'A residence that explores simplicity and functionality. Open spaces visually connected, natural materials and a neutral color palette create an atmosphere of calm and serenity.',
    fullDescriptionPt: 'Uma residência que explora a simplicidade e a funcionalidade. Espaços abertos visualmente conectados, materiais naturais e uma paleta de cores neutras criam um ambiente de calma e serenidade.',
    category: 'residencial',
    location: 'La Paz, Bolivia',
    year: 2024,
    area: '320 m²',
    mainImage: '/images/projects/house1.png',
    gallery: '["/images/gallery/house1-int.jpg", "/images/gallery/house1-bed.jpg", "/images/gallery/house1-kitchen.jpg"]',
    client: 'Familia Mendoza',
    status: 'completed'
  },
  {
    id: '2',
    title: 'Residencia Contemporánea',
    titleEn: 'Contemporary Residence',
    titlePt: 'Residência Contemporânea',
    description: 'Arquitectura moderna con materiales naturales',
    descriptionEn: 'Modern architecture with natural materials',
    descriptionPt: 'Arquitetura moderna com materiais naturais',
    fullDescription: 'Esta residencia combina el hormigón visto con madera de origen local, creando un dialogo entre lo industrial y lo orgánico. Amplios ventanales enmarcan vistas al paisaje circundante.',
    fullDescriptionEn: 'This residence combines exposed concrete with locally sourced wood, creating a dialogue between the industrial and the organic. Large windows frame views of the surrounding landscape.',
    fullDescriptionPt: 'Esta residência combina concreto aparente com madeira de origem local, criando um diálogo entre o industrial e o orgânico. Amplos janelas emolduram vistas da paisagem circundante.',
    category: 'residencial',
    location: 'Santa Cruz, Bolivia',
    year: 2023,
    area: '450 m²',
    mainImage: '/images/projects/house2.png',
    client: 'Dr. Sánchez',
    status: 'completed'
  },
  {
    id: '3',
    title: 'Edificio Corporativo',
    titleEn: 'Corporate Building',
    titlePt: 'Edifício Corporativo',
    description: 'Espacios de trabajo innovadores',
    descriptionEn: 'Innovative workspaces',
    descriptionPt: 'Espaços de trabalho inovadores',
    fullDescription: 'Un edificio de oficinas que redefine el espacio de trabajo contemporáneo. Fachada de doble piel, espacios flexibles y áreas comunes que fomentan la colaboración y el bienestar.',
    fullDescriptionEn: 'An office building that redefines contemporary workspace. Double-skin facade, flexible spaces and common areas that encourage collaboration and well-being.',
    fullDescriptionPt: 'Um edifício de escritórios que redefine o espaço de trabalho contemporâneo. Fachada de dupla pele, espaços flexíveis e áreas comuns que incentivam a colaboração e o bem-estar.',
    category: 'comercial',
    location: 'La Paz, Bolivia',
    year: 2024,
    area: '2,500 m²',
    mainImage: '/images/projects/commercial1.png',
    gallery: '["/images/gallery/commercial1-int.jpg"]',
    client: 'Grupo Empresarial SRL',
    status: 'completed'
  },
  {
    id: '4',
    title: 'Complejo Industrial',
    titleEn: 'Industrial Complex',
    titlePt: 'Complexo Industrial',
    description: 'Diseño funcional y eficiente',
    descriptionEn: 'Functional and efficient design',
    descriptionPt: 'Design funcional e eficiente',
    fullDescription: 'Centro logístico diseñado para maximizar la eficiencia operativa. Estructuras modulares, iluminación natural optimizada y sistemas sostenibles de gestión de recursos.',
    fullDescriptionEn: 'Logistics center designed to maximize operational efficiency. Modular structures, optimized natural lighting and sustainable resource management systems.',
    fullDescriptionPt: 'Centro logístico projetado para maximizar a eficiência operacional. Estruturas modulares, iluminação natural otimizada e sistemas sustentáveis de gestão de recursos.',
    category: 'industrial',
    location: 'Cochabamba, Bolivia',
    year: 2023,
    area: '5,000 m²',
    mainImage: '/images/projects/industrial1.png',
    client: 'Industrias del Valle',
    status: 'completed'
  },
  {
    id: '5',
    title: 'Renovación Interior',
    titleEn: 'Interior Renovation',
    titlePt: 'Renovação Interior',
    description: 'Transformación de espacios existentes',
    descriptionEn: 'Transformation of existing spaces',
    descriptionPt: 'Transformação de espaços existentes',
    fullDescription: 'Rehabilitación integral de un apartamento de los años 70. Conservación de elementos originales con inserciones contemporáneas, creando un diálogo entre pasado y presente.',
    fullDescriptionEn: 'Complete rehabilitation of a 70s apartment. Preservation of original elements with contemporary insertions, creating a dialogue between past and present.',
    fullDescriptionPt: 'Reabilitação integral de um apartamento dos anos 70. Preservação de elementos originais com inserções contemporâneas, criando um diálogo entre passado e presente.',
    category: 'renovacion',
    location: 'La Paz, Bolivia',
    year: 2024,
    area: '180 m²',
    mainImage: '/images/projects/renovation1.png',
    client: 'Arq. Laura P.',
    status: 'completed'
  }
]

const categories = {
  es: [
    { key: 'all', label: 'Todos' },
    { key: 'residencial', label: 'Residencial' },
    { key: 'comercial', label: 'Comercial' },
    { key: 'industrial', label: 'Industrial' },
    { key: 'renovacion', label: 'Renovación' }
  ],
  en: [
    { key: 'all', label: 'All' },
    { key: 'residencial', label: 'Residential' },
    { key: 'comercial', label: 'Commercial' },
    { key: 'industrial', label: 'Industrial' },
    { key: 'renovacion', label: 'Renovation' }
  ],
  pt: [
    { key: 'all', label: 'Todos' },
    { key: 'residencial', label: 'Residencial' },
    { key: 'comercial', label: 'Comercial' },
    { key: 'industrial', label: 'Industrial' },
    { key: 'renovacion', label: 'Renovação' }
  ]
}

const services = {
  es: [
    { title: 'Diseño Arquitectónico', description: 'Creamos espacios únicos que reflejan tu visión y estilo de vida.' },
    { title: 'Construcción', description: 'Ejecutamos proyectos con los más altos estándares de calidad.' },
    { title: 'Renovación', description: 'Transformamos espacios existentes en ambientes contemporáneos.' },
    { title: 'Consultoría', description: 'Asesoramiento especializado en desarrollo inmobiliario.' }
  ],
  en: [
    { title: 'Architectural Design', description: 'We create unique spaces that reflect your vision and lifestyle.' },
    { title: 'Construction', description: 'We execute projects with the highest quality standards.' },
    { title: 'Renovation', description: 'We transform existing spaces into contemporary environments.' },
    { title: 'Consulting', description: 'Specialized advice on real estate development.' }
  ],
  pt: [
    { title: 'Design Arquitetônico', description: 'Criamos espaços únicos que refletem sua visão e estilo de vida.' },
    { title: 'Construção', description: 'Executamos projetos com os mais altos padrões de qualidade.' },
    { title: 'Renovação', description: 'Transformamos espaços existentes em ambientes contemporâneos.' },
    { title: 'Consultoria', description: 'Assessoria especializada em desenvolvimento imobiliário.' }
  ]
}

export default function HomePageClient({
  initialProjects,
  menuPages = [],
  siteSettings,
}: HomePageClientProps) {
  const { t, language } = useLanguage()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [heroCarouselImages, setHeroCarouselImages] = useState<string[]>([])
  const [activeHeroIndex, setActiveHeroIndex] = useState(0)
  const projects = initialProjects ?? defaultProjects
  const companyName = siteSettings?.companyName?.trim() || 'SSA Ingenieria'
  const contactEmail = siteSettings?.email?.trim() || t.studio.email
  const contactPhone = siteSettings?.phone?.trim() || t.studio.phone
  const contactWhatsapp = siteSettings?.whatsapp?.trim() || ''
  const locationText =
    [siteSettings?.addressLine, siteSettings?.city, siteSettings?.country]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(', ') || t.studio.location
  const footerText = siteSettings?.footerText?.trim() || t.footer.rights
  const socialLinks = [
    { label: 'Instagram', href: siteSettings?.instagramUrl?.trim() || '' },
    { label: 'Facebook', href: siteSettings?.facebookUrl?.trim() || '' },
    { label: 'LinkedIn', href: siteSettings?.linkedinUrl?.trim() || '' },
    { label: 'YouTube', href: siteSettings?.youtubeUrl?.trim() || '' },
    { label: 'TikTok', href: siteSettings?.tiktokUrl?.trim() || '' },
  ].filter((item) => item.href)
  const iconSocialLinks = [
    { label: 'Instagram', href: siteSettings?.instagramUrl?.trim() || '', icon: Instagram },
    { label: 'LinkedIn', href: siteSettings?.linkedinUrl?.trim() || '', icon: Linkedin },
    { label: 'Facebook', href: siteSettings?.facebookUrl?.trim() || '', icon: Facebook },
  ].filter((item) => item.href)
  const heroTitle = siteSettings?.tagline?.trim() || t.hero.subtitle
  const heroImageTreatment: 'editorial' | 'original' | 'enhanced' | 'monochrome' =
    siteSettings?.heroImageTreatment === 'enhanced' ||
    siteSettings?.heroImageTreatment === 'monochrome'
      ? siteSettings.heroImageTreatment
      : 'original'
  const heroShowCompanyName = false
  const heroImageSaturation = clampNumber(siteSettings?.heroImageSaturation, 100, 0, 160)
  const heroImageBrightness = clampNumber(siteSettings?.heroImageBrightness, 100, 70, 150)
  const heroImageContrast = clampNumber(siteSettings?.heroImageContrast, 105, 80, 160)
  const activeHeroOpacity = 1
  const accentHeroOpacity = 0
  const activeHeroGrayscale = 0
  const activeHeroSaturation = Math.max(0.9, heroImageSaturation / 100)
  const heroTitleColorClass = 'text-black'
  const heroSubtitleColorClass = 'text-zinc-900'
  const heroNameColorClass = 'text-zinc-500'
  const heroCtaClass = 'border-zinc-900 text-zinc-900 hover:bg-zinc-900 hover:text-white'
  const heroTextShadow = '0 2px 18px rgba(255,255,255,0.85), 0 0 2px rgba(255,255,255,0.95)'

  useEffect(() => {
    const configuredImages = parseUrlList(siteSettings?.heroImages)
    const projectImages = projects
      .map((project) => project.mainImage?.trim())
      .filter((value): value is string => Boolean(value) && (value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://')))

    const uniqueProjectImages = projectImages.filter((image, index) => projectImages.indexOf(image) === index && !configuredImages.includes(image))
    const uniqueImages = [...shuffleItems(configuredImages), ...shuffleItems(uniqueProjectImages)]

    if (uniqueImages.length === 0) {
      setHeroCarouselImages([])
      setActiveHeroIndex(0)
      return
    }

    const shuffled = shuffleItems(uniqueImages)
    setHeroCarouselImages(shuffled)
    setActiveHeroIndex(Math.floor(Math.random() * shuffled.length))
  }, [projects, siteSettings?.heroImages])

  useEffect(() => {
    if (heroCarouselImages.length <= 1) {
      return
    }

    const interval = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % heroCarouselImages.length)
    }, 4800)

    return () => window.clearInterval(interval)
  }, [heroCarouselImages.length])

  // Listen for navigation events from ProjectDetail
  useEffect(() => {
    const handleNavigateProject = (e: CustomEvent) => {
      const project = projects.find(p => p.id === e.detail)
      if (project) setSelectedProject(project)
    }
    window.addEventListener('navigateProject', handleNavigateProject as EventListener)
    return () => window.removeEventListener('navigateProject', handleNavigateProject as EventListener)
  }, [projects])

  const getLocalizedText = useCallback((item: Project, field: 'title' | 'description') => {
    if (field === 'title') {
      if (language === 'en' && item.titleEn) return item.titleEn
      if (language === 'pt' && item.titlePt) return item.titlePt
      return item.title
    }
    if (field === 'description') {
      if (language === 'en' && item.descriptionEn) return item.descriptionEn
      if (language === 'pt' && item.descriptionPt) return item.descriptionPt
      return item.description
    }
    return ''
  }, [language])

  const filteredProjects = activeCategory === 'all' 
    ? projects 
    : projects.filter(p => p.category === activeCategory)

  const similarProjects = selectedProject 
    ? projects.filter(p => p.category === selectedProject.category && p.id !== selectedProject.id).slice(0, 3)
    : []

  const currentCategories = categories[language] || categories.es
  const currentServices = services[language] || services.es
  const studioContent =
    language === 'es'
      ? {
          title: 'Oficina',
          subtitle: 'Conoce nuestro enfoque',
          description:
            'Somos una firma de diseno y construccion dedicada a crear espacios que trascienden. Nuestro enfoque combina la innovacion con el respeto por el contexto y el medio ambiente.',
          philosophy: 'Filosofia',
          philosophyText:
            'Creemos que la ingenieria y la arquitectura debe ser atemporales, funcional y bella. Cada proyecto es una oportunidad para crear algo unico que mejore la calidad de vida de quienes lo habitan.',
          approach: 'Enfoque',
          approachText:
            'Trabajamos estrechamente con nuestros clientes para entender sus necesidades y transformarlas en espacios que superen sus expectativa.',
        }
      : {
          title: t.studio.title,
          subtitle: t.studio.subtitle,
          description: t.studio.description,
          philosophy: t.studio.philosophy,
          philosophyText: t.studio.philosophyText,
          approach: t.studio.approach,
          approachText: t.studio.approachText,
        }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-end">
          <div className="flex items-center gap-2 pointer-events-auto">
            <LanguageSelector />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-black/12 px-3 py-2 text-[11px] uppercase tracking-[0.25em] text-white backdrop-blur-md transition-colors hover:border-white/70 hover:bg-black/24"
            >
              <span>Menu</span>
              {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="pointer-events-auto bg-black/20 backdrop-blur-xl"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <a href="#proyectos" className="text-sm text-white/92 hover:text-white transition-colors" onClick={() => setIsMenuOpen(false)}>{t.nav.projects}</a>
                <a href="#servicios" className="text-sm text-white/92 hover:text-white transition-colors" onClick={() => setIsMenuOpen(false)}>{t.nav.services}</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero */}
      <section id="inicio" className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          {heroCarouselImages.length > 0 ? (
            <div className="absolute inset-0 overflow-hidden">
              {heroCarouselImages.map((imageUrl, index) => {
                const isActive = index === activeHeroIndex
                const isAccent = heroCarouselImages.length > 0 && index === (activeHeroIndex + heroCarouselImages.length - 1) % heroCarouselImages.length
                const opacity = isActive ? activeHeroOpacity : isAccent ? accentHeroOpacity : 0
                const filter = isActive
                  ? heroImageTreatment === 'original'
                    ? `brightness(${heroImageBrightness / 100}) contrast(${heroImageContrast / 100})`
                    : heroImageTreatment === 'enhanced'
                      ? `grayscale(8%) saturate(${Math.max(1, activeHeroSaturation * 1.08)}) brightness(${heroImageBrightness / 100}) contrast(${heroImageContrast / 100})`
                      : heroImageTreatment === 'monochrome'
                        ? `grayscale(100%) brightness(${heroImageBrightness / 100}) contrast(${heroImageContrast / 100})`
                        : `grayscale(${activeHeroGrayscale}%) saturate(${activeHeroSaturation}) brightness(${heroImageBrightness / 100}) contrast(${heroImageContrast / 100})`
                  : isAccent
                    ? heroImageTreatment === 'original'
                      ? 'none'
                      : 'grayscale(100%) contrast(0.92)'
                    : 'grayscale(100%)'

                return (
                  <img
                    key={`${imageUrl}-${index}`}
                    src={imageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-all duration-[1800ms] ease-out"
                    style={{
                      opacity,
                      filter,
                      transform: `scale(${isActive ? 1 : 1.015})`,
                    }}
                  />
                )
              })}
            </div>
          ) : (
            <Image src="/images/hero-bg.png" alt="" fill className="object-cover" priority />
          )}
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-24 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1
              className={`text-4xl sm:text-6xl md:text-7xl font-light tracking-tight mb-4 ${heroTitleColorClass}`}
              style={{ textShadow: heroTextShadow }}
            >
              {heroShowCompanyName ? (
                <span className={`block mb-2 text-sm sm:text-base md:text-lg tracking-[0.35em] uppercase ${heroNameColorClass}`}>
                  {companyName}
                </span>
              ) : null}
              <span className="inline-flex items-end justify-center gap-1">
                <span>{heroTitle}</span>
                <span className="inline-flex" aria-hidden="true">
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.18, ease: 'easeInOut' }}
                    >
                      .
                    </motion.span>
                  ))}
                </span>
              </span>
            </h1>
            <p
              className={`max-w-xl mx-auto text-sm sm:text-base font-light leading-relaxed mb-8 ${heroSubtitleColorClass}`}
              style={{ textShadow: heroTextShadow }}
            >
              {t.hero.description}
            </p>
            <a href="#proyectos">
              <Button variant="outline" className={`${heroCtaClass} px-6 sm:px-8 py-5 text-xs tracking-widest`}>
                {t.hero.cta}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </a>
          </motion.div>
        </div>

        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <div className="w-px h-14 bg-gradient-to-b from-transparent via-white/70 to-white/15" />
        </motion.div>
      </section>

      {/* Projects */}
      <section id="proyectos" className="py-16 sm:py-20 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-zinc-900 mb-2">{t.projects.title}</h2>
            <p className="text-sm text-zinc-600">{t.projects.subtitle}</p>
          </motion.div>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-10">
            {currentCategories.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-3 py-1.5 text-xs tracking-wide transition-colors ${
                  activeCategory === cat.key ? 'text-zinc-900 border-b border-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Projects Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <AnimatePresence mode="popLayout">
              {filteredProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="group relative overflow-hidden bg-white cursor-pointer"
                  onClick={() => setSelectedProject(project)}
                >
                  <div className="aspect-[4/3] relative overflow-hidden">
                    <Image
                      src={project.mainImage || '/images/projects/house1.png'}
                      alt={getLocalizedText(project, 'title')}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-zinc-900/0 group-hover:bg-zinc-900/10 transition-colors duration-300" />
                    
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-zinc-900/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <span className="text-white text-xs tracking-widest uppercase">Ver proyecto</span>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5">
                    <h3 className="text-base font-light text-zinc-900 mb-1">{getLocalizedText(project, 'title')}</h3>
                    {project.location && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <MapPin className="w-3 h-3" />
                        <span>{project.location}</span>
                        {project.year && <><span className="mx-1">•</span><span>{project.year}</span></>}
                      </div>
                    )}
                    {project.area && <p className="text-xs text-zinc-400 mt-1">{project.area}</p>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="servicios" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-zinc-900 mb-2">{t.services.title}</h2>
            <p className="text-sm text-zinc-600">{t.services.subtitle}</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {currentServices.map((service, index) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group p-6 border border-zinc-100 hover:border-zinc-300 transition-colors duration-300"
              >
                <h3 className="text-base font-light text-zinc-900 mb-2">{service.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{service.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Studio Section */}
      <section id="estudio" className="py-16 sm:py-20 bg-zinc-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16"
          >
            <div>
              <h2 className="text-2xl sm:text-3xl font-light tracking-tight mb-2">{studioContent.title}</h2>
              <p className="text-sm text-zinc-400 mb-8">{studioContent.subtitle}</p>
              
              <p className="text-sm text-zinc-300 leading-relaxed mb-8">{studioContent.description}</p>

              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-medium text-white mb-2">{studioContent.philosophy}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{studioContent.philosophyText}</p>
                </div>
                <div>
                  <h3 className="text-base font-medium text-white mb-2">{studioContent.approach}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{studioContent.approachText}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-base font-medium text-white mb-6">{t.studio.contact}</h3>
              <div className="space-y-4 mb-10">
                <div className="flex items-center gap-3">
                  <a href={`mailto:${contactEmail}`} className="text-sm text-zinc-300 hover:text-white transition-colors">
                    {contactEmail}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <a href={`tel:${normalizePhoneLink(contactPhone)}`} className="text-sm text-zinc-300 hover:text-white transition-colors">
                    {contactPhone}
                  </a>
                </div>
                {contactWhatsapp && (
                  <div className="flex items-center gap-3">
                    <a
                      href={`https://wa.me/${normalizeWhatsappLink(contactWhatsapp)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-zinc-300 hover:text-white transition-colors"
                    >
                      WhatsApp {contactWhatsapp}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm text-zinc-300">{locationText}</span>
                </div>
              </div>
              {iconSocialLinks.length > 0 && (
                <div className="flex gap-4">
                  {iconSocialLinks.map((social) => {
                    const Icon = social.icon
                    return (
                      <a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={social.label}
                        className="text-zinc-400 hover:text-white transition-colors"
                      >
                        <Icon className="w-5 h-5" />
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="hidden bg-zinc-950 text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-base sm:text-lg font-normal tracking-tight" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
              {companyName}
            </span>
            <p className="text-xs text-zinc-500 text-center sm:text-left">© {new Date().getFullYear()} {companyName}. {footerText}</p>
            {socialLinks.length > 0 && (
              <div className="flex flex-wrap justify-center gap-4">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-zinc-500 hover:text-white transition-colors tracking-wide"
                  >
                    {social.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </footer>

      <footer className="bg-white py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-center justify-center gap-5"
          >
            <div className="w-full max-w-md overflow-hidden">
              <motion.div
                animate={{ width: ['0%', '100%', '72%', '100%'] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
                className="h-px bg-zinc-900/70"
              />
            </div>
            <div className="text-center">
              <span className="inline-flex items-end justify-center gap-1 text-2xl sm:text-4xl md:text-5xl font-light tracking-tight text-zinc-900">
                <motion.span
                  animate={{ letterSpacing: ['0em', '0.022em', '0em'] }}
                  transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {heroTitle}
                </motion.span>
                <span className="inline-flex" aria-hidden="true">
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={`footer-dot-${dot}`}
                      animate={{ opacity: [0.16, 1, 0.16], y: [0, -2, 0] }}
                      transition={{ duration: 1.3, repeat: Infinity, delay: dot * 0.2, ease: 'easeInOut' }}
                    >
                      .
                    </motion.span>
                  ))}
                </span>
              </span>
            </div>
          </motion.div>
        </div>
      </footer>

      {/* Project Detail Modal */}
      {selectedProject && (
        <ProjectDetail 
          project={selectedProject} 
          similarProjects={similarProjects}
          onClose={() => setSelectedProject(null)} 
        />
      )}
      <ChatWidget />
    </div>
  )
}
