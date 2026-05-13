export type EditorialSection = {
  title: string
  body: string
}

export type EditorialItem = {
  title: string
  description: string
  href?: string
}

export type EditorialProfile = {
  title: string
  subtitle: string
  description: string
  href?: string
  image?: string
}

function normalizeTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function isHeadingLine(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return false
  }

  if (/^#{1,3}\s+/.test(trimmed)) {
    return true
  }

  return /^[\p{L}\p{N}\s/&(),.-]+:$/u.test(trimmed)
}

function cleanHeading(value: string) {
  return value.replace(/^#{1,3}\s+/, '').replace(/:\s*$/, '').trim()
}

function isUrl(value: string) {
  return /^(https?:\/\/|\/)/i.test(value)
}

function isLikelyImageUrl(value: string) {
  return /(\.jpg|\.jpeg|\.png|\.webp|\.gif|\.avif|\.svg)(\?.*)?$/i.test(value)
}

function cleanListLine(value: string) {
  return value.replace(/^[-*•â€¢]\s*/, '').trim()
}

export function splitParagraphs(value: string | null | undefined) {
  return (value || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

export function parseEditorialSections(value: string | null | undefined) {
  const lines = (value || '').split('\n')
  const sections: EditorialSection[] = []
  let currentTitle = 'Introduccion'
  let buffer: string[] = []

  const flush = () => {
    const body = buffer.join('\n').trim()

    if (!body) {
      buffer = []
      return
    }

    sections.push({
      title: currentTitle,
      body,
    })
    buffer = []
  }

  for (const rawLine of lines) {
    if (isHeadingLine(rawLine)) {
      flush()
      currentTitle = cleanHeading(rawLine)
      continue
    }

    buffer.push(rawLine)
  }

  flush()
  return sections
}

export function findEditorialSection(sections: EditorialSection[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeTitle)

  return (
    sections.find((section) => normalizedAliases.includes(normalizeTitle(section.title))) ||
    sections.find((section) =>
      normalizedAliases.some((alias) => normalizeTitle(section.title).includes(alias) || alias.includes(normalizeTitle(section.title))),
    ) ||
    null
  )
}

export function parseEditorialItems(value: string | null | undefined) {
  const lines = (value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines
    .map<EditorialItem | null>((line) => {
      const cleaned = cleanListLine(line)

      if (!cleaned) {
        return null
      }

      const parts = cleaned.split('|').map((part) => part.trim()).filter(Boolean)

      if (parts.length >= 3 && /^https?:\/\//i.test(parts[1] || '')) {
        return {
          title: parts[0] || '',
          href: parts[1],
          description: parts.slice(2).join(' | '),
        }
      }

      if (parts.length >= 2 && /^https?:\/\//i.test(parts[1] || '')) {
        return {
          title: parts[0] || '',
          href: parts[1],
          description: '',
        }
      }

      if (parts.length >= 2) {
        return {
          title: parts[0] || '',
          description: parts.slice(1).join(' | '),
        }
      }

      return {
        title: cleaned,
        description: '',
      }
    })
    .filter((item): item is EditorialItem => Boolean(item?.title))
}

export function parseEditorialProfiles(value: string | null | undefined) {
  const lines = (value || '')
    .split('\n')
    .map((line) => cleanListLine(line))
    .filter(Boolean)

  return lines
    .map<EditorialProfile | null>((line) => {
      const parts = line.split('|').map((part) => part.trim()).filter(Boolean)

      if (parts.length === 0) {
        return null
      }

      const [title = '', ...rest] = parts
      let subtitle = ''
      let description = ''
      let href = ''
      let image = ''

      for (const part of rest) {
        if (isUrl(part)) {
          if (!image && isLikelyImageUrl(part)) {
            image = part
            continue
          }

          if (!href) {
            href = part
            continue
          }

          if (!image && isLikelyImageUrl(part)) {
            image = part
            continue
          }
        }

        if (!subtitle) {
          subtitle = part
          continue
        }

        description = description ? `${description} ${part}` : part
      }

      return title
        ? {
            title,
            subtitle,
            description,
            href: href || undefined,
            image: image || undefined,
          }
        : null
    })
    .filter((item): item is EditorialProfile => Boolean(item?.title))
}

export function parseEditorialMediaUrls(value: string | null | undefined) {
  const urls = (value || '')
    .split('\n')
    .map((line) => cleanListLine(line))
    .filter(Boolean)
    .flatMap((line) => line.split('|').map((part) => part.trim()).filter(Boolean))
    .filter((part) => isUrl(part) && isLikelyImageUrl(part))

  return Array.from(new Set(urls))
}
