import type { Metadata } from "next";
import "./globals.css";
import { SiteAnalyticsTracker } from "@/components/site-analytics-tracker";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/lib/language-context";
import { ensureSiteSettings, getDefaultSiteSettings } from "@/lib/site-settings";
import { getOrganizationJsonLd, getSeoDescription, getSeoImage, getSeoKeywords, getSeoTitle, getSiteUrl, getWebsiteJsonLd } from "@/lib/seo";

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await ensureSiteSettings().catch(() => getDefaultSiteSettings())
  const companyName = siteSettings.companyName || 'SSA Ingenieria'
  const title = getSeoTitle(siteSettings)
  const description = getSeoDescription(siteSettings)
  const iconUrl = siteSettings.faviconUrl || siteSettings.logoUrl || '/logo.svg'
  const siteUrl = getSiteUrl(siteSettings)
  const seoImage = getSeoImage(siteSettings)
  const keywords = getSeoKeywords(siteSettings)

  return {
    metadataBase: new URL(siteUrl),
    applicationName: companyName,
    title,
    description,
    keywords,
    referrer: 'origin-when-cross-origin',
    authors: [{ name: companyName }],
    creator: companyName,
    publisher: companyName,
    category: 'engineering',
    alternates: {
      canonical: '/',
    },
    icons: {
      icon: iconUrl,
      shortcut: iconUrl,
      apple: iconUrl,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: siteUrl,
      siteName: companyName,
      locale: 'es_BO',
      images: seoImage
        ? [
            {
              url: seoImage,
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: seoImage ? [seoImage] : undefined,
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteSettings = await ensureSiteSettings().catch(() => getDefaultSiteSettings())
  const organizationJsonLd = getOrganizationJsonLd(siteSettings)
  const websiteJsonLd = getWebsiteJsonLd(siteSettings)

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Helvetica font fallback stack */}
        <style dangerouslySetInnerHTML={{ __html: `
          @font-face {
            font-family: 'Helvetica';
            src: local('Helvetica Neue'), local('HelveticaNeue'), local('Helvetica');
            font-weight: 300;
            font-style: normal;
          }
          @font-face {
            font-family: 'Helvetica';
            src: local('Helvetica Neue'), local('HelveticaNeue'), local('Helvetica');
            font-weight: 400;
            font-style: normal;
          }
          @font-face {
            font-family: 'Helvetica';
            src: local('Helvetica Neue'), local('HelveticaNeue'), local('Helvetica');
            font-weight: 500;
            font-style: normal;
          }
        `}} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body
        className="antialiased bg-white text-zinc-900"
      >
        <LanguageProvider>
          <SiteAnalyticsTracker />
          {children}
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
