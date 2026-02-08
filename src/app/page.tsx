import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardStats, ActivityTabs, QuickTools } from "@/components/home";
import { formatDate } from "@/lib/utils";
import { WebSiteJsonLd } from "@/components/seo/JsonLd";
import { Heart } from "lucide-react";

async function getStats() {
  const [
    politicianCount,
    affairCount,
    deputeCount,
    senateurCount,
    gouvernementCount,
    mepCount,
    declarationCount,
    voteCount,
    articleCount,
  ] = await Promise.all([
    db.politician.count(),
    db.affair.count(),
    db.mandate.count({ where: { type: "DEPUTE", isCurrent: true } }),
    db.mandate.count({ where: { type: "SENATEUR", isCurrent: true } }),
    db.mandate.count({
      where: {
        type: {
          in: ["MINISTRE", "PREMIER_MINISTRE", "MINISTRE_DELEGUE", "SECRETAIRE_ETAT"],
        },
        isCurrent: true,
      },
    }),
    db.mandate.count({ where: { type: "DEPUTE_EUROPEEN", isCurrent: true } }),
    db.declaration.count(),
    db.scrutin.count(),
    // Only count articles with politician or party mentions (relevant to politics)
    db.pressArticle.count({
      where: {
        OR: [{ mentions: { some: {} } }, { partyMentions: { some: {} } }],
      },
    }),
  ]);

  return {
    politicianCount,
    affairCount,
    deputeCount,
    senateurCount,
    gouvernementCount,
    mepCount,
    declarationCount,
    voteCount,
    articleCount,
  };
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

async function getRecentAffairs() {
  return db.affair.findMany({
    take: 4,
    orderBy: [
      { verdictDate: { sort: "desc", nulls: "last" } },
      { startDate: { sort: "desc", nulls: "last" } },
      { factsDate: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    include: {
      politician: { include: { currentParty: true } },
    },
  });
}

export default async function HomePage() {
  const [stats, recentVotes, activeDossiers, recentArticles, recentAffairs] = await Promise.all([
    getStats(),
    getRecentVotes(),
    getActiveDossiers(),
    getRecentArticles(),
    getRecentAffairs(),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://transparence-politique.fr";

  return (
    <>
      <WebSiteJsonLd
        name="Transparence Politique"
        description="Observatoire citoyen des représentants politiques français. Accédez aux informations publiques : mandats, patrimoine, affaires judiciaires."
        url={siteUrl}
      />
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/10">
          <div className="container mx-auto px-4 py-20 md:py-28 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <Badge variant="secondary" className="mb-6 text-sm font-medium">
                Observatoire citoyen indépendant
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Transparence Politique
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                Accédez aux informations publiques sur vos représentants politiques. Mandats,
                déclarations de patrimoine, votes, affaires judiciaires documentées.
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

        {/* Dashboard Stats */}
        <DashboardStats stats={stats} />

        {/* Activity Tabs */}
        <ActivityTabs votes={recentVotes} dossiers={activeDossiers} articles={recentArticles} />

        {/* Quick Tools */}
        <QuickTools />

        {/* Recent Affairs */}
        {recentAffairs.length > 0 && (
          <section className="py-16">
            <div className="container mx-auto px-4">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-2">Affaires récentes</h2>
                  <p className="text-muted-foreground">Dernières affaires documentées</p>
                </div>
                <Button variant="ghost" asChild className="text-primary">
                  <Link href="/affaires">Voir toutes &rarr;</Link>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {recentAffairs.map((affair) => {
                  const relevantDate = affair.verdictDate || affair.startDate || affair.factsDate;
                  return (
                    <Link
                      key={affair.id}
                      href={`/politiques/${affair.politician.slug}`}
                      className="block"
                    >
                      <Card className="h-full hover:shadow-lg transition-all hover:border-primary/20">
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                              <span className="text-amber-600 dark:text-amber-400 text-lg">!</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold truncate">{affair.title}</p>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {affair.politician.fullName}
                                {affair.politician.currentParty && (
                                  <span
                                    className="text-primary"
                                    title={affair.politician.currentParty.name}
                                  >
                                    {" "}
                                    ({affair.politician.currentParty.shortName})
                                  </span>
                                )}
                              </p>
                              {relevantDate && (
                                <p className="text-xs text-muted-foreground mt-2 font-mono">
                                  {formatDate(relevantDate)}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-br from-primary/5 to-accent/10">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Un projet citoyen transparent</h2>
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
