import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WebSiteJsonLd } from "@/components/seo/JsonLd";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://transparence-politique.fr";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Transparence Politique",
    template: "%s | Transparence Politique",
  },
  description:
    "Observatoire citoyen des représentants politiques français. Accédez aux informations publiques : mandats, patrimoine, affaires judiciaires.",
  keywords: [
    "politique",
    "france",
    "députés",
    "sénateurs",
    "transparence",
    "représentants",
    "assemblée nationale",
    "affaires judiciaires",
    "patrimoine",
    "HATVP",
  ],
  authors: [{ name: "Transparence Politique" }],
  creator: "Transparence Politique",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: siteUrl,
    siteName: "Transparence Politique",
    title: "Transparence Politique",
    description:
      "Observatoire citoyen des représentants politiques français. Mandats, patrimoine, affaires judiciaires.",
    // Image generated automatically by opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title: "Transparence Politique",
    description:
      "Observatoire citoyen des représentants politiques français.",
    // Image generated automatically by opengraph-image.tsx
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <WebSiteJsonLd
          name="Transparence Politique"
          description="Observatoire citoyen des représentants politiques français. Mandats, patrimoine, votes et affaires judiciaires."
          url={siteUrl}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <ThemeProvider>
          {/* Skip to main content link for keyboard navigation */}
          <a href="#main-content" className="skip-link">
            Aller au contenu principal
          </a>
          <Header />
          <main id="main-content" className="flex-1" tabIndex={-1}>{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
