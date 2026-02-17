import type { Metadata } from "next";
import { Outfit, Atkinson_Hyperlegible } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WebSiteJsonLd } from "@/components/seo/JsonLd";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { GlobalSearchProvider, GlobalSearchDialog } from "@/components/search";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UmamiAnalytics } from "@/components/analytics/UmamiAnalytics";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
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
        <UmamiAnalytics />
      </head>
      <body
        className={`${outfit.variable} ${atkinson.variable} antialiased min-h-screen flex flex-col`}
      >
        <ThemeProvider>
          <TooltipProvider>
            <GlobalSearchProvider>
              {/* Skip to main content link for keyboard navigation */}
              <a href="#main-content" className="skip-link">
                Aller au contenu principal
              </a>
              {/* Accent bar — brand identity */}
              <div
                className="h-[3px] w-full"
                style={{
                  background: "linear-gradient(90deg, var(--brand), var(--primary))",
                }}
                aria-hidden="true"
              />
              <Header />
              <main id="main-content" role="main" className="flex-1" tabIndex={-1}>
                {children}
              </main>
              <Footer />
              <ChatWidget />
              <GlobalSearchDialog />
            </GlobalSearchProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
