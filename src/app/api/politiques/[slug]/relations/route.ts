import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RelationType, GraphNode, GraphLink, RelationsResponse } from "@/types/relations";
import { RELATION_TYPE_STRENGTH, ALL_RELATION_TYPES } from "@/config/relations";
import { MandateType } from "@/generated/prisma";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const GOVERNMENT_TYPES: MandateType[] = [
  "MINISTRE",
  "PREMIER_MINISTRE",
  "MINISTRE_DELEGUE",
  "SECRETAIRE_ETAT",
];

/**
 * @openapi
 * /api/politiques/{slug}/relations:
 *   get:
 *     summary: Relations d'un représentant
 *     description: Retourne le graphe des relations d'un représentant (même parti, gouvernement, législature, etc.)
 *     tags: [Relations]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug du représentant
 *         example: emmanuel-macron
 *       - in: query
 *         name: types
 *         schema:
 *           type: string
 *         description: Types de relations à inclure (séparés par virgules)
 *         example: SAME_PARTY,SAME_GOVERNMENT
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *         description: Nombre max de connexions par type
 *     responses:
 *       200:
 *         description: Graphe des relations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 center:
 *                   type: object
 *                   description: Le représentant central
 *                 nodes:
 *                   type: array
 *                   description: Représentants connectés
 *                 links:
 *                   type: array
 *                   description: Liens entre représentants
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalConnections:
 *                       type: integer
 *                     byType:
 *                       type: object
 *       404:
 *         description: Représentant non trouvé
 *       500:
 *         description: Erreur serveur
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);

  const typesParam = searchParams.get("types");
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));

  const requestedTypes: RelationType[] = typesParam
    ? (typesParam.split(",").filter((t) => ALL_RELATION_TYPES.includes(t as RelationType)) as RelationType[])
    : ALL_RELATION_TYPES;

  try {
    // Get the central politician with their mandates and party history
    const politician = await db.politician.findUnique({
      where: { slug },
      include: {
        currentParty: { select: { id: true, shortName: true, color: true } },
        mandates: {
          select: {
            id: true,
            type: true,
            startDate: true,
            endDate: true,
            isCurrent: true,
            constituency: true,
            europeanGroupId: true,
          },
        },
        partyHistory: {
          select: { partyId: true },
        },
      },
    });

    if (!politician) {
      return NextResponse.json({ error: "Politique non trouvé" }, { status: 404 });
    }

    // Build center node
    const currentMandate = politician.mandates.find((m) => m.isCurrent);
    const center: GraphNode = {
      id: politician.id,
      slug: politician.slug,
      fullName: politician.fullName,
      photoUrl: politician.photoUrl,
      party: politician.currentParty,
      mandateType: currentMandate?.type || null,
    };

    const nodesMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    const stats: Partial<Record<RelationType, number>> = {};

    // Helper to add a node
    const addNode = (p: {
      id: string;
      slug: string;
      fullName: string;
      photoUrl: string | null;
      currentParty: { shortName: string; color: string | null } | null;
      mandates?: { type: MandateType; isCurrent: boolean }[];
    }) => {
      if (p.id === politician.id || nodesMap.has(p.id)) return;
      const mandate = p.mandates?.find((m) => m.isCurrent);
      nodesMap.set(p.id, {
        id: p.id,
        slug: p.slug,
        fullName: p.fullName,
        photoUrl: p.photoUrl,
        party: p.currentParty,
        mandateType: mandate?.type || null,
      });
    };

    // Helper to add a link
    const addLink = (targetId: string, type: RelationType, label?: string) => {
      if (targetId === politician.id) return;
      // Check if link already exists
      const existing = links.find(
        (l) => l.source === politician.id && l.target === targetId && l.type === type
      );
      if (existing) return;

      links.push({
        source: politician.id,
        target: targetId,
        type,
        strength: RELATION_TYPE_STRENGTH[type],
        label,
      });
      stats[type] = (stats[type] || 0) + 1;
    };

    // 1. SAME_PARTY - Same current party
    if (requestedTypes.includes("SAME_PARTY") && politician.currentParty) {
      const sameParty = await db.politician.findMany({
        where: {
          currentPartyId: politician.currentParty.id,
          id: { not: politician.id },
        },
        select: {
          id: true,
          slug: true,
          fullName: true,
          photoUrl: true,
          currentParty: { select: { shortName: true, color: true } },
          mandates: {
            where: { isCurrent: true },
            select: { type: true, isCurrent: true },
            take: 1,
          },
        },
        take: limit,
      });

      for (const p of sameParty) {
        addNode(p);
        addLink(p.id, "SAME_PARTY");
      }
    }

    // 2. SAME_GOVERNMENT - Overlapping government mandates
    if (requestedTypes.includes("SAME_GOVERNMENT")) {
      const govMandates = politician.mandates.filter((m) => GOVERNMENT_TYPES.includes(m.type));

      for (const mandate of govMandates) {
        const colleagues = await db.politician.findMany({
          where: {
            id: { not: politician.id },
            mandates: {
              some: {
                type: { in: GOVERNMENT_TYPES },
                OR: [
                  // Overlapping dates
                  {
                    startDate: { lte: mandate.endDate || new Date() },
                    endDate: { gte: mandate.startDate },
                  },
                  // Both current
                  {
                    isCurrent: true,
                    startDate: { lte: mandate.endDate || new Date() },
                  },
                ],
              },
            },
          },
          select: {
            id: true,
            slug: true,
            fullName: true,
            photoUrl: true,
            currentParty: { select: { shortName: true, color: true } },
            mandates: {
              where: { type: { in: GOVERNMENT_TYPES } },
              select: { type: true, isCurrent: true, title: true },
              take: 1,
            },
          },
          take: limit,
        });

        for (const p of colleagues) {
          addNode(p);
          addLink(p.id, "SAME_GOVERNMENT");
        }
      }
    }

    // 3. SAME_LEGISLATURE - Same legislative period
    if (requestedTypes.includes("SAME_LEGISLATURE")) {
      const deputeMandate = politician.mandates.find((m) => m.type === "DEPUTE" && m.isCurrent);

      if (deputeMandate) {
        const colleagues = await db.politician.findMany({
          where: {
            id: { not: politician.id },
            mandates: {
              some: {
                type: "DEPUTE",
                isCurrent: true,
              },
            },
          },
          select: {
            id: true,
            slug: true,
            fullName: true,
            photoUrl: true,
            currentParty: { select: { shortName: true, color: true } },
            mandates: {
              where: { type: "DEPUTE", isCurrent: true },
              select: { type: true, isCurrent: true },
              take: 1,
            },
          },
          take: limit,
        });

        for (const p of colleagues) {
          addNode(p);
          addLink(p.id, "SAME_LEGISLATURE");
        }
      }
    }

    // 4. SAME_CONSTITUENCY - Same department
    if (requestedTypes.includes("SAME_CONSTITUENCY")) {
      const deputeMandate = politician.mandates.find((m) => m.type === "DEPUTE" && m.constituency);

      if (deputeMandate?.constituency) {
        // Extract department name (before the parenthesis)
        const department = deputeMandate.constituency.split("(")[0].trim();

        const sameDept = await db.politician.findMany({
          where: {
            id: { not: politician.id },
            mandates: {
              some: {
                type: "DEPUTE",
                isCurrent: true,
                constituency: { startsWith: department, mode: "insensitive" },
              },
            },
          },
          select: {
            id: true,
            slug: true,
            fullName: true,
            photoUrl: true,
            currentParty: { select: { shortName: true, color: true } },
            mandates: {
              where: { type: "DEPUTE", isCurrent: true },
              select: { type: true, isCurrent: true, constituency: true },
              take: 1,
            },
          },
          take: limit,
        });

        for (const p of sameDept) {
          addNode(p);
          addLink(p.id, "SAME_CONSTITUENCY", department);
        }
      }
    }

    // 5. SAME_EUROPEAN_GROUP - Same EU Parliament group
    if (requestedTypes.includes("SAME_EUROPEAN_GROUP")) {
      const mepMandate = politician.mandates.find(
        (m) => m.type === "DEPUTE_EUROPEEN" && m.europeanGroupId
      );

      if (mepMandate?.europeanGroupId) {
        const sameGroup = await db.politician.findMany({
          where: {
            id: { not: politician.id },
            mandates: {
              some: {
                type: "DEPUTE_EUROPEEN",
                europeanGroupId: mepMandate.europeanGroupId,
                isCurrent: true,
              },
            },
          },
          select: {
            id: true,
            slug: true,
            fullName: true,
            photoUrl: true,
            currentParty: { select: { shortName: true, color: true } },
            mandates: {
              where: { type: "DEPUTE_EUROPEEN", isCurrent: true },
              select: { type: true, isCurrent: true },
              take: 1,
            },
          },
          take: limit,
        });

        for (const p of sameGroup) {
          addNode(p);
          addLink(p.id, "SAME_EUROPEAN_GROUP");
        }
      }
    }

    // 6. PARTY_HISTORY - Shared past party membership
    if (requestedTypes.includes("PARTY_HISTORY")) {
      const partyIds = politician.partyHistory.map((h) => h.partyId);

      if (partyIds.length > 0) {
        const formerColleagues = await db.politician.findMany({
          where: {
            id: { not: politician.id },
            partyHistory: {
              some: { partyId: { in: partyIds } },
            },
          },
          select: {
            id: true,
            slug: true,
            fullName: true,
            photoUrl: true,
            currentParty: { select: { shortName: true, color: true } },
            mandates: {
              where: { isCurrent: true },
              select: { type: true, isCurrent: true },
              take: 1,
            },
          },
          take: limit,
        });

        for (const p of formerColleagues) {
          addNode(p);
          addLink(p.id, "PARTY_HISTORY");
        }
      }
    }

    const response: RelationsResponse = {
      center,
      nodes: Array.from(nodesMap.values()),
      links,
      stats: {
        totalConnections: links.length,
        byType: stats,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
