import { Fragment, type ReactNode } from 'react'

/**
 * Renderiza el contenido de una publicación con un formato tipo markdown mínimo:
 * párrafos separados por línea en blanco, **negrita**, [texto](url), listas con "- " o "1. "
 * y subtítulos con "## ". Sin HTML crudo: todo pasa por React, así que no hay riesgo de XSS.
 * Es un componente puro: sirve igual en el servidor (página pública) y en la vista previa del admin.
 */

type Block =
  | { type: 'heading'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'paragraph'; lines: string[] }

const UNORDERED = /^[-*•]\s+/
const ORDERED = /^\d+[.)]\s+/
const HEADING = /^#{1,3}\s+/

export function parsePublicationBlocks(value: string | null | undefined): Block[] {
  const blocks: Block[] = []
  const chunks = (value || '').replace(/\r\n/g, '\n').split(/\n{2,}/)

  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean)
    let paragraph: string[] = []
    let list: { ordered: boolean; items: string[] } | null = null

    const flushParagraph = () => {
      if (paragraph.length > 0) blocks.push({ type: 'paragraph', lines: paragraph })
      paragraph = []
    }
    const flushList = () => {
      if (list && list.items.length > 0) blocks.push({ type: 'list', ...list })
      list = null
    }

    for (const line of lines) {
      if (HEADING.test(line)) {
        flushParagraph()
        flushList()
        blocks.push({ type: 'heading', text: line.replace(HEADING, '') })
        continue
      }

      const ordered = ORDERED.test(line)
      if (UNORDERED.test(line) || ordered) {
        flushParagraph()
        if (!list || list.ordered !== ordered) {
          flushList()
          list = { ordered, items: [] }
        }
        list.items.push(line.replace(ordered ? ORDERED : UNORDERED, ''))
        continue
      }

      flushList()
      paragraph.push(line)
    }

    flushParagraph()
    flushList()
  }

  return blocks
}

function safeHref(value: string) {
  const href = value.trim()
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) return href
  if (href.startsWith('/') && !href.startsWith('//')) return href
  return null
}

const INLINE = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)\s]+)\))|(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g

export function renderInline(text: string, keyPrefix = 'i'): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let index = 0

  INLINE.lastIndex = 0
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const key = `${keyPrefix}-${index++}`

    if (match[2]) {
      nodes.push(
        <strong key={key} className="font-semibold text-zinc-900">
          {match[2]}
        </strong>,
      )
    } else if (match[4] && match[5]) {
      const href = safeHref(match[5])
      nodes.push(
        href ? (
          <a key={key} href={href} className="underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900" {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {match[4]}
          </a>
        ) : (
          match[4]
        ),
      )
    } else if (match[6]) {
      nodes.push(
        <a key={key} href={match[6]} target="_blank" rel="noopener noreferrer" className="break-all underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900">
          {match[6]}
        </a>,
      )
    }

    lastIndex = INLINE.lastIndex
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function PublicationContent({
  content,
  emptyText = 'No hay contenido todavia para esta pagina.',
  className = 'space-y-6 text-base leading-8 text-zinc-700',
}: {
  content: string | null | undefined
  emptyText?: string
  className?: string
}) {
  const blocks = parsePublicationBlocks(content)

  if (blocks.length === 0) {
    return (
      <div className={className}>
        <p>{emptyText}</p>
      </div>
    )
  }

  return (
    <div className={className}>
      {blocks.map((block, blockIndex) => {
        const key = `b-${blockIndex}`

        if (block.type === 'heading') {
          return (
            <h2 key={key} className="pt-2 text-xl font-medium tracking-tight text-zinc-900 sm:text-2xl">
              {renderInline(block.text, key)}
            </h2>
          )
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul'
          return (
            <ListTag key={key} className={`${block.ordered ? 'list-decimal' : 'list-disc'} space-y-2 pl-6 marker:text-zinc-400`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </ListTag>
          )
        }

        return (
          <p key={key}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={`${key}-${lineIndex}`}>
                {lineIndex > 0 ? <br /> : null}
                {renderInline(line, `${key}-${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
