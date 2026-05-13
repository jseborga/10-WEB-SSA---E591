export type EditorialSection = {
  title: string
  body: string
}

export type EditorialItem = {
  title: string
  description: string
  href?: string
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
      const cleaned = line.replace(/^[-*•]\s*/, '').trim()

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
