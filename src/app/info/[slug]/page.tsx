import { serializeJsonLd } from '@/lib/seo'
import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { buildPublicationHref } from '@/lib/menu-config'
import { parsePublicationGallery } from '@/lib/publications'
import { PublicationContent } from '@/components/publication-content'
import { PublicationGallery } from '@/components/publication-gallery'
import { ensureSiteSettings, getDefaultSiteSettings } from '@/lib/site-settings'
import { getSeoDescription, getSeoImage, getSiteUrl, toAbsoluteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

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
  const pageUrl = `${getSiteUrl(siteSettings)}${buildPublicationHref(page.slug)}`
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
  const resolvedPath = buildPublicationHref(slug)

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

  // La portada ya se muestra arriba: no se repite en la galería.
  const galleryUrls = parsePublicationGallery(page.gallery).filter((url) => url !== page.image)
  const publishedDate = page.publishedAt || page.createdAt
  const isPost = !page.showInMenu
  const sourceLabel = page.source === 'instagram' ? 'Instagram' : page.source === 'facebook' ? 'Facebook' : null

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
    datePublished: publishedDate.toISOString(),
    dateModified: page.updatedAt.toISOString(),
    mainEntityOfPage: `${getSiteUrl(siteSettings)}${buildPublicationHref(page.slug)}`,
  }

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(pageJsonLd) }}
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">{siteSettings.companyName}</p>
            <h1 className="text-3xl sm:text-5xl font-light tracking-tight mt-2">{page.title}</h1>
            {page.excerpt && <p className="text-sm sm:text-base text-zinc-600 mt-4 max-w-3xl">{page.excerpt}</p>}
            {isPost && (
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-zinc-400">
                <time dateTime={publishedDate.toISOString()}>
                  {new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(publishedDate)}
                </time>
              </p>
            )}
          </div>
          <Link href={isPost ? '/publicaciones' : '/'} className="text-xs uppercase tracking-[0.22em] text-zinc-500 hover:text-zinc-900 transition-colors">
            Volver
          </Link>
        </div>

        {page.image && (
          <div className="relative aspect-[16/8] mt-8 overflow-hidden rounded-3xl bg-zinc-100">
            <Image src={page.image} alt={page.title} fill className="object-cover" />
          </div>
        )}

        <article className="max-w-3xl mt-10">
          <PublicationContent content={page.content} />
        </article>

        <PublicationGallery urls={galleryUrls} title={page.title} />

        {sourceLabel && page.externalUrl && (
          <p className="mt-10 text-sm text-zinc-500">
            Publicado originalmente en{' '}
            <a
              href={page.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-800 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900"
            >
              {sourceLabel}
            </a>
          </p>
        )}
      </div>
    </main>
  )
}
