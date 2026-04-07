import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/lib/language-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "estudio591 | Arquitectura & Construcción",
  description: "Desarrollamos espacios únicos y atemporales, con alta atención al detalle, personalizados e innovadores que integran funcionalidad y estética.",
  keywords: ["arquitectura", "construcción", "diseño", "edificación", "renovación", "proyectos arquitectónicos"],
  authors: [{ name: "estudio591" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "estudio591 | Arquitectura & Construcción",
    description: "Desarrollamos espacios únicos y atemporales, con alta atención al detalle.",
    type: "website",
  },
};

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-zinc-900`}
      >
        <LanguageProvider>
          {children}
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
