import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActivityTabs, QuickTools, UpcomingElections } from "@/components/home";
import { WebSiteJsonLd } from "@/components/seo/JsonLd";
import { Heart } from "lucide-react";

async function getRecentFactChecks() {
  const factChecks = await db.factCheck.findMany({
    take: 5,
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      source: true,
      sourceUrl: true,
      verdictRating: true,
      publishedAt: true,
      mentions: {
        take: 1,
        select: {
          politician: {
            select: { fullName: true, slug: true },
          },
        },
      },
    },
  });

  return factChecks.map((fc) => ({
    id: fc.id,
    title: fc.title,
    source: fc.source,
    sourceUrl: fc.sourceUrl,
    verdictRating: fc.verdictRating,
    publishedAt: fc.publishedAt,
    politician: fc.mentions[0]?.politician || null,
  }));
}

async function getRecentVotes() {
  const scrutins = await db.scrutin.findMany({
    take: 5,
    orderBy: { votingDate: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      votingDate: true,
      result: true,
      chamber: true,
    },
  });

  // Map to the expected format
  return scrutins.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    date: s.votingDate,
    result: s.result === "ADOPTED" ? "ADOPTE" : "REJETE",
    chamber: s.chamber,
  }));
}

async function getActiveDossiers() {
  return db.legislativeDossier.findMany({
    where: { status: "EN_COURS" },
    orderBy: { filingDate: "desc" },
    take: 5,
    select: {
      id: true,
      slug: true,
      title: true,
      shortTitle: true,
      status: true,
      filingDate: true,
    },
  });
}

async function getRecentArticles() {
  // Only fetch articles that have at least one politician or party mention
  const articles = await db.pressArticle.findMany({
    where: {
      OR: [
        { mentions: { some: {} } }, // Has politician mentions
        { partyMentions: { some: {} } }, // Has party mentions
      ],
    },
    take: 5,
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      feedSource: true,
      publishedAt: true,
      url: true,
    },
  });

  // Map feedSource to the expected format
  return articles.map((a) => ({
    ...a,
    source: a.feedSource.toUpperCase(),
  }));
}

async function getUpcomingElections() {
  const now = new Date();
  return db.election.findMany({
    where: {
      status: { not: "COMPLETED" },
      round1Date: { gte: now },
    },
    orderBy: { round1Date: "asc" },
    take: 4,
  });
}

async function getRecentAffairs() {
  const affairs = await db.affair.findMany({
    take: 5,
    orderBy: [
      { verdictDate: { sort: "desc", nulls: "last" } },
      { startDate: { sort: "desc", nulls: "last" } },
      { factsDate: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      verdictDate: true,
      startDate: true,
      factsDate: true,
      politician: {
        select: { fullName: true, slug: true },
      },
    },
  });

  return affairs.map((a) => ({
    ...a,
    date: a.verdictDate || a.startDate || a.factsDate,
  }));
}

export default async function HomePage() {
  const [
    recentFactChecks,
    recentVotes,
    activeDossiers,
    recentArticles,
    recentAffairs,
    upcomingElections,
  ] = await Promise.all([
    getRecentFactChecks(),
    getRecentVotes(),
    getActiveDossiers(),
    getRecentArticles(),
    getRecentAffairs(),
    getUpcomingElections(),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://poligraph.fr";

  return (
    <>
      <WebSiteJsonLd
        name="Poligraph"
        description="Observatoire citoyen de la vie politique. Mandats, votes, patrimoine, affaires judiciaires et fact-checking."
        url={siteUrl}
      />
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/10">
          <div className="container mx-auto px-4 py-20 md:py-28 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <Badge variant="secondary" className="mb-6 text-xs sm:text-sm font-medium">
                Observatoire citoyen de la vie politique
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Poligraph
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                Accédez aux informations publiques sur vos représentants politiques. Mandats, votes,
                patrimoine, affaires judiciaires et fact-checking.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="text-base px-8 shadow-lg shadow-primary/20">
                  <Link href="/politiques">Explorer les représentants</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-base px-8">
                  <Link href="/statistiques">Voir les statistiques</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-base px-8">
                  <Link href="/comparer">Comparer</Link>
                </Button>
              </div>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-72 h-72 bg-primary/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/20 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl pointer-events-none" />
        </section>

        {/* Activity Tabs */}
        <ActivityTabs
          factChecks={recentFactChecks}
          votes={recentVotes}
          dossiers={activeDossiers}
          articles={recentArticles}
          affairs={recentAffairs}
        />

        {/* Quick Tools */}
        <QuickTools />

        {/* Upcoming Elections */}
        <UpcomingElections elections={upcomingElections} />

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-br from-primary/5 to-accent/10">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Un projet citoyen, ouvert et indépendant
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
              Toutes nos sources sont documentées. Notre méthodologie est publique. Nous respectons
              la présomption d&apos;innocence et le droit de réponse.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild variant="outline" size="lg">
                <Link href="/sources">Découvrir notre méthodologie</Link>
              </Button>
              <Button asChild size="lg">
                <Link href="/soutenir" className="flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Nous soutenir
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
