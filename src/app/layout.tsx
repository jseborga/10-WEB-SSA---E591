import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/lib/language-context";
import { ensureSiteSettings, getDefaultSiteSettings } from "@/lib/site-settings";

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await ensureSiteSettings().catch(() => getDefaultSiteSettings())
  const companyName = siteSettings.companyName || 'SSA Ingenieria'
  const title = siteSettings.tagline
    ? `${companyName} | ${siteSettings.tagline}`
    : companyName
  const description =
    siteSettings.footerText ||
    siteSettings.tagline ||
    'Construccion, diseno, supervision, asesoria tecnica y soluciones digitales para proyectos.'
  const iconUrl = siteSettings.faviconUrl || siteSettings.logoUrl || '/logo.svg'

  return {
    title,
    description,
    authors: [{ name: companyName }],
    icons: {
      icon: iconUrl,
      shortcut: iconUrl,
      apple: iconUrl,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      images: siteSettings.logoUrl ? [siteSettings.logoUrl] : undefined,
    },
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
      </head>
      <body
        className="antialiased bg-white text-zinc-900"
      >
        <LanguageProvider>
          {children}
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
