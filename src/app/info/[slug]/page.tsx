import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await db.publication.findFirst({
    where: {
      slug,
      published: true,
    },
  })

  if (!page) {
    return {
      title: 'Página no encontrada',
    }
  }

  return {
    title: `${page.title} | SSA Ingenieria`,
    description: page.excerpt || page.title,
  }
}

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await db.publication.findFirst({
    where: {
      slug,
      published: true,
    },
  })

  if (!page) {
    notFound()
  }

  const contentBlocks = (page.content || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">SSA Ingenieria</p>
            <h1 className="text-3xl sm:text-5xl font-light tracking-tight mt-2">{page.title}</h1>
            {page.excerpt && <p className="text-sm sm:text-base text-zinc-600 mt-4 max-w-3xl">{page.excerpt}</p>}
          </div>
          <Link href="/" className="text-xs uppercase tracking-[0.22em] text-zinc-500 hover:text-zinc-900 transition-colors">
            Volver
          </Link>
        </div>

        {page.image && (
          <div className="relative aspect-[16/8] mt-8 overflow-hidden rounded-3xl bg-zinc-100">
            <Image src={page.image} alt={page.title} fill className="object-cover" />
          </div>
        )}

        <article className="max-w-3xl mt-10 space-y-6 text-base leading-8 text-zinc-700">
          {contentBlocks.length > 0 ? (
            contentBlocks.map((block, index) => <p key={`${page.id}-${index}`}>{block}</p>)
          ) : (
            <p>No hay contenido todavía para esta página.</p>
          )}
        </article>
      </div>
    </main>
  )
}
