import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FactCheckCard } from "@/components/factchecks/FactCheckCard";
import { FactChecksFilterBar } from "@/components/factchecks/FactChecksFilterBar";
import { SeoIntro } from "@/components/seo/SeoIntro";
import {
  FACTCHECK_RATING_LABELS,
  FACTCHECK_RATING_COLORS,
  FACTCHECK_RATING_DESCRIPTIONS,
} from "@/config/labels";
import type { FactCheckRating } from "@/types";

export const metadata: Metadata = {
  title: "Fact-checks",
  description:
    "Vérification des déclarations des responsables politiques français. Fact-checks d'AFP Factuel, Les Décodeurs et autres sources reconnues.",
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    source?: string;
    verdict?: string;
    politician?: string;
    search?: string;
    type?: string; // "direct" = propos de politicien only
  }>;
}

const RATING_OPTIONS: FactCheckRating[] = [
  "FALSE",
  "MOSTLY_FALSE",
  "MISLEADING",
  "OUT_OF_CONTEXT",
  "HALF_TRUE",
  "MOSTLY_TRUE",
  "TRUE",
  "UNVERIFIABLE",
];

// Hex accent colors for verdict groups (inline styles per CLAUDE.md convention)
const VERDICT_ACCENT: Record<string, { border: string; bg: string }> = {
  total: { border: "#2563eb", bg: "#2563eb0a" },
  faux: { border: "#c1121f", bg: "#c1121f0a" },
  trompeur: { border: "#e9a825", bg: "#e9a8250a" },
  vrai: { border: "#2d6a4f", bg: "#2d6a4f0a" },
};

/** Generic claimant patterns — must match GENERIC_CLAIMANT_PATTERNS in labels.ts */
const GENERIC_CLAIMANT_PATTERNS = [
  "réseaux sociaux",
  "sources multiples",
  "sites internet",
  "publications",
  "utilisateurs",
  "internautes",
  "viral",
  "facebook",
  "twitter",
  "tiktok",
  "whatsapp",
  "telegram",
  "youtube",
  "instagram",
  "chaîne de mails",
  "rumeur",
  "blog",
  "forum",
];

function buildDirectClaimFilter() {
  return {
    claimant: { not: null },
    NOT: GENERIC_CLAIMANT_PATTERNS.map((pattern) => ({
      claimant: { contains: pattern, mode: "insensitive" as const },
    })),
  };
}

