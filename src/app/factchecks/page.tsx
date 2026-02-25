import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { FactCheckCard } from "@/components/factchecks/FactCheckCard";
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Fact-checks</h1>
        <p className="text-muted-foreground">
          Vérification des déclarations des responsables politiques français par des sources
          reconnues (AFP Factuel, Les Décodeurs, etc.).
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Les verdicts ci-dessous proviennent des organismes de fact-checking cités. Transparence
          Politique ne produit pas ses propres vérifications.
        </p>
        <SeoIntro
          text={`${stats.totalFactChecks.toLocaleString("fr-FR")} vérifications de déclarations politiques, issues de ${sources.length} médias partenaires reconnus.`}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{stats.totalFactChecks}</p>
          <p className="text-sm text-muted-foreground">Fact-checks</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-600">
            {(stats.byRating["FALSE"] || 0) + (stats.byRating["MOSTLY_FALSE"] || 0)}
          </p>
          <p className="text-sm text-muted-foreground">Faux / Plutôt faux</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {(stats.byRating["HALF_TRUE"] || 0) +
              (stats.byRating["MISLEADING"] || 0) +
              (stats.byRating["OUT_OF_CONTEXT"] || 0)}
          </p>
          <p className="text-sm text-muted-foreground">Trompeur / Partiel</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {(stats.byRating["TRUE"] || 0) + (stats.byRating["MOSTLY_TRUE"] || 0)}
          </p>
          <p className="text-sm text-muted-foreground">Vrai / Plutôt vrai</p>
        </div>
      </div>

      {/* Verdict legend */}
      <details className="mb-8 bg-muted/50 rounded-lg border">
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

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Search */}
        <form className="flex-1 min-w-[200px]">
          <input
            type="text"
            name="search"
            placeholder="Rechercher un fact-check..."
            defaultValue={search}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {source && <input type="hidden" name="source" value={source} />}
          {verdict && <input type="hidden" name="verdict" value={verdict} />}
          {politicianSlug && <input type="hidden" name="politician" value={politicianSlug} />}
          {type && <input type="hidden" name="type" value={type} />}
        </form>

        {/* Type filter: all vs direct claims */}
        <div className="flex gap-1">
          <Link
            href={buildUrl({ type: undefined })}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              !directOnly ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            Tout
          </Link>
          <Link
            href={buildUrl({ type: directOnly ? undefined : "direct" })}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              directOnly ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            Propos de politicien
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        {/* Source filter */}
        {sources.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildUrl({ source: undefined })}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                !source ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              }`}
            >
              Toutes sources
            </Link>
            {sources.slice(0, 5).map((s) => (
              <Link
                key={s.name}
                href={buildUrl({ source: source === s.name ? undefined : s.name })}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  source === s.name
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {s.name} ({s.count})
              </Link>
            ))}
          </div>
        )}

        {/* Verdict filter */}
        <div className="flex flex-wrap gap-1">
          {RATING_OPTIONS.map((rating) => {
            const count = stats.byRating[rating] || 0;
            if (count === 0) return null;
            return (
              <Link
                key={rating}
                href={buildUrl({ verdict: verdict === rating ? undefined : rating })}
                className="inline-block"
              >
                <Badge
                  className={`cursor-pointer transition-opacity ${
                    verdict === rating ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100"
                  } ${FACTCHECK_RATING_COLORS[rating]}`}
                >
                  {FACTCHECK_RATING_LABELS[rating]} ({count})
                </Badge>
              </Link>
            );
          })}
        </div>
      </div>

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
              <Link key={p.slug} href={buildUrl({ politician: p.slug })}>
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

      {/* Sources info */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          Données agrégées via la{" "}
          <a
            href="https://toolbox.google.com/factcheck/explorer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Google Fact Check Tools API
          </a>{" "}
          (standard ClaimReview). Les verdicts sont émis par les organismes de fact-checking cités.
        </p>
      </div>
    </div>
  );
}
