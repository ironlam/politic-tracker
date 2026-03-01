import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { withCache } from "@/lib/cache";

type CommuneRow = {
  id: string;
  name: string;
  departmentCode: string;
  departmentName: string;
  population: number | null;
  totalSeats: number | null;
};

type CandidacyStats = {
  communeId: string;
  listCount: number;
  candidateCount: number;
};

type CommuneResult = CommuneRow & {
  listCount: number;
  candidateCount: number;
};

async function getCandidacyStats(
  communeIds: string[]
): Promise<Map<string, { listCount: number; candidateCount: number }>> {
  if (communeIds.length === 0) return new Map();

  const stats = await db.$queryRaw<CandidacyStats[]>(Prisma.sql`
    SELECT c."communeId",
           COUNT(DISTINCT c."listName")::int as "listCount",
           COUNT(*)::int as "candidateCount"
    FROM "Candidacy" c
    WHERE c."communeId" = ANY(${communeIds}::text[])
    GROUP BY c."communeId"
  `);

  const map = new Map<string, { listCount: number; candidateCount: number }>();
  for (const row of stats) {
    map.set(row.communeId, {
      listCount: row.listCount,
      candidateCount: row.candidateCount,
    });
  }
  return map;
}

function formatResults(
  communes: CommuneRow[],
  statsMap: Map<string, { listCount: number; candidateCount: number }>
): CommuneResult[] {
  return communes.map((c) => {
    const stats = statsMap.get(c.id);
    return {
      id: c.id,
      name: c.name,
      departmentCode: c.departmentCode,
      departmentName: c.departmentName,
      population: c.population,
      totalSeats: c.totalSeats,
      listCount: stats?.listCount ?? 0,
      candidateCount: stats?.candidateCount ?? 0,
    };
  });
}

