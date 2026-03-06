import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  QuickTools,
  UpcomingElections,
  TodayVotesWidget,
  HomeRecapSection,
} from "@/components/home";
import { WebSiteJsonLd } from "@/components/seo/JsonLd";
import { Heart } from "lucide-react";
import { HexPattern } from "@/components/ui/HexPattern";
import { FadeIn } from "@/components/motion";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { SITE_URL } from "@/config/site";
import { getTodayVotesSummary } from "@/lib/data/votes";
import { getWeeklyRecap, getWeekStart } from "@/lib/data/recap";
import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Poligraph — Observatoire citoyen de la politique française",
  description:
    "Suivez les votes, affaires judiciaires, fact-checks et déclarations de patrimoine des politiques français. Données ouvertes, transparence citoyenne.",
  alternates: { canonical: "/" },
};

async function getUpcomingElections() {
  "use cache";
  cacheTag("elections", "homepage");
  cacheLife("minutes");

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

export default async function HomePage() {
  // Previous week's Monday for the recap
  const now = new Date();
  const currentWeekStart = getWeekStart(now);
  const prevWeekStart = new Date(currentWeekStart);
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);

  const [upcomingElections, todayVotes, weeklyRecap] = await Promise.all([
    getUpcomingElections(),
    getTodayVotesSummary(),
    getWeeklyRecap(prevWeekStart),
  ]);

  const statsEnabled = await isFeatureEnabled("STATISTIQUES_SECTION");

  return (
    <>
      <WebSiteJsonLd
        name="Poligraph"
        description="Observatoire citoyen de la vie politique. Mandats, votes, patrimoine, affaires judiciaires et fact-checking."
        url={SITE_URL}
      />
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/10">
          <div className="container mx-auto px-4 py-20 md:py-28 relative z-10">
            <FadeIn className="max-w-3xl mx-auto text-center">
              <Badge variant="secondary" className="mb-6 text-xs sm:text-sm font-medium">
                Observatoire citoyen de la vie politique
              </Badge>

              {/* Brand lockup: owl + title */}
              <div className="flex items-center justify-center gap-4 md:gap-5 mb-6">
                <Image
                  src="/logo.svg"
                  alt=""
                  aria-hidden="true"
                  width={72}
                  height={72}
                  className="w-14 h-14 md:w-[72px] md:h-[72px] drop-shadow-lg"
                />
                <div className="flex items-baseline gap-3">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold tracking-tight">
                    <span className="bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent">
                      Poligraph
                    </span>
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full border border-primary/30 text-primary bg-primary/5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/60" />
                    </span>
                    Beta
                  </span>
                </div>
              </div>

              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                Accédez aux informations publiques sur vos représentants politiques. Mandats, votes,
                patrimoine, affaires judiciaires et fact-checking.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="text-base px-8 shadow-lg shadow-primary/20">
                  <Link href="/politiques" prefetch={false}>
                    Explorer les représentants
                  </Link>
                </Button>
                {statsEnabled && (
                  <Button asChild size="lg" variant="outline" className="text-base px-8">
                    <Link href="/statistiques" prefetch={false}>
                      Voir les statistiques
                    </Link>
                  </Button>
                )}
                <Button asChild size="lg" variant="outline" className="text-base px-8">
                  <Link href="/comparer" prefetch={false}>
                    Comparer
                  </Link>
                </Button>
              </div>
            </FadeIn>
          </div>
          <HexPattern className="absolute inset-0 text-primary opacity-[0.03] dark:opacity-[0.05] pointer-events-none" />
        </section>

        {/* Upcoming Elections (conditional — renders null when no elections) */}
        <FadeIn>
          <UpcomingElections elections={upcomingElections} />
        </FadeIn>

        {/* Today's Votes (conditional — renders null when no votes today) */}
        <FadeIn>
          <TodayVotesWidget
            total={todayVotes.total}
            adopted={todayVotes.adopted}
            rejected={todayVotes.rejected}
          />
        </FadeIn>

        {/* Weekly Recap */}
        <FadeIn>
          <HomeRecapSection data={weeklyRecap} />
        </FadeIn>

        {/* Quick Tools */}
        <FadeIn>
          <QuickTools />
        </FadeIn>

        {/* CTA Section */}
        <FadeIn>
          <section className="py-20 bg-gradient-to-br from-primary/5 to-accent/10">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">
                Un projet citoyen, ouvert et indépendant
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
                Toutes nos sources sont documentées. Notre méthodologie est publique. Nous
                respectons la présomption d&apos;innocence et le droit de réponse.
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
        </FadeIn>
      </div>
    </>
  );
}
