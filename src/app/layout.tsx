import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WebSiteJsonLd } from "@/components/seo/JsonLd";
import { ChatWidget } from "@/components/chat/ChatWidget";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Poligraph",
    template: "%s | Poligraph",
  },
  description:
    "Observatoire citoyen de la vie politique. Mandats, votes, patrimoine, affaires judiciaires et fact-checking.",
  keywords: [
    "poligraph",
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
    "fact-checking",
    "votes",
  ],
  authors: [{ name: "Poligraph" }],
  creator: "Poligraph",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: siteUrl,
    siteName: "Poligraph",
    title: "Poligraph",
    description:
      "Observatoire citoyen de la vie politique. Mandats, votes, patrimoine, affaires judiciaires et fact-checking.",
    // Image generated automatically by opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title: "Poligraph",
    description: "Observatoire citoyen de la vie politique. Fact-checking et données publiques.",
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
          name="Poligraph"
          description="Observatoire citoyen de la vie politique. Mandats, votes, patrimoine, affaires judiciaires et fact-checking."
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
          <main id="main-content" role="main" className="flex-1" tabIndex={-1}>
            {children}
          </main>
          <Footer />
          <ChatWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
