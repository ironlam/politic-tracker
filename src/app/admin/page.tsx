import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { findPotentialDuplicates } from "@/services/affairs/reconciliation";
import { getPipelineHealthAll } from "@/lib/data/pipelines";
import {
  CheckCircle2,
  CopyCheck,
  FileCheck2,
  FileText,
  Fingerprint,
  GitPullRequestArrow,
  HeartPulse,
  Newspaper,
  Plus,
  RefreshCw,
  Scale,
  ShieldAlert,
} from "lucide-react";

type QueueCard = {
  label: string;
  count: number;
  description: string;
  href: string;
  icon: typeof Scale;
};

async function getDashboardData() {
  const counts = await db.$queryRaw<
    [
      {
        total_politicians: bigint;
        published_politicians: bigint;
        without_photo: bigint;
        draft_politicians: bigint;
        without_bio: bigint;
        total_affairs: bigint;
        draft_affairs: bigint;
        without_ecli: bigint;
      },
    ]
  >`
    SELECT
      COUNT(*) AS total_politicians,
      COUNT(*) FILTER (WHERE "publicationStatus" = 'PUBLISHED') AS published_politicians,
      COUNT(*) FILTER (WHERE "publicationStatus" = 'PUBLISHED' AND "photoUrl" IS NULL) AS without_photo,
      COUNT(*) FILTER (WHERE "publicationStatus" = 'DRAFT') AS draft_politicians,
      COUNT(*) FILTER (WHERE "publicationStatus" = 'PUBLISHED' AND "biography" IS NULL) AS without_bio,
      (SELECT COUNT(*) FROM "Affair") AS total_affairs,
      (SELECT COUNT(*) FROM "Affair" WHERE "publicationStatus" = 'DRAFT') AS draft_affairs,
      (SELECT COUNT(*) FROM "Affair" a WHERE a."publicationStatus" = 'PUBLISHED' AND NOT EXISTS (SELECT 1 FROM "AffairCourtDecision" acd WHERE acd."affairId" = a.id)) AS without_ecli
    FROM "Politician"
  `;
  const c = counts[0]!;
  const [
    proposalsPending,
    proposalsConflict,
    reviewsPending,
    decisionsPending,
    articlesPending,
    duplicates,
    rejectionsPending,
    failedSyncs,
    pipelines,
    recentActivity,
    syncHistory,
  ] = await Promise.all([
    db.affairUpdateProposal.count({ where: { status: "PENDING" } }),
    db.affairUpdateProposal.count({ where: { status: "CONFLICT" } }),
    db.moderationReview.count({ where: { appliedAt: null } }),
    db.affairPoliticianDecision.count({ where: { judgment: "UNDECIDED", reviewedAt: null } }),
    countArticlesToLink(),
    findPotentialDuplicates(),
    db.pressAnalysisRejection.count({ where: { rejectedAt: { gte: since(FAILURE_WINDOW_DAYS) } } }),
    db.syncJob.count({
      // Sans fenêtre, un échec de février compte encore en septembre : le
      // compteur mesurait l'historique, pas ce qu'il reste à inspecter.
      where: { status: "FAILED", createdAt: { gte: since(FAILURE_WINDOW_DAYS) } },
    }),
    getPipelineHealthAll(),
    db.auditLog.findMany({ take: 10, orderBy: { createdAt: "desc" } }),
    db.syncJob.findMany({ take: 10, orderBy: { createdAt: "desc" } }),
  ]);
  const totalPoliticians = Number(c.total_politicians);
  const publishedPoliticians = Number(c.published_politicians);
  const withoutPhoto = Number(c.without_photo);
  const withoutBio = Number(c.without_bio);
  const withPhoto = publishedPoliticians - withoutPhoto;
  const withBio = publishedPoliticians - withoutBio;
  return {
    totalPoliticians,
    publishedPoliticians,
    politiciansDraft: Number(c.draft_politicians),
    totalAffairs: Number(c.total_affairs),
    affairsDraft: Number(c.draft_affairs),
    affairsWithoutEcli: Number(c.without_ecli),
    politiciansWithoutPhoto: withoutPhoto,
    biographiesMissing: withoutBio,
    completeness: publishedPoliticians
      ? Math.round(((withPhoto + withBio) / (publishedPoliticians * 2)) * 100)
      : 0,
    queues: {
      proposalsPending,
      proposalsConflict,
      reviewsPending,
      decisionsPending,
      articlesPending,
      duplicates: duplicates.length,
      rejectionsPending,
      failedPipelines: pipelines.filter((p) => p.status === "critical").length,
      failedSyncs,
    },
    recentActivity,
    syncHistory,
  };
}

