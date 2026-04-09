import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'
import { getSeoDescription, getSeoImage, getSiteUrl, toAbsoluteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

function getPublicationPath(slug: string) {
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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [page, siteSettings] = await Promise.all([
    db.publication.findFirst({
      where: {
        slug,
        published: true,
      },
    }),
    ensureSiteSettings().catch(() => getDefaultSiteSettings()),
  ])

  if (!page) {
    return {
      title: 'Pagina no encontrada',
    }
  }

  const title = page.seoTitle?.trim() || `${page.title} | ${siteSettings.companyName}`
  const description = page.seoDescription?.trim() || page.excerpt || page.title
  const pageUrl = `${getSiteUrl(siteSettings)}${getPublicationPath(page.slug)}`
  const shareImage = toAbsoluteUrl(page.image, siteSettings) || getSeoImage(siteSettings)
  const keywords = (page.seoKeywords || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url: pageUrl,
      images: shareImage ? [{ url: shareImage, alt: page.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: shareImage ? [shareImage] : undefined,
    },
  }
}

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const resolvedPath = getPublicationPath(slug)

  if (resolvedPath !== `/info/${slug}`) {
    redirect(resolvedPath)
  }

  const [page, siteSettings] = await Promise.all([
    db.publication.findFirst({
      where: {
        slug,
        published: true,
      },
    }),
    ensureSiteSettings().catch(() => getDefaultSiteSettings()),
  ])

  if (!page) {
    notFound()
  }

  const contentBlocks = (page.content || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.title,
    description: page.seoDescription || page.excerpt || getSeoDescription(siteSettings),
    image: toAbsoluteUrl(page.image, siteSettings) || getSeoImage(siteSettings),
    keywords: page.seoKeywords || undefined,
    articleSection: page.category || undefined,
    author: {
      '@type': 'Organization',
      name: siteSettings.companyName,
    },
    publisher: {
      '@type': 'Organization',
      name: siteSettings.companyName,
      logo: getSeoImage(siteSettings)
        ? {
            '@type': 'ImageObject',
            url: getSeoImage(siteSettings),
          }
        : undefined,
    },
    datePublished: page.createdAt.toISOString(),
    dateModified: page.updatedAt.toISOString(),
    mainEntityOfPage: `${getSiteUrl(siteSettings)}${getPublicationPath(page.slug)}`,
  }

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">{siteSettings.companyName}</p>
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
            <p>No hay contenido todavia para esta pagina.</p>
          )}
        </article>
      </div>
    </main>
  )
}
