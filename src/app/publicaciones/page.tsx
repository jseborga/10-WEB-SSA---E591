import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { db } from '@/lib/db'
import { buildPublicationHref } from '@/lib/menu-config'
import { MANAGED_PUBLICATION_SLUGS } from '@/lib/publications'
import type { PublicSiteSettings } from '@/lib/public-site'
import { getSeoDescription, getSeoImage, getSiteUrl, serializeJsonLd } from '@/lib/seo'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await ensureSiteSettings().catch(() => getDefaultSiteSettings())
  const siteUrl = getSiteUrl(siteSettings)
  const companyName = siteSettings.companyName || 'SSA Ingenieria'
  const title = `Publicaciones | ${companyName}`
  const description = `Novedades, obras en curso y noticias de ${companyName}.`
  const shareImage = getSeoImage(siteSettings)

  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/publicaciones` },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${siteUrl}/publicaciones`,
      images: shareImage ? [{ url: shareImage, alt: title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: shareImage ? [shareImage] : undefined,
    },
  }
}

type PostCard = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  image: string | null
  date: Date
}

const dateFormatter = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export default async function PublicationsPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { pagina } = await searchParams
  const currentPage = Math.max(1, Number.parseInt(pagina || '1', 10) || 1)
  let posts: PostCard[] = []
  let siteSettings: PublicSiteSettings = getDefaultSiteSettings()

  try {
    const [rows, settings] = await Promise.all([
      db.publication.findMany({
        where: { published: true, showInMenu: false, slug: { notIn: MANAGED_PUBLICATION_SLUGS } },
        select: { id: true, title: true, slug: true, excerpt: true, image: true, publishedAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      ensureSiteSettings(),
    ])

    siteSettings = settings
    // Orden por fecha de publicación real (posts importados conservan la fecha original).
    posts = rows
      .map((row) => ({ ...row, date: row.publishedAt || row.createdAt }))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
  } catch (error) {
    console.error('Error loading publications page:', error)
  }

  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const visible = posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const siteUrl = getSiteUrl(siteSettings)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Publicaciones de ${siteSettings.companyName || 'SSA Ingenieria'}`,
    description: getSeoDescription(siteSettings),
    url: `${siteUrl}/publicaciones`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: visible.map((post, index) => ({
        '@type': 'ListItem',
        position: (page - 1) * PAGE_SIZE + index + 1,
        url: `${siteUrl}${buildPublicationHref(post.slug)}`,
        name: post.title,
      })),
    },
  }

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <SiteHeader tone="dark" siteSettings={siteSettings} />

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
        <header className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">{siteSettings.companyName}</p>
          <h1 className="mt-2 text-3xl font-light tracking-tight sm:text-5xl">Publicaciones</h1>
          <p className="mt-4 text-sm text-zinc-600 sm:text-base">Novedades, avances de obra y noticias del equipo.</p>
        </header>

        {visible.length > 0 ? (
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((post) => (
              <article key={post.id} className="group overflow-hidden rounded-[28px] border border-zinc-200 bg-white transition-colors hover:border-zinc-400">
                <Link
                  href={buildPublicationHref(post.slug)}
                  className="flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
                    {post.image ? (
                      <img
                        src={post.image}
                        alt={post.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.22em] text-zinc-400">
                        {siteSettings.companyName || 'SSA'}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
                    <time dateTime={post.date.toISOString()} className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                      {dateFormatter.format(post.date)}
                    </time>
                    <h2 className="text-lg font-medium leading-snug tracking-tight text-zinc-900">{post.title}</h2>
                    {post.excerpt ? <p className="line-clamp-3 text-sm leading-6 text-zinc-600">{post.excerpt}</p> : null}
                    <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs uppercase tracking-[0.18em] text-zinc-500 group-hover:text-zinc-900">
                      Leer más <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-12 rounded-[28px] border border-dashed border-zinc-200 px-6 py-16 text-center text-sm text-zinc-500">
            Todavía no hay publicaciones.
          </div>
        )}

        {totalPages > 1 ? (
          <nav aria-label="Paginación" className="mt-10 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.18em]">
            {page > 1 ? (
              <Link href={`/publicaciones?pagina=${page - 1}`} className="rounded-full border border-zinc-200 px-4 py-2 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900">
                Más recientes
              </Link>
            ) : null}
            <span className="text-zinc-400">
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={`/publicaciones?pagina=${page + 1}`} className="rounded-full border border-zinc-200 px-4 py-2 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900">
                Anteriores
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </main>
  )
}