function relativeTime(value: Date): string {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/**
 * Grille de cartes-compteurs. Extraite parce que le tableau de bord en rend
 * maintenant deux : les files où l'on agit, et les stocks que l'on surveille.
 * Le texte d'état vide diffère, une file se vide, un stock non.
 */
function QueueGrid({ cards, emptyLabel }: { cards: QueueCard[]; emptyLabel: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link key={card.label} href={card.href}>
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
                  </div>
                  <span
                    className={`text-2xl font-bold font-display ${card.count ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {card.count}
                  </span>
                </div>
                <p className="text-sm font-medium mt-3">{card.label}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.count ? card.description : emptyLabel}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

/** Fenêtre au-delà de laquelle un échec relève de l'historique, pas de la file. */
const FAILURE_WINDOW_DAYS = 7;

function since(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Articles analysés qu'il reste vraiment à rattacher.
 *
 * Le compteur d'origine comptait aussi ceux dont le registre d'attribution a
 * déjà conclu qu'aucun politicien ne correspond : mesuré sur la base, 443 des
 * 1761 étaient dans ce cas. Un article résolu négatif n'est pas du travail en
 * attente, c'est une réponse.
 *
 * En SQL parce que `AffairPoliticianDecision.sourceRef` est une chaîne libre,
 * sans relation Prisma vers `PressArticle.url`.
 */
async function countArticlesToLink(): Promise<number> {
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count
    FROM "PressArticle" a
    WHERE a."aiAnalyzedAt" IS NOT NULL
      AND a."isAffairRelated" = true
      AND NOT EXISTS (
        SELECT 1 FROM "PressArticleAffair" l WHERE l."articleId" = a.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM "AffairPoliticianDecision" d
        WHERE d."sourceRef" = a.url
          AND d.judgment IN ('NO_MATCH', 'NOT_SAME')
      )
  `;
  return Number(rows[0]?.count ?? 0);
}

export default async function AdminDashboard() {
  const data = await getDashboardData();
  const queueCards: QueueCard[] = [
    {
      label: "Affaires DRAFT",
      count: data.affairsDraft,
      description: "Vérifier les sources et décider de la publication.",
      href: "/admin/affaires?status=DRAFT",
      icon: Scale,
    },
    {
      label: "Propositions en attente",
      count: data.queues.proposalsPending,
      description: "Examiner les modifications proposées.",
      href: "/admin/affaires/propositions?status=PENDING",
      icon: GitPullRequestArrow,
    },
    {
      label: "Propositions en conflit",
      count: data.queues.proposalsConflict,
      description: "Résoudre les écarts avec la donnée actuelle.",
      href: "/admin/affaires/propositions?status=CONFLICT",
      icon: ShieldAlert,
    },
    {
      label: "Revues de modération",
      count: data.queues.reviewsPending,
      description: "Appliquer ou écarter la recommandation, avec preuve.",
      href: "/admin/affaires?filter=moderation-pending",
      icon: FileCheck2,
    },
    {
      label: "Articles à lier",
      count: data.queues.articlesPending,
      description: "Examiner les articles analysés sans liaison d’affaire.",
      href: "/admin/liaisons/articles-affaires",
      icon: Newspaper,
    },
    {
      label: "Doublons à trancher",
      count: data.queues.duplicates,
      description: "Comparer les paires proposées.",
      href: "/admin/affaires/doublons",
      icon: CopyCheck,
    },
    {
      label: "Pipelines en échec",
      count: data.queues.failedPipelines,
      description: "Diagnostiquer les pipelines critiques.",
      href: "/admin/pipelines?status=critical",
      icon: HeartPulse,
    },
    {
      label: "Synchronisations en échec",
      count: data.queues.failedSyncs,
      description: "Inspecter les exécutions interrompues.",
      href: "/admin/syncs?status=FAILED",
      icon: RefreshCw,
    },
  ];

  // Ces deux compteurs ne sont pas des files : rien ne s'y clôt.
  //
  // « Liaisons » est le stock du registre d'attribution, dont la charge réelle
  // (les affaires qu'une décision bloque) est déjà listée en tête de /review
  // par loadBlockedAffairs. « Rejets presse » n'a aucun champ de décision au
  // schéma, donc aucune ligne ne peut être marquée traitée.
  const trackingCards: QueueCard[] = [
    {
      label: "Liaisons au registre",
      count: data.queues.decisionsPending,
      description:
        "Stock de rapprochements non revus. Les blocages réels sont en tête de la revue.",
      href: "/admin/affair-matching/review?tab=UNDECIDED",
      icon: Fingerprint,
    },
    {
      label: "Rejets presse (7 j)",
      count: data.queues.rejectionsPending,
      description: "Journal des rejets de l'analyse presse, sur les sept derniers jours.",
      href: "/admin/press/rejections",
      icon: Newspaper,
    },
  ];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="À traiter maintenant"
        description={`${data.totalPoliticians} personnalités politiques, ${data.totalAffairs} affaires`}
        action={
          <Link
            href="/admin/affaires/nouveau"
            className="min-h-11 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg"
            style={{ backgroundColor: "oklch(0.52 0.2 25)" }}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Nouvelle affaire
          </Link>
        }
      />

      <section aria-labelledby="todo-title" className="space-y-4">
        <div>
          <h2 id="todo-title" className="text-lg font-display font-semibold">
            À traiter maintenant
          </h2>
          <p className="text-sm text-muted-foreground">
            Chaque compteur correspond à une file distincte et ouvre son filtre de travail.
          </p>
        </div>
        <QueueGrid cards={queueCards} emptyLabel="File vide, aucune action en attente." />
      </section>

      <section aria-labelledby="tracking-title" className="space-y-4">
        <div>
          <h2 id="tracking-title" className="text-lg font-display font-semibold">
            Suivi
          </h2>
          <p className="text-sm text-muted-foreground">
            Des stocks et des journaux, pas des files : ces compteurs ne se vident pas et n{"'"}
            attendent aucune action de votre part.
          </p>
        </div>
        <QueueGrid cards={trackingCards} emptyLabel="Rien à signaler sur la période." />
      </section>

      <section aria-labelledby="health-title" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="health-title" className="text-lg font-display font-semibold">
            Santé des données
          </h2>
          <span className="text-sm text-muted-foreground">{data.completeness}% complet</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            [
              "Personnalités sans photo",
              data.politiciansWithoutPhoto,
              "/admin/politiques?filter=no-photo",
              FileText,
            ],
            [
              "Biographies manquantes",
              data.biographiesMissing,
              "/admin/politiques?filter=no-bio",
              FileText,
            ],
            [
              "Affaires sans décision",
              data.affairsWithoutEcli,
              "/admin/affaires?filter=no-ecli",
              Scale,
            ],
            [
              "Personnalités DRAFT",
              data.politiciansDraft,
              "/admin/politiques?status=DRAFT",
              FileText,
            ],
          ].map(([label, count, href]) => (
            <Link key={String(label)} href={String(href)}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{String(count)}</div>
                  <p className="text-sm text-muted-foreground mt-1">{String(label)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="activity-title" className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 id="activity-title" className="text-lg font-display font-semibold">
            Activité récente
          </h2>
          <Card>
            <CardContent className="p-0">
              {data.recentActivity.length ? (
                <ul className="divide-y divide-border">
                  {data.recentActivity.map((entry) => (
                    <li key={entry.id} className="px-4 py-3 flex items-center gap-3">
                      <CheckCircle2
                        className="w-4 h-4 text-emerald-600 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-sm flex-1 truncate">
                        {entry.action}{" "}
                        <span className="text-muted-foreground">{entry.entityType}</span>
                      </span>
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={entry.createdAt.toISOString()}
                      >
                        {relativeTime(entry.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-6 text-sm text-muted-foreground text-center">
                  Aucune activité récente
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold">Activité et opérations</h2>
            <Link
              href="/admin/syncs"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Voir les synchronisations
            </Link>
          </div>
          <Card>
            <CardContent className="p-0">
              {data.syncHistory.length ? (
                <ul className="divide-y divide-border">
                  {data.syncHistory.map((job) => (
                    <li key={job.id} className="px-4 py-3 flex items-center gap-3">
                      <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="font-mono text-xs flex-1 truncate">{job.script}</span>
                      <Badge variant="outline">{job.status}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-6 text-sm text-muted-foreground text-center">
                  Aucune synchronisation enregistrée
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
