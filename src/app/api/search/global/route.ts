import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { withCache } from "@/lib/cache";
import { FACTCHECK_ALLOWED_SOURCES } from "@/config/labels";

const LIMIT = 8;

// Raw result types from $queryRaw
interface RawPolitician {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  partyShortName: string | null;
  partyColor: string | null;
  mandateType: string | null;
}

interface RawParty {
  slug: string;
  name: string;
  shortName: string;
  color: string | null;
  memberCount: bigint;
}

interface RawAffair {
  slug: string;
  title: string;
  status: string;
  politicianName: string;
  politicianSlug: string;
}

interface RawScrutin {
  id: string;
  slug: string | null;
  title: string;
  votingDate: Date;
  chamber: string;
}

interface RawFactCheck {
  slug: string;
  title: string;
  source: string;
  verdictRating: string | null;
  publishedAt: Date;
  politicianName: string | null;
}

interface RawDossier {
  slug: string;
  title: string;
  shortTitle: string | null;
  status: string;
  filingDate: Date | null;
}

interface RawCommune {
  id: string;
  name: string;
  departmentName: string;
  population: number | null;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";

  if (query.length < 2) {
    return NextResponse.json({
      politicians: [],
      parties: [],
      affairs: [],
      scrutins: [],
      factchecks: [],
      dossiers: [],
      communes: [],
    });
  }

  const pattern = `%${query}%`;
  const startsWithPattern = `${query}%`;

  const [politicians, parties, affairs, scrutins, factchecks, dossiers, communes] =
    await Promise.all([
      // Politicians: accent-insensitive on fullName/lastName/firstName
      db.$queryRaw<RawPolitician[]>`
        SELECT p."id", p."slug", p."fullName", p."photoUrl",
               party."shortName" AS "partyShortName",
               party."color" AS "partyColor",
               (SELECT m."type" FROM "Mandate" m
                WHERE m."politicianId" = p."id" AND m."isCurrent" = true
                LIMIT 1) AS "mandateType"
        FROM "Politician" p
        LEFT JOIN "Party" party ON party."id" = p."currentPartyId"
        WHERE p."publicationStatus" = 'PUBLISHED'
          AND (unaccent(p."fullName") ILIKE unaccent(${pattern})
            OR unaccent(p."lastName") ILIKE unaccent(${startsWithPattern})
            OR unaccent(p."firstName") ILIKE unaccent(${startsWithPattern}))
        ORDER BY p."prominenceScore" DESC NULLS LAST, p."lastName" ASC
        LIMIT ${LIMIT}
      `,

      // Parties: accent-insensitive on name/shortName
      db.$queryRaw<RawParty[]>`
        SELECT p."slug", p."name", p."shortName", p."color",
               (SELECT COUNT(*) FROM "Politician" pol
                WHERE pol."currentPartyId" = p."id")::bigint AS "memberCount"
        FROM "Party" p
        WHERE unaccent(p."name") ILIKE unaccent(${pattern})
           OR unaccent(p."shortName") ILIKE unaccent(${Prisma.sql`${query}`})
        ORDER BY p."name" ASC
        LIMIT ${LIMIT}
      `,

      // Affairs: accent-insensitive on title
      db.$queryRaw<RawAffair[]>`
        SELECT a."slug", a."title", a."status",
               pol."fullName" AS "politicianName",
               pol."slug" AS "politicianSlug"
        FROM "Affair" a
        JOIN "Politician" pol ON pol."id" = a."politicianId"
        WHERE a."publicationStatus" = 'PUBLISHED'
          AND unaccent(a."title") ILIKE unaccent(${pattern})
        ORDER BY a."createdAt" DESC
        LIMIT ${LIMIT}
      `,

      // Scrutins: accent-insensitive on title
      db.$queryRaw<RawScrutin[]>`
        SELECT s."id", s."slug", s."title", s."votingDate", s."chamber"
        FROM "Scrutin" s
        WHERE unaccent(s."title") ILIKE unaccent(${pattern})
        ORDER BY s."votingDate" DESC
        LIMIT ${LIMIT}
      `,

      // Fact-checks: accent-insensitive on title, filtered by allowed sources
      db.$queryRaw<RawFactCheck[]>`
        SELECT DISTINCT ON (fc."id")
               fc."slug", fc."title", fc."source", fc."verdictRating", fc."publishedAt",
               pol."fullName" AS "politicianName"
        FROM "FactCheck" fc
        LEFT JOIN "FactCheckMention" fcm ON fcm."factCheckId" = fc."id"
        LEFT JOIN "Politician" pol ON pol."id" = fcm."politicianId"
        WHERE fc."source" = ANY(${FACTCHECK_ALLOWED_SOURCES})
          AND unaccent(fc."title") ILIKE unaccent(${pattern})
        ORDER BY fc."id", fc."publishedAt" DESC
        LIMIT ${LIMIT}
      `,

      // Legislative dossiers: accent-insensitive on title/shortTitle
      db.$queryRaw<RawDossier[]>`
        SELECT d."slug", d."title", d."shortTitle", d."status", d."filingDate"
        FROM "LegislativeDossier" d
        WHERE unaccent(d."title") ILIKE unaccent(${pattern})
           OR unaccent(COALESCE(d."shortTitle", '')) ILIKE unaccent(${pattern})
        ORDER BY d."filingDate" DESC NULLS LAST
        LIMIT ${LIMIT}
      `,

      // Communes: accent-insensitive, startsWith for more relevant results
      db.$queryRaw<RawCommune[]>`
        SELECT c."id", c."name", c."departmentName", c."population"
        FROM "Commune" c
        WHERE unaccent(c."name") ILIKE unaccent(${startsWithPattern})
        ORDER BY c."population" DESC NULLS LAST
        LIMIT ${LIMIT}
      `,
    ]);

  return withCache(
    NextResponse.json({
      politicians: politicians.map((p) => ({
        id: p.id,
        slug: p.slug,
        fullName: p.fullName,
        photoUrl: p.photoUrl,
        party: p.partyShortName,
        partyColor: p.partyColor,
        mandate: p.mandateType,
      })),
      parties: parties.map((p) => ({
        slug: p.slug,
        name: p.name,
        shortName: p.shortName,
        color: p.color,
        memberCount: Number(p.memberCount),
      })),
      affairs: affairs.map((a) => ({
        slug: a.slug,
        title: a.title,
        status: a.status,
        politicianName: a.politicianName,
        politicianSlug: a.politicianSlug,
      })),
      scrutins: scrutins.map((s) => ({
        slug: s.slug,
        id: s.id,
        title: s.title,
        votingDate: s.votingDate.toISOString(),
        chamber: s.chamber,
      })),
      factchecks: factchecks.map((fc) => ({
        slug: fc.slug,
        title: fc.title,
        source: fc.source,
        verdictRating: fc.verdictRating,
        publishedAt: fc.publishedAt.toISOString(),
        politicianName: fc.politicianName,
      })),
      dossiers: dossiers.map((d) => ({
        slug: d.slug,
        title: d.title,
        shortTitle: d.shortTitle,
        status: d.status,
        filingDate: d.filingDate?.toISOString() || null,
      })),
      communes: communes.map((c) => ({
        id: c.id,
        name: c.name,
        departmentName: c.departmentName,
        population: c.population,
      })),
    }),
    "daily"
  );
}