async function getFactChecks(params: {
  page: number;
  limit: number;
  source?: string;
  verdict?: string;
  politicianSlug?: string;
  search?: string;
  directOnly?: boolean;
}) {
  const { page, limit, source, verdict, politicianSlug, search, directOnly } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(source && { source }),
    ...(verdict && { verdictRating: verdict as FactCheckRating }),
    ...(politicianSlug && {
      mentions: {
        some: {
          politician: { slug: politicianSlug },
        },
      },
    }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { claimText: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(directOnly && buildDirectClaimFilter()),
  };

  const [factChecks, total] = await Promise.all([
    db.factCheck.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
      include: {
        mentions: {
          include: {
            politician: {
              select: { slug: true, fullName: true },
            },
          },
        },
      },
    }),
    db.factCheck.count({ where }),
  ]);

  return {
    factChecks,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

async function getStats() {
  const [totalFactChecks, byRating, bySource, topPoliticians] = await Promise.all([
    db.factCheck.count(),
    db.factCheck.groupBy({
      by: ["verdictRating"],
      _count: true,
      orderBy: { _count: { verdictRating: "desc" } },
    }),
    db.factCheck.groupBy({
      by: ["source"],
      _count: true,
      orderBy: { _count: { source: "desc" } },
    }),
    db.$queryRaw<Array<{ fullName: string; slug: string; count: bigint }>>`
      SELECT p."fullName", p.slug, COUNT(*) as count
      FROM "FactCheckMention" m
      JOIN "Politician" p ON m."politicianId" = p.id
      GROUP BY p.id, p."fullName", p.slug
      ORDER BY count DESC
      LIMIT 10
    `,
  ]);

  return {
    totalFactChecks,
    byRating: byRating.reduce(
      (acc, r) => {
        acc[r.verdictRating] = r._count;
        return acc;
      },
      {} as Record<string, number>
    ),
    bySource: bySource.map((s) => ({ source: s.source, count: s._count })),
    topPoliticians,
  };
}

async function getSources() {
  const sources = await db.factCheck.groupBy({
    by: ["source"],
    _count: true,
    orderBy: { _count: { source: "desc" } },
  });
  return sources.map((s) => ({ name: s.source, count: s._count }));
}

export default async function FactChecksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = 12;
  const source = params.source;
  const verdict = params.verdict;
  const politicianSlug = params.politician;
  const search = params.search;
  const type = params.type; // "direct" or undefined
  const directOnly = type === "direct";

  const [{ factChecks, total, totalPages }, stats, sources] = await Promise.all([
    getFactChecks({ page, limit, source, verdict, politicianSlug, search, directOnly }),
    getStats(),
    getSources(),
  ]);

  // Get politician name if filtering
  let politicianName: string | null = null;
  if (politicianSlug) {
    const p = await db.politician.findUnique({
      where: { slug: politicianSlug },
      select: { fullName: true },
    });
    politicianName = p?.fullName || null;
  }

  const buildUrl = (newParams: Record<string, string | undefined>) => {
    const current = new URLSearchParams();
    if (params.search) current.set("search", params.search);
    if (params.source) current.set("source", params.source);
    if (params.verdict) current.set("verdict", params.verdict);
    if (params.politician) current.set("politician", params.politician);
    if (params.type) current.set("type", params.type);

    for (const [key, value] of Object.entries(newParams)) {
      if (value) {
        current.set(key, value);
      } else {
        current.delete(key);
      }
    }

    if (Object.keys(newParams).some((k) => k !== "page")) {
      current.delete("page");
    }

    const qs = current.toString();
    return `/factchecks${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-display font-extrabold tracking-tight mb-1">Fact-checks</h1>
        <p className="text-sm text-muted-foreground">
          {stats.totalFactChecks} vérification{stats.totalFactChecks !== 1 ? "s" : ""} issue
          {stats.totalFactChecks !== 1 ? "s" : ""} de {sources.length} sources reconnues
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Les verdicts proviennent des organismes de fact-checking cités, pas de Poligraph.
        </p>
        <div className="sr-only">
          <SeoIntro
            text={`${stats.totalFactChecks.toLocaleString("fr-FR")} vérifications de déclarations politiques, issues de ${sources.length} médias partenaires reconnus.`}
          />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="border-l-4" style={{ borderLeftColor: VERDICT_ACCENT.total.border }}>
          <CardContent className="p-3 py-3">
            <div
              className="text-3xl font-display font-extrabold tracking-tight"
              style={{ color: VERDICT_ACCENT.total.border }}
            >
              {stats.totalFactChecks}
            </div>
            <div className="text-sm font-semibold mt-0.5 leading-tight">Fact-checks</div>
            <div className="text-xs text-muted-foreground mt-1 leading-snug">
              Total des vérifications
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: VERDICT_ACCENT.faux.border }}>
          <CardContent className="p-3 py-3">
            <div
              className="text-3xl font-display font-extrabold tracking-tight"
              style={{ color: VERDICT_ACCENT.faux.border }}
            >
              {(stats.byRating["FALSE"] || 0) + (stats.byRating["MOSTLY_FALSE"] || 0)}
            </div>
            <div className="text-sm font-semibold mt-0.5 leading-tight">Faux / Plutôt faux</div>
            <div className="text-xs text-muted-foreground mt-1 leading-snug">
              Déclarations réfutées
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: VERDICT_ACCENT.trompeur.border }}>
          <CardContent className="p-3 py-3">
            <div
              className="text-3xl font-display font-extrabold tracking-tight"
              style={{ color: VERDICT_ACCENT.trompeur.border }}
            >
              {(stats.byRating["HALF_TRUE"] || 0) +
                (stats.byRating["MISLEADING"] || 0) +
                (stats.byRating["OUT_OF_CONTEXT"] || 0)}
            </div>
            <div className="text-sm font-semibold mt-0.5 leading-tight">Trompeur / Partiel</div>
            <div className="text-xs text-muted-foreground mt-1 leading-snug">
              Contexte incomplet
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: VERDICT_ACCENT.vrai.border }}>
          <CardContent className="p-3 py-3">
            <div
              className="text-3xl font-display font-extrabold tracking-tight"
              style={{ color: VERDICT_ACCENT.vrai.border }}
            >
              {(stats.byRating["TRUE"] || 0) + (stats.byRating["MOSTLY_TRUE"] || 0)}
            </div>
            <div className="text-sm font-semibold mt-0.5 leading-tight">Vrai / Plutôt vrai</div>
            <div className="text-xs text-muted-foreground mt-1 leading-snug">
              Déclarations vérifiées
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Verdict legend */}
      <details className="mb-6 bg-muted/50 rounded-lg border">
        <summary className="px-4 py-3 cursor-pointer text-sm font-medium hover:bg-muted/80 rounded-lg transition-colors">
          Comprendre les verdicts
        </summary>
        <div className="px-4 pb-4 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RATING_OPTIONS.map((rating) => (
            <div key={rating} className="flex items-start gap-2">
              <Badge className={`shrink-0 text-xs ${FACTCHECK_RATING_COLORS[rating]}`}>
                {FACTCHECK_RATING_LABELS[rating]}
              </Badge>
              <p className="text-xs text-muted-foreground">
                {FACTCHECK_RATING_DESCRIPTIONS[rating]}
              </p>
            </div>
          ))}
        </div>
      </details>

      {/* Filter bar */}
      <FactChecksFilterBar
        currentFilters={{
          search: search || "",
          source: source || "",
          verdict: verdict || "",
          type: type || "",
        }}
        sources={sources}
        ratingCounts={stats.byRating}
      />

      {/* Active filters */}
      {(source || verdict || politicianSlug || search || directOnly) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {search && (
            <Badge variant="secondary" className="gap-1">
              Recherche: {search}
              <Link href={buildUrl({ search: undefined })} className="ml-1 hover:text-destructive">
                ×
              </Link>
            </Badge>
          )}
          {directOnly && (
            <Badge variant="secondary" className="gap-1">
              Propos de politicien
              <Link href={buildUrl({ type: undefined })} className="ml-1 hover:text-destructive">
                ×
              </Link>
            </Badge>
          )}
          {source && (
            <Badge variant="secondary" className="gap-1">
              {source}
              <Link href={buildUrl({ source: undefined })} className="ml-1 hover:text-destructive">
                ×
              </Link>
            </Badge>
          )}
          {verdict && (
            <Badge className={`gap-1 ${FACTCHECK_RATING_COLORS[verdict as FactCheckRating]}`}>
              {FACTCHECK_RATING_LABELS[verdict as FactCheckRating]}
              <Link href={buildUrl({ verdict: undefined })} className="ml-1 hover:text-destructive">
                ×
              </Link>
            </Badge>
          )}
          {politicianName && (
            <Badge variant="secondary" className="gap-1">
              {politicianName}
              <Link
                href={buildUrl({ politician: undefined })}
                className="ml-1 hover:text-destructive"
              >
                ×
              </Link>
            </Badge>
          )}
          <Link href="/factchecks" className="text-sm text-muted-foreground hover:text-foreground">
            Effacer tout
          </Link>
        </div>
      )}

      {/* Top politicians */}
      {stats.topPoliticians.length > 0 && !politicianSlug && (
        <div className="mb-6">
          <p className="text-xs text-muted-foreground mb-2">Politiciens les plus fact-checkés :</p>
          <div className="flex flex-wrap gap-1">
            {stats.topPoliticians.map((p) => (
              <Link key={p.slug} href={buildUrl({ politician: p.slug })} prefetch={false}>
                <Badge variant="outline" className="text-xs hover:bg-muted cursor-pointer">
                  {p.fullName} ({Number(p.count)})
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        {total} fact-check{total > 1 ? "s" : ""} trouvé{total > 1 ? "s" : ""}
      </p>

      {/* Grid */}
      {factChecks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {factChecks.map((fc) => (
            <FactCheckCard
              key={fc.id}
              slug={fc.slug!}
              title={fc.title}
              claimText={fc.claimText}
              claimant={fc.claimant}
              verdict={fc.verdict}
              verdictRating={fc.verdictRating}
              source={fc.source}
              publishedAt={fc.publishedAt}
              mentions={fc.mentions}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>Aucun fact-check trouvé</p>
          {(source || verdict || politicianSlug || search || directOnly) && (
            <Link href="/factchecks" className="text-primary hover:underline mt-2 inline-block">
              Effacer les filtres
            </Link>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {page > 1 && (
            <Link
              href={buildUrl({ page: String(page - 1) })}
              className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80"
            >
              Précédent
            </Link>
          )}
          <span className="px-4 py-2 text-muted-foreground">
            Page {page} sur {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildUrl({ page: String(page + 1) })}
              className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80"
            >
              Suivant
            </Link>
          )}
        </div>
      )}

      {/* Info box */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-blue-900 mb-2">À propos des données</h3>
          <p className="text-sm text-blue-800">
            Données agrégées via la{" "}
            <a
              href="https://toolbox.google.com/factcheck/explorer"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Google Fact Check Tools API
            </a>{" "}
            (standard ClaimReview). Les verdicts sont émis par les organismes de fact-checking
            cités. Poligraph ne produit pas ses propres vérifications.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
