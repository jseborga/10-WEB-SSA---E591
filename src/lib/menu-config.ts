export type MenuItemConfig = {
  id: string
  label: string
  href?: string
  openInNewTab?: boolean
  children?: MenuItemConfig[]
}

type PublicationMenuSource = {
  id: string
  title: string
  slug: string
  menuOrder?: number | null
}

function createId(prefix: string, seed: string) {
  const normalized = seed
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${prefix}-${normalized || Math.random().toString(36).slice(2, 8)}`
}

export function buildPublicationHref(slug: string) {
  const normalized = slug
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

  if (normalized === 'contacto') {
    return '/contacto'
  }

  if (normalized === 'estudio') {
    return '/estudio'
  }

  return `/info/${normalized}`
}

export function buildDefaultMenuConfig(publications: PublicationMenuSource[] = []) {
  const sortedPages = [...publications].sort((a, b) => (a.menuOrder ?? 0) - (b.menuOrder ?? 0))

  const defaultItems: MenuItemConfig[] = [
    { id: 'menu-home', label: 'Inicio', href: '/' },
    { id: 'menu-projects', label: 'Proyectos', href: '/proyectos' },
    { id: 'menu-studio', label: 'Estudio', href: '/estudio' },
    { id: 'menu-contact', label: 'Contacto', href: '/contacto' },
  ]

  if (sortedPages.length > 0) {
    defaultItems.push({
      id: 'menu-pages',
      label: 'Informacion',
      children: sortedPages.map((page) => ({
        id: createId('menu-page', `${page.menuOrder ?? 0}-${page.slug}`),
        label: page.title,
        href: buildPublicationHref(page.slug),
      })),
    })
  }

  return defaultItems
}

function normalizeSingleItem(value: unknown): MenuItemConfig | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const source = value as Record<string, unknown>
  const label = typeof source.label === 'string' ? source.label.trim() : ''
  const href = typeof source.href === 'string' ? source.href.trim() : ''
  const children = Array.isArray(source.children)
    ? source.children.map(normalizeSingleItem).filter((item): item is MenuItemConfig => Boolean(item))
    : []

  if (!label) {
    return null
  }

  return {
    id:
      typeof source.id === 'string' && source.id.trim().length > 0
        ? source.id.trim()
        : createId('menu-item', `${label}-${href || children.length}`),
    label,
    href: href || undefined,
    openInNewTab: Boolean(source.openInNewTab),
    children: children.length > 0 ? children : undefined,
  }
}

export function parseMenuConfig(value: string | null | undefined, fallbackPublications: PublicationMenuSource[] = []) {
  const raw = value?.trim()

  if (!raw) {
    return buildDefaultMenuConfig(fallbackPublications)
  }

  try {
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return buildDefaultMenuConfig(fallbackPublications)
    }

    const normalized = parsed.map(normalizeSingleItem).filter((item): item is MenuItemConfig => Boolean(item))
    return normalized.length > 0 ? normalized : buildDefaultMenuConfig(fallbackPublications)
  } catch {
    return buildDefaultMenuConfig(fallbackPublications)
  }
}

export function serializeMenuConfig(items: MenuItemConfig[]) {
  return JSON.stringify(items, null, 2)
}