/**
 * @openapi
 * /api/elections/municipales-2026/communes:
 *   get:
 *     summary: Recherche de communes pour les municipales 2026
 *     description: >
 *       Trois modes de recherche :
 *       - `q` : recherche textuelle sur le nom ou code postal (min 2 chars, max 8 résultats)
 *       - `lat` + `lon` : géolocalisation inversée via geo.api.gouv.fr
 *       - `dept` : filtre par code département
 *     tags: [Municipales 2026]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Terme de recherche (nom de commune ou code postal)
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude pour géolocalisation inversée
 *       - in: query
 *         name: lon
 *         schema:
 *           type: number
 *         description: Longitude pour géolocalisation inversée
 *       - in: query
 *         name: dept
 *         schema:
 *           type: string
 *         description: Code département (ex. "13", "75", "2A")
 *     responses:
 *       200:
 *         description: Liste de communes avec statistiques de candidatures
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: Code INSEE
 *                   name:
 *                     type: string
 *                   departmentCode:
 *                     type: string
 *                   departmentName:
 *                     type: string
 *                   population:
 *                     type: integer
 *                     nullable: true
 *                   totalSeats:
 *                     type: integer
 *                     nullable: true
 *                   listCount:
 *                     type: integer
 *                   candidateCount:
 *                     type: integer
 *       400:
 *         description: Paramètres invalides
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const dept = searchParams.get("dept");

  // Mode 1: Text search by name or postal code
  if (query !== null) {
    return handleTextSearch(query);
  }

  // Mode 2: Geolocation reverse geocode
  if (lat !== null && lon !== null) {
    return handleGeolocation(lat, lon);
  }

  // Mode 3: Department filter
  if (dept !== null) {
    return handleDepartmentFilter(dept);
  }

  return NextResponse.json({ error: "Paramètre requis : q, lat+lon, ou dept" }, { status: 400 });
}

// ─── Mode 1: Text search ────────────────────────────────────────

async function handleTextSearch(query: string): Promise<Response> {
  if (query.length < 2) {
    return NextResponse.json([]);
  }

  const isPostalCode = /^\d{2,5}$/.test(query);

  let communes: CommuneRow[];

  if (isPostalCode) {
    if (query.length === 5) {
      // Exact 5-digit postal code match
      communes = await db.commune.findMany({
        where: {
          postalCodes: { has: query },
        },
        select: {
          id: true,
          name: true,
          departmentCode: true,
          departmentName: true,
          population: true,
          totalSeats: true,
        },
        orderBy: { population: "desc" },
        take: 8,
      });
    } else if (query.length <= 3) {
      // 2-3 digits: interpret as department code prefix
      communes = await db.commune.findMany({
        where: { departmentCode: query },
        select: {
          id: true,
          name: true,
          departmentCode: true,
          departmentName: true,
          population: true,
          totalSeats: true,
        },
        orderBy: { population: "desc" },
        take: 8,
      });
    } else {
      // 4 digits: partial postal code — no efficient way to search, fall through to name search
      communes = await db.commune.findMany({
        where: {
          name: { contains: query, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          departmentCode: true,
          departmentName: true,
          population: true,
          totalSeats: true,
        },
        orderBy: { population: "desc" },
        take: 8,
      });
    }
  } else {
    // Search by commune name (ILIKE — uses pg_trgm index)
    communes = await db.commune.findMany({
      where: {
        name: { contains: query, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        departmentCode: true,
        departmentName: true,
        population: true,
        totalSeats: true,
      },
      orderBy: { population: "desc" },
      take: 8,
    });
  }

  const communeIds = communes.map((c) => c.id);
  const statsMap = await getCandidacyStats(communeIds);

  // Text search is NOT cached (free text = unbounded cache keys)
  return NextResponse.json(formatResults(communes, statsMap));
}

// ─── Mode 2: Geolocation ────────────────────────────────────────

async function handleGeolocation(latStr: string, lonStr: string): Promise<Response> {
  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json(
      { error: "lat et lon doivent être des nombres valides" },
      { status: 400 }
    );
  }

  // Validate coordinate ranges
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "Coordonnées hors limites" }, { status: 400 });
  }

  try {
    const geoRes = await fetch(
      `https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lon}&limit=1`,
      { next: { revalidate: 86400 } } // Cache geo API response for 1 day
    );

    if (!geoRes.ok) {
      return NextResponse.json({ error: "Erreur lors de la géolocalisation" }, { status: 502 });
    }

    const geoData = (await geoRes.json()) as Array<{ code: string }>;

    if (geoData.length === 0) {
      return NextResponse.json([]);
    }

    const inseeCode = geoData[0]!.code;

    const commune = await db.commune.findUnique({
      where: { id: inseeCode },
      select: {
        id: true,
        name: true,
        departmentCode: true,
        departmentName: true,
        population: true,
        totalSeats: true,
      },
    });

    if (!commune) {
      return NextResponse.json([]);
    }

    const statsMap = await getCandidacyStats([commune.id]);
    return NextResponse.json(formatResults([commune], statsMap));
  } catch {
    return NextResponse.json({ error: "Erreur lors de la géolocalisation" }, { status: 502 });
  }
}

// ─── Mode 3: Department filter ──────────────────────────────────

async function handleDepartmentFilter(dept: string): Promise<Response> {
  // Validate department code format (1-3 alphanumeric chars: "01", "2A", "974")
  if (!/^[0-9]{1,3}[AB]?$/i.test(dept)) {
    return NextResponse.json({ error: "Code département invalide" }, { status: 400 });
  }

  const deptCode = dept.toUpperCase();

  const communes = await db.commune.findMany({
    where: { departmentCode: deptCode },
    select: {
      id: true,
      name: true,
      departmentCode: true,
      departmentName: true,
      population: true,
      totalSeats: true,
    },
    orderBy: { population: "desc" },
    take: 100,
  });

  const communeIds = communes.map((c) => c.id);
  const statsMap = await getCandidacyStats(communeIds);

  // Department filter IS cached (bounded set of ~101 departments)
  return withCache(NextResponse.json(formatResults(communes, statsMap)), "daily");
}
