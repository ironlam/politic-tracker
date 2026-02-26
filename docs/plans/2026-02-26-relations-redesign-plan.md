# Relations Module Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the unreadable force-directed graph with a deterministic SVG radial cluster layout, focusing on 4 high-value relation categories.

**Architecture:** D3 math (d3-scale, d3-shape) for layout computation, native React SVG for rendering. Preview (simplified, static) + fullscreen `<dialog>` (interactive, zoomable). API returns clustered data instead of flat nodes/links.

**Tech Stack:** Next.js 16, React, SVG, d3-scale, d3-shape, Prisma 7, TypeScript

**Design doc:** `docs/plans/2026-02-26-relations-redesign-design.md`

---

### Task 1: Install d3 dependencies & remove react-force-graph-2d

**Files:**
- Modify: `package.json`

**Step 1: Install d3 math modules**

```bash
npm install d3-scale d3-shape
npm install -D @types/d3-scale @types/d3-shape
```

**Step 2: Remove react-force-graph-2d**

```bash
npm uninstall react-force-graph-2d
```

**Step 3: Verify**

```bash
npm ls d3-scale d3-shape && echo "OK"
npm ls react-force-graph-2d 2>&1 | grep -q "empty" && echo "Removed OK"
```

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: swap react-force-graph-2d for d3-scale/d3-shape"
```

---

### Task 2: Prisma migration — add governmentName to Mandate

**Files:**
- Modify: `prisma/schema.prisma` (Mandate model, around line 196)
- Create: new migration file (auto-generated)

**Step 1: Add field to Mandate model**

In `prisma/schema.prisma`, add to the Mandate model after the `institution` field:

```prisma
  governmentName String? // Ex: "Gouvernement Borne", populated by sync:government
```

**Step 2: Generate migration**

```bash
npx prisma migrate dev --name add-government-name-to-mandate
```

**Step 3: Regenerate Prisma client**

```bash
npm run db:generate
```

**Step 4: Verify**

```bash
npx prisma validate && echo "Schema OK"
```

**Step 5: Commit**

```bash
git add prisma/ src/generated/
git commit -m "feat(db): add governmentName field to Mandate model"
```

---

### Task 3: Backfill governmentName from existing mandate data

**Files:**
- Create: `scripts/backfill-government-name.ts`
- Modify: `src/services/sync/government.ts` (add governmentName to sync)

**Step 1: Write backfill script**

Create `scripts/backfill-government-name.ts`:

```typescript
/**
 * Backfill governmentName on existing government mandates.
 * The institution field already contains "Gouvernement {name}" — extract the name.
 */
import { PrismaClient } from "@/generated/prisma";

const db = new PrismaClient();

async function main() {
  const govMandates = await db.mandate.findMany({
    where: {
      type: { in: ["MINISTRE", "PREMIER_MINISTRE", "MINISTRE_DELEGUE", "SECRETAIRE_ETAT"] },
      governmentName: null,
    },
    select: { id: true, institution: true },
  });

  console.log(`Found ${govMandates.length} government mandates to backfill`);

  let updated = 0;
  for (const mandate of govMandates) {
    // institution is "Gouvernement {name}" — extract name
    const match = mandate.institution.match(/^Gouvernement\s+(.+)$/i);
    if (match) {
      await db.mandate.update({
        where: { id: mandate.id },
        data: { governmentName: `Gouvernement ${match[1]}` },
      });
      updated++;
    }
  }

  console.log(`Updated ${updated} mandates`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
```

**Step 2: Run backfill**

```bash
npx dotenv -e .env -- npx tsx scripts/backfill-government-name.ts
```

**Step 3: Update government sync to populate governmentName on future imports**

In `src/services/sync/government.ts`, find the `mandateData` object (around line 209) and add:

```typescript
governmentName: `Gouvernement ${member.gouvernement}`,
```

**Step 4: Verify**

```bash
npx dotenv -e .env -- npx tsx -e "
  const { PrismaClient } = require('@/generated/prisma');
  const db = new PrismaClient();
  db.mandate.count({ where: { governmentName: { not: null } } })
    .then(c => { console.log('Mandates with governmentName:', c); db.\$disconnect(); });
"
```

**Step 5: Commit**

```bash
git add scripts/backfill-government-name.ts src/services/sync/government.ts
git commit -m "feat(data): backfill governmentName and update government sync"
```

---

### Task 4: Rewrite types and config

**Files:**
- Rewrite: `src/types/relations.ts`
- Rewrite: `src/config/relations.ts`

**Step 1: Rewrite types**

Replace `src/types/relations.ts` entirely:

```typescript
import { MandateType } from "@/generated/prisma";

export type RelationType =
  | "SAME_GOVERNMENT"
  | "SHARED_COMPANY"
  | "SAME_DEPARTMENT"
  | "PARTY_HISTORY";

export interface GraphNode {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  party: {
    shortName: string;
    color: string | null;
  } | null;
  mandateType: MandateType | null;
}

export interface GraphLink {
  source: string; // center politician ID
  target: string; // related politician ID
  type: RelationType;
  label?: string; // e.g., "SCI La Forestière"
}

export interface Cluster {
  type: RelationType;
  label: string; // e.g., "Gouvernement Borne (2022-2024)"
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface RelationsResponse {
  center: GraphNode;
  clusters: Cluster[];
  stats: {
    totalConnections: number;
    byType: Partial<Record<RelationType, number>>;
  };
}
```

**Step 2: Rewrite config**

Replace `src/config/relations.ts` entirely:

```typescript
import { RelationType } from "@/types/relations";

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  SAME_GOVERNMENT: "Même gouvernement",
  SHARED_COMPANY: "Entreprises en commun",
  SAME_DEPARTMENT: "Même département",
  PARTY_HISTORY: "Anciens collègues de parti",
};

export const RELATION_TYPE_COLORS: Record<RelationType, string> = {
  SAME_GOVERNMENT: "#8B5CF6", // purple
  SHARED_COMPANY: "#F59E0B", // amber
  SAME_DEPARTMENT: "#10B981", // green
  PARTY_HISTORY: "#6B7280", // gray
};

export const RELATION_TYPE_DESCRIPTIONS: Record<RelationType, string> = {
  SAME_GOVERNMENT: "Ont siégé ensemble au gouvernement",
  SHARED_COMPANY: "Détiennent des participations dans les mêmes entreprises ou SCI",
  SAME_DEPARTMENT: "Élus dans le même département",
  PARTY_HISTORY: "Ont été membres du même parti dans le passé",
};

export const ALL_RELATION_TYPES: RelationType[] = [
  "SAME_GOVERNMENT",
  "SHARED_COMPANY",
  "SAME_DEPARTMENT",
  "PARTY_HISTORY",
];

export const DEFAULT_RELATION_TYPES: RelationType[] = ALL_RELATION_TYPES;
```

**Step 3: Verify TypeScript compiles (will have errors in dependent files — that's expected)**

```bash
npx tsc --noEmit src/types/relations.ts src/config/relations.ts 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/types/relations.ts src/config/relations.ts
git commit -m "feat(relations): rewrite types and config for 4 cluster categories"
```

---

### Task 5: Rewrite API route — clustered response

**Files:**
- Rewrite: `src/app/api/politiques/[slug]/relations/route.ts`

**Step 1: Rewrite the entire route**

Replace `src/app/api/politiques/[slug]/relations/route.ts` with the new implementation. Key changes:
- Return `clusters[]` instead of flat `nodes[]` + `links[]`
- Add `SHARED_COMPANY` query via Declaration.details JSON
- Use `governmentName` for government grouping
- Remove `SAME_PARTY`, `SAME_LEGISLATURE`, `SAME_EUROPEAN_GROUP`
- Keep `SAME_DEPARTMENT` (renamed from `SAME_CONSTITUENCY`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withCache } from "@/lib/cache";
import { Prisma, MandateType } from "@/generated/prisma";
import {
  RelationType,
  GraphNode,
  GraphLink,
  Cluster,
  RelationsResponse,
} from "@/types/relations";
import { ALL_RELATION_TYPES } from "@/config/relations";
import { DeclarationDetails } from "@/types/hatvp";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const GOVERNMENT_TYPES: MandateType[] = [
  "MINISTRE",
  "PREMIER_MINISTRE",
  "MINISTRE_DELEGUE",
  "SECRETAIRE_ETAT",
];

// Helper to build a GraphNode from a Prisma result
function toGraphNode(p: {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  currentParty: { shortName: string; color: string | null } | null;
  mandates?: { type: MandateType; isCurrent: boolean }[];
}): GraphNode {
  const mandate = p.mandates?.find((m) => m.isCurrent);
  return {
    id: p.id,
    slug: p.slug,
    fullName: p.fullName,
    photoUrl: p.photoUrl,
    party: p.currentParty,
    mandateType: mandate?.type || null,
  };
}

const POLITICIAN_SELECT = {
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
} as const;

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);

  const typesParam = searchParams.get("types");
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));

  const requestedTypes: RelationType[] = typesParam
    ? (typesParam
        .split(",")
        .filter((t) => ALL_RELATION_TYPES.includes(t as RelationType)) as RelationType[])
    : ALL_RELATION_TYPES;

  try {
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
            departmentCode: true,
            governmentName: true,
          },
        },
        partyHistory: { select: { partyId: true } },
        declarations: {
          where: { details: { not: Prisma.DbNull } },
          select: { details: true },
          orderBy: { year: "desc" },
          take: 1,
        },
      },
    });

    if (!politician) {
      return NextResponse.json({ error: "Politique non trouvé" }, { status: 404 });
    }

    const currentMandate = politician.mandates.find((m) => m.isCurrent);
    const center: GraphNode = {
      id: politician.id,
      slug: politician.slug,
      fullName: politician.fullName,
      photoUrl: politician.photoUrl,
      party: politician.currentParty,
      mandateType: currentMandate?.type || null,
    };

    const clusters: Cluster[] = [];

    // --- SAME_GOVERNMENT ---
    if (requestedTypes.includes("SAME_GOVERNMENT")) {
      const govMandates = politician.mandates.filter(
        (m) => GOVERNMENT_TYPES.includes(m.type) && m.governmentName
      );

      // Group by government name for distinct clusters
      const govGroups = new Map<string, typeof govMandates>();
      for (const m of govMandates) {
        const name = m.governmentName!;
        if (!govGroups.has(name)) govGroups.set(name, []);
        govGroups.get(name)!.push(m);
      }

      for (const [govName, mandates] of govGroups) {
        const mandate = mandates[0];
        const colleagues = await db.politician.findMany({
          where: {
            id: { not: politician.id },
            mandates: {
              some: {
                governmentName: govName,
                type: { in: GOVERNMENT_TYPES },
              },
            },
          },
          select: POLITICIAN_SELECT,
          take: limit,
        });

        if (colleagues.length > 0) {
          const nodes = colleagues.map(toGraphNode);
          const links: GraphLink[] = nodes.map((n) => ({
            source: politician.id,
            target: n.id,
            type: "SAME_GOVERNMENT" as RelationType,
            label: govName,
          }));

          const dateRange = mandate.endDate
            ? `(${mandate.startDate.getFullYear()}-${mandate.endDate.getFullYear()})`
            : `(depuis ${mandate.startDate.getFullYear()})`;

          clusters.push({
            type: "SAME_GOVERNMENT",
            label: `${govName} ${dateRange}`,
            nodes,
            links,
          });
        }
      }
    }

    // --- SHARED_COMPANY ---
    if (requestedTypes.includes("SHARED_COMPANY")) {
      const declaration = politician.declarations[0];
      if (declaration?.details) {
        const details = declaration.details as unknown as DeclarationDetails;
        const companies = new Set<string>();

        // Collect company names from participations and directorships
        for (const fp of details.financialParticipations || []) {
          if (fp.company && !fp.company.includes("[Données non publiées]")) {
            companies.add(fp.company.toUpperCase().trim());
          }
        }
        for (const d of details.directorships || []) {
          if (d.company && !d.company.includes("[Données non publiées]")) {
            companies.add(d.company.toUpperCase().trim());
          }
        }

        if (companies.size > 0) {
          // Find politicians who share any of these companies in their declarations
          const companyArray = Array.from(companies);

          // Raw query to search within JSON details for matching company names
          // We need to find declarations where details->'financialParticipations' or details->'directorships'
          // contain a matching company name
          const matchingDeclarations = await db.declaration.findMany({
            where: {
              politicianId: { not: politician.id },
              details: { not: Prisma.DbNull },
            },
            select: {
              politicianId: true,
              details: true,
              politician: { select: POLITICIAN_SELECT },
            },
            take: 200, // Fetch more, filter in JS
          });

          const companyMatches = new Map<string, { node: GraphNode; companies: string[] }>();

          for (const decl of matchingDeclarations) {
            const d = decl.details as unknown as DeclarationDetails;
            const sharedCompanies: string[] = [];

            for (const fp of d.financialParticipations || []) {
              if (fp.company && companyArray.includes(fp.company.toUpperCase().trim())) {
                sharedCompanies.push(fp.company.trim());
              }
            }
            for (const dir of d.directorships || []) {
              if (dir.company && companyArray.includes(dir.company.toUpperCase().trim())) {
                sharedCompanies.push(dir.company.trim());
              }
            }

            if (sharedCompanies.length > 0 && !companyMatches.has(decl.politicianId)) {
              companyMatches.set(decl.politicianId, {
                node: toGraphNode(decl.politician),
                companies: [...new Set(sharedCompanies)],
              });
            }
          }

          // Take top N by number of shared companies
          const sorted = Array.from(companyMatches.values())
            .sort((a, b) => b.companies.length - a.companies.length)
            .slice(0, limit);

          if (sorted.length > 0) {
            const nodes = sorted.map((s) => s.node);
            const links: GraphLink[] = sorted.map((s) => ({
              source: politician.id,
              target: s.node.id,
              type: "SHARED_COMPANY" as RelationType,
              label: s.companies.join(", "),
            }));

            clusters.push({
              type: "SHARED_COMPANY",
              label: `${companies.size} entreprise${companies.size > 1 ? "s" : ""} déclarée${companies.size > 1 ? "s" : ""}`,
              nodes,
              links,
            });
          }
        }
      }
    }

    // --- SAME_DEPARTMENT ---
    if (requestedTypes.includes("SAME_DEPARTMENT")) {
      const deptMandate = politician.mandates.find((m) => m.departmentCode && m.isCurrent);

      if (deptMandate?.departmentCode) {
        const sameDept = await db.politician.findMany({
          where: {
            id: { not: politician.id },
            mandates: {
              some: {
                isCurrent: true,
                departmentCode: deptMandate.departmentCode,
              },
            },
          },
          select: POLITICIAN_SELECT,
          take: limit,
        });

        if (sameDept.length > 0) {
          // Get department name from constituency
          const deptName = deptMandate.constituency?.split("(")[0].trim() || deptMandate.departmentCode;

          const nodes = sameDept.map(toGraphNode);
          const links: GraphLink[] = nodes.map((n) => ({
            source: politician.id,
            target: n.id,
            type: "SAME_DEPARTMENT" as RelationType,
            label: deptName,
          }));

          clusters.push({
            type: "SAME_DEPARTMENT",
            label: deptName,
            nodes,
            links,
          });
        }
      }
    }

    // --- PARTY_HISTORY ---
    if (requestedTypes.includes("PARTY_HISTORY")) {
      const partyIds = politician.partyHistory.map((h) => h.partyId);

      if (partyIds.length > 0) {
        const formerColleagues = await db.politician.findMany({
          where: {
            id: { not: politician.id },
            // Exclude current party members — PARTY_HISTORY should show past connections only
            NOT: politician.currentParty
              ? { currentPartyId: politician.currentParty.id }
              : undefined,
            partyHistory: {
              some: { partyId: { in: partyIds } },
            },
          },
          select: POLITICIAN_SELECT,
          take: limit,
        });

        if (formerColleagues.length > 0) {
          const nodes = formerColleagues.map(toGraphNode);
          const links: GraphLink[] = nodes.map((n) => ({
            source: politician.id,
            target: n.id,
            type: "PARTY_HISTORY" as RelationType,
          }));

          clusters.push({
            type: "PARTY_HISTORY",
            label: "Anciens collègues de parti",
            nodes,
            links,
          });
        }
      }
    }

    const stats: RelationsResponse["stats"] = {
      totalConnections: clusters.reduce((sum, c) => sum + c.links.length, 0),
      byType: Object.fromEntries(
        clusters.map((c) => [c.type, c.links.length])
      ) as Partial<Record<RelationType, number>>,
    };

    const response: RelationsResponse = { center, clusters, stats };
    return withCache(NextResponse.json(response), "daily");
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
```

**Step 2: Verify the route compiles**

```bash
npx tsc --noEmit src/app/api/politiques/\[slug\]/relations/route.ts 2>&1 | head -20
```

**Step 3: Test with curl (dev server must be running)**

```bash
curl -s "http://localhost:3000/api/politiques/marine-le-pen/relations" | jq '.clusters | length'
```

**Step 4: Commit**

```bash
git add src/app/api/politiques/\[slug\]/relations/route.ts
git commit -m "feat(api): rewrite relations endpoint with clustered response format"
```

---

### Task 6: Create useRelationsLayout hook

**Files:**
- Create: `src/components/relations/useRelationsLayout.ts`

This is the core layout algorithm. It computes deterministic positions for all nodes in a radial cluster layout.

**Step 1: Create the hook**

Create `src/components/relations/useRelationsLayout.ts`:

```typescript
import { useMemo } from "react";
import { Cluster, GraphNode } from "@/types/relations";
import { RELATION_TYPE_COLORS } from "@/config/relations";

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  node: GraphNode;
  clusterType: string;
  isCenter: boolean;
  isOverflow: boolean; // "+N others" placeholder
  overflowCount?: number;
}

export interface LayoutLink {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  path: string; // SVG path "d" attribute (quadratic bezier)
  color: string;
  label?: string;
}

export interface LayoutClusterLabel {
  x: number;
  y: number;
  text: string;
  color: string;
  anchor: "start" | "middle" | "end";
}

export interface RelationsLayout {
  nodes: LayoutNode[];
  links: LayoutLink[];
  clusterLabels: LayoutClusterLabel[];
  viewBox: { x: number; y: number; width: number; height: number };
}

interface UseRelationsLayoutOptions {
  center: GraphNode;
  clusters: Cluster[];
  width: number;
  height: number;
  mode: "preview" | "full";
}

const PREVIEW_MAX_NODES_PER_CLUSTER = 3;
const NODE_RADIUS_CENTER = 28;
const NODE_RADIUS_NORMAL = 18;
const NODE_RADIUS_PREVIEW_CENTER = 24;
const NODE_RADIUS_PREVIEW_NORMAL = 14;

/**
 * Compute a quadratic bezier curve path from (sx,sy) to (tx,ty)
 * with a control point offset perpendicular to the line.
 */
function bezierPath(sx: number, sy: number, tx: number, ty: number): string {
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  // Perpendicular offset for curvature
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = len * 0.15;
  const cx = mx + (-dy / len) * offset;
  const cy = my + (dx / len) * offset;
  return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
}

/**
 * Position nodes in an arc around a cluster center point.
 * Returns array of {x, y} positions.
 */
function arcPositions(
  cx: number,
  cy: number,
  count: number,
  arcRadius: number,
  startAngle: number,
  arcSpan: number
): { x: number; y: number }[] {
  if (count === 0) return [];
  if (count === 1) {
    const angle = startAngle;
    return [{ x: cx + Math.cos(angle) * arcRadius, y: cy + Math.sin(angle) * arcRadius }];
  }
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = startAngle - arcSpan / 2 + t * arcSpan;
    return {
      x: cx + Math.cos(angle) * arcRadius,
      y: cy + Math.sin(angle) * arcRadius,
    };
  });
}

export function useRelationsLayout({
  center,
  clusters,
  width,
  height,
  mode,
}: UseRelationsLayoutOptions): RelationsLayout {
  return useMemo(() => {
    const isPreview = mode === "preview";
    const centerR = isPreview ? NODE_RADIUS_PREVIEW_CENTER : NODE_RADIUS_CENTER;
    const nodeR = isPreview ? NODE_RADIUS_PREVIEW_NORMAL : NODE_RADIUS_NORMAL;
    const cx = width / 2;
    const cy = height / 2;

    const activeClusters = clusters.filter((c) => c.nodes.length > 0);
    const clusterCount = activeClusters.length;

    if (clusterCount === 0) {
      return {
        nodes: [
          {
            id: center.id,
            x: cx,
            y: cy,
            radius: centerR,
            node: center,
            clusterType: "center",
            isCenter: true,
            isOverflow: false,
          },
        ],
        links: [],
        clusterLabels: [],
        viewBox: { x: 0, y: 0, width, height },
      };
    }

    // Distance from center to cluster center
    const clusterDistance = isPreview
      ? Math.min(width, height) * 0.32
      : Math.min(width, height) * 0.35;

    // Arc radius for nodes within a cluster
    const innerArcRadius = isPreview ? 45 : 60;

    const layoutNodes: LayoutNode[] = [];
    const layoutLinks: LayoutLink[] = [];
    const layoutLabels: LayoutClusterLabel[] = [];

    // Center node
    layoutNodes.push({
      id: center.id,
      x: cx,
      y: cy,
      radius: centerR,
      node: center,
      clusterType: "center",
      isCenter: true,
      isOverflow: false,
    });

    activeClusters.forEach((cluster, i) => {
      // Angle for this cluster (evenly distributed)
      const angle = (2 * Math.PI * i) / clusterCount - Math.PI / 2; // start from top
      const clusterCx = cx + Math.cos(angle) * clusterDistance;
      const clusterCy = cy + Math.sin(angle) * clusterDistance;

      // How many nodes to show
      const maxNodes = isPreview ? PREVIEW_MAX_NODES_PER_CLUSTER : cluster.nodes.length;
      const visibleNodes = cluster.nodes.slice(0, maxNodes);
      const overflowCount = cluster.nodes.length - visibleNodes.length;

      // Arc span depends on node count (wider for more nodes)
      const arcSpan = Math.min(Math.PI * 0.6, visibleNodes.length * 0.3 + 0.2);
      const positions = arcPositions(
        clusterCx,
        clusterCy,
        visibleNodes.length + (overflowCount > 0 ? 1 : 0),
        innerArcRadius,
        angle,
        arcSpan
      );

      // Add visible nodes
      visibleNodes.forEach((node, j) => {
        const pos = positions[j];
        layoutNodes.push({
          id: node.id,
          x: pos.x,
          y: pos.y,
          radius: nodeR,
          node,
          clusterType: cluster.type,
          isCenter: false,
          isOverflow: false,
        });

        // Link from center to this node
        const link = cluster.links.find((l) => l.target === node.id);
        layoutLinks.push({
          sourceX: cx,
          sourceY: cy,
          targetX: pos.x,
          targetY: pos.y,
          path: bezierPath(cx, cy, pos.x, pos.y),
          color: RELATION_TYPE_COLORS[cluster.type],
          label: link?.label,
        });
      });

      // Add overflow node if needed
      if (overflowCount > 0) {
        const overflowPos = positions[positions.length - 1];
        layoutNodes.push({
          id: `overflow-${cluster.type}`,
          x: overflowPos.x,
          y: overflowPos.y,
          radius: nodeR * 0.8,
          node: {
            id: `overflow-${cluster.type}`,
            slug: "",
            fullName: `+${overflowCount}`,
            photoUrl: null,
            party: null,
            mandateType: null,
          },
          clusterType: cluster.type,
          isCenter: false,
          isOverflow: true,
          overflowCount,
        });
      }

      // Cluster label
      const labelOffset = innerArcRadius + nodeR + 16;
      const labelX = clusterCx + Math.cos(angle) * labelOffset * 0.3;
      const labelY = clusterCy - innerArcRadius - 20;

      // Determine text anchor based on angle
      let anchor: "start" | "middle" | "end" = "middle";
      if (angle > Math.PI * 0.1 && angle < Math.PI * 0.9) anchor = "start";
      if (angle > Math.PI * 1.1 && angle < Math.PI * 1.9) anchor = "end";

      const countSuffix = isPreview ? ` · ${cluster.nodes.length}` : "";
      layoutLabels.push({
        x: clusterCx,
        y: labelY,
        text: `${cluster.label}${countSuffix}`,
        color: RELATION_TYPE_COLORS[cluster.type],
        anchor,
      });
    });

    // Compute viewBox to fit all nodes with padding
    const padding = isPreview ? 40 : 60;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of layoutNodes) {
      minX = Math.min(minX, n.x - n.radius - padding);
      minY = Math.min(minY, n.y - n.radius - padding - 20); // extra for labels
      maxX = Math.max(maxX, n.x + n.radius + padding);
      maxY = Math.max(maxY, n.y + n.radius + padding);
    }
    for (const l of layoutLabels) {
      minY = Math.min(minY, l.y - 20);
    }

    return {
      nodes: layoutNodes,
      links: layoutLinks,
      clusterLabels: layoutLabels,
      viewBox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
    };
  }, [center, clusters, width, height, mode]);
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/components/relations/useRelationsLayout.ts 2>&1 | head -10
```

**Step 3: Commit**

```bash
git add src/components/relations/useRelationsLayout.ts
git commit -m "feat(relations): add useRelationsLayout hook for radial cluster positioning"
```

---

### Task 7: Create RelationsPreview component

**Files:**
- Create: `src/components/relations/RelationsPreview.tsx`

**Step 1: Create the component**

Create `src/components/relations/RelationsPreview.tsx`:

```typescript
"use client";

import { useRef, useState, useEffect } from "react";
import { GraphNode, Cluster } from "@/types/relations";
import { useRelationsLayout } from "./useRelationsLayout";
import { RELATION_TYPE_COLORS } from "@/config/relations";

interface RelationsPreviewProps {
  center: GraphNode;
  clusters: Cluster[];
  totalConnections: number;
  onOpen: () => void;
}

export function RelationsPreview({
  center,
  clusters,
  totalConnections,
  onOpen,
}: RelationsPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 320 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width;
        const isMobile = width < 640;
        setDimensions({ width, height: isMobile ? 240 : 320 });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const layout = useRelationsLayout({
    center,
    clusters,
    width: dimensions.width,
    height: dimensions.height,
    mode: "preview",
  });

  // Generate aria-label describing the network
  const ariaDescription = `Réseau de relations de ${center.fullName} : ${clusters
    .map((c) => `${c.nodes.length} ${c.label}`)
    .join(", ")}. ${totalConnections} connexions au total.`;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={onOpen}
        className="w-full border rounded-lg overflow-hidden bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={`Explorer les relations de ${center.fullName}. ${ariaDescription}`}
      >
        <svg
          role="img"
          aria-label={ariaDescription}
          viewBox={`${layout.viewBox.x} ${layout.viewBox.y} ${layout.viewBox.width} ${layout.viewBox.height}`}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full"
          style={{ height: dimensions.height }}
        >
          {/* Links */}
          <g className="opacity-30">
            {layout.links.map((link, i) => (
              <path
                key={i}
                d={link.path}
                fill="none"
                stroke={link.color}
                strokeWidth={1.5}
              />
            ))}
          </g>

          {/* Cluster labels */}
          {layout.clusterLabels.map((label, i) => (
            <text
              key={i}
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              fill={label.color}
              fontSize={11}
              fontWeight={600}
              className="select-none"
            >
              {label.text}
            </text>
          ))}

          {/* Nodes */}
          {layout.nodes.map((layoutNode) => (
            <g key={layoutNode.id}>
              {/* White background circle */}
              <circle
                cx={layoutNode.x}
                cy={layoutNode.y}
                r={layoutNode.radius + 2}
                fill="white"
              />

              {layoutNode.isCenter ? (
                <>
                  {/* Center node: photo + colored border */}
                  {layoutNode.node.photoUrl ? (
                    <>
                      <clipPath id={`clip-preview-${layoutNode.id}`}>
                        <circle cx={layoutNode.x} cy={layoutNode.y} r={layoutNode.radius} />
                      </clipPath>
                      <image
                        href={layoutNode.node.photoUrl}
                        x={layoutNode.x - layoutNode.radius}
                        y={layoutNode.y - layoutNode.radius}
                        width={layoutNode.radius * 2}
                        height={layoutNode.radius * 2}
                        clipPath={`url(#clip-preview-${layoutNode.id})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </>
                  ) : (
                    <circle
                      cx={layoutNode.x}
                      cy={layoutNode.y}
                      r={layoutNode.radius}
                      fill={layoutNode.node.party?.color || "#6B7280"}
                    />
                  )}
                  <circle
                    cx={layoutNode.x}
                    cy={layoutNode.y}
                    r={layoutNode.radius}
                    fill="none"
                    stroke="#1F2937"
                    strokeWidth={2.5}
                  />
                  <text
                    x={layoutNode.x}
                    y={layoutNode.y + layoutNode.radius + 14}
                    textAnchor="middle"
                    fill="#1F2937"
                    fontSize={12}
                    fontWeight={700}
                    className="select-none"
                  >
                    {layoutNode.node.fullName}
                  </text>
                </>
              ) : layoutNode.isOverflow ? (
                <>
                  {/* Overflow node: "+N" count */}
                  <circle
                    cx={layoutNode.x}
                    cy={layoutNode.y}
                    r={layoutNode.radius}
                    fill="#F3F4F6"
                    stroke={RELATION_TYPE_COLORS[layoutNode.clusterType as keyof typeof RELATION_TYPE_COLORS] || "#9CA3AF"}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                  <text
                    x={layoutNode.x}
                    y={layoutNode.y + 4}
                    textAnchor="middle"
                    fill="#6B7280"
                    fontSize={11}
                    fontWeight={600}
                    className="select-none"
                  >
                    +{layoutNode.overflowCount}
                  </text>
                </>
              ) : (
                <>
                  {/* Regular node: photo or colored circle + name */}
                  {layoutNode.node.photoUrl ? (
                    <>
                      <clipPath id={`clip-preview-${layoutNode.id}`}>
                        <circle cx={layoutNode.x} cy={layoutNode.y} r={layoutNode.radius} />
                      </clipPath>
                      <image
                        href={layoutNode.node.photoUrl}
                        x={layoutNode.x - layoutNode.radius}
                        y={layoutNode.y - layoutNode.radius}
                        width={layoutNode.radius * 2}
                        height={layoutNode.radius * 2}
                        clipPath={`url(#clip-preview-${layoutNode.id})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </>
                  ) : (
                    <circle
                      cx={layoutNode.x}
                      cy={layoutNode.y}
                      r={layoutNode.radius}
                      fill={layoutNode.node.party?.color || "#6B7280"}
                    />
                  )}
                  <circle
                    cx={layoutNode.x}
                    cy={layoutNode.y}
                    r={layoutNode.radius}
                    fill="none"
                    stroke={layoutNode.node.party?.color || "#D1D5DB"}
                    strokeWidth={1.5}
                  />
                  <text
                    x={layoutNode.x}
                    y={layoutNode.y + layoutNode.radius + 12}
                    textAnchor="middle"
                    fill="#374151"
                    fontSize={9}
                    className="select-none"
                  >
                    {truncateName(layoutNode.node.fullName)}
                  </text>
                </>
              )}
            </g>
          ))}
        </svg>

        {/* Overlay hint */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
          <span className="bg-background/90 border text-xs text-muted-foreground px-3 py-1.5 rounded-full shadow-sm">
            Cliquer pour explorer
          </span>
        </div>
      </button>
    </div>
  );
}

function truncateName(name: string, max = 16): string {
  if (name.length <= max) return name;
  const parts = name.split(" ");
  if (parts.length > 2) {
    const short = `${parts[0]} ${parts[parts.length - 1]}`;
    if (short.length <= max) return short;
  }
  return name.slice(0, max - 1) + "\u2026";
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/components/relations/RelationsPreview.tsx 2>&1 | head -10
```

**Step 3: Commit**

```bash
git add src/components/relations/RelationsPreview.tsx
git commit -m "feat(relations): add RelationsPreview SVG component"
```

---

### Task 8: Create RelationsGraph (full interactive SVG)

**Files:**
- Rewrite: `src/components/relations/RelationsGraph.tsx`

**Step 1: Rewrite the graph component**

Replace `src/components/relations/RelationsGraph.tsx` entirely. This is the full interactive SVG used inside the fullscreen dialog. Key features:
- Zoom (Ctrl+scroll / pinch) and pan (drag)
- Hover tooltips on nodes and links
- Click node → navigate to profile
- Keyboard navigation (Tab between nodes)
- `prefers-reduced-motion` support

The component structure:
- Uses a `<g>` transform for zoom/pan state
- Each node is an `<a>` element (focusable, navigable)
- Tooltip state managed with useState
- Zoom via wheel event handler checking `ctrlKey`

```typescript
"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraphNode, Cluster, RelationType } from "@/types/relations";
import { useRelationsLayout, LayoutNode } from "./useRelationsLayout";
import { RELATION_TYPE_COLORS } from "@/config/relations";

interface RelationsGraphProps {
  center: GraphNode;
  clusters: Cluster[];
  width: number;
  height: number;
}

interface TooltipState {
  x: number;
  y: number;
  content: string;
  subtitle?: string;
}

export function RelationsGraph({ center, clusters, width, height }: RelationsGraphProps) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const layout = useRelationsLayout({
    center,
    clusters,
    width,
    height,
    mode: "full",
  });

  // Zoom with Ctrl+wheel (desktop) — no conflict with page scroll
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // only zoom with modifier
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform((prev) => ({
        ...prev,
        scale: Math.max(0.3, Math.min(5, prev.scale * delta)),
      }));
    },
    []
  );

  // Pan start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // left click only
      // Don't pan if clicking on a node (let the link handler work)
      const target = e.target as SVGElement;
      if (target.closest("a")) return;

      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.x,
        ty: transform.y,
      };
    },
    [transform.x, transform.y]
  );

  // Pan move + end
  useEffect(() => {
    if (!isPanning) return;

    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setTransform((prev) => ({
        ...prev,
        x: panStartRef.current.tx + dx,
        y: panStartRef.current.ty + dy,
      }));
    };

    const handleUp = () => setIsPanning(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isPanning]);

  // Attach wheel listener with passive: false for preventDefault
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleNodeHover = useCallback(
    (layoutNode: LayoutNode, e: React.MouseEvent) => {
      if (layoutNode.isOverflow || layoutNode.isCenter) return;
      const node = layoutNode.node;
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        content: node.fullName,
        subtitle: node.party?.shortName || undefined,
      });
    },
    []
  );

  const handleNodeClick = useCallback(
    (layoutNode: LayoutNode) => {
      if (layoutNode.isOverflow || layoutNode.isCenter) return;
      router.push(`/politiques/${layoutNode.node.slug}`);
    },
    [router]
  );

  const resetZoom = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  const transitionStyle = prefersReducedMotion ? "none" : "transform 0.15s ease-out";

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`${layout.viewBox.x} ${layout.viewBox.y} ${layout.viewBox.width} ${layout.viewBox.height}`}
        width={width}
        height={height}
        className="w-full"
        style={{ height, cursor: isPanning ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseLeave={() => setTooltip(null)}
        role="group"
        aria-label={`Graphe interactif des relations de ${center.fullName}`}
      >
        <g
          transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
          style={{ transition: isPanning ? "none" : transitionStyle }}
        >
          {/* Links */}
          {layout.links.map((link, i) => (
            <path
              key={i}
              d={link.path}
              fill="none"
              stroke={link.color}
              strokeWidth={1.5}
              strokeOpacity={0.4}
              className="hover:stroke-opacity-100 transition-opacity"
              onMouseEnter={(e) => {
                if (link.label) {
                  setTooltip({ x: e.clientX, y: e.clientY, content: link.label });
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}

          {/* Cluster labels */}
          {layout.clusterLabels.map((label, i) => (
            <text
              key={i}
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              fill={label.color}
              fontSize={13}
              fontWeight={600}
              className="select-none pointer-events-none"
            >
              {label.text}
            </text>
          ))}

          {/* Nodes */}
          {layout.nodes.map((layoutNode) => {
            if (layoutNode.isCenter) {
              return (
                <g key={layoutNode.id}>
                  <circle cx={layoutNode.x} cy={layoutNode.y} r={layoutNode.radius + 2} fill="white" />
                  {layoutNode.node.photoUrl ? (
                    <>
                      <clipPath id={`clip-full-${layoutNode.id}`}>
                        <circle cx={layoutNode.x} cy={layoutNode.y} r={layoutNode.radius} />
                      </clipPath>
                      <image
                        href={layoutNode.node.photoUrl}
                        x={layoutNode.x - layoutNode.radius}
                        y={layoutNode.y - layoutNode.radius}
                        width={layoutNode.radius * 2}
                        height={layoutNode.radius * 2}
                        clipPath={`url(#clip-full-${layoutNode.id})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </>
                  ) : (
                    <circle cx={layoutNode.x} cy={layoutNode.y} r={layoutNode.radius} fill={layoutNode.node.party?.color || "#6B7280"} />
                  )}
                  <circle cx={layoutNode.x} cy={layoutNode.y} r={layoutNode.radius} fill="none" stroke="#1F2937" strokeWidth={3} />
                  <text x={layoutNode.x} y={layoutNode.y + layoutNode.radius + 16} textAnchor="middle" fill="#1F2937" fontSize={13} fontWeight={700} className="select-none pointer-events-none">
                    {layoutNode.node.fullName}
                  </text>
                </g>
              );
            }

            if (layoutNode.isOverflow) {
              return (
                <g key={layoutNode.id}>
                  <circle cx={layoutNode.x} cy={layoutNode.y} r={layoutNode.radius} fill="#F3F4F6" stroke={RELATION_TYPE_COLORS[layoutNode.clusterType as RelationType] || "#9CA3AF"} strokeWidth={1.5} strokeDasharray="4 2" />
                  <text x={layoutNode.x} y={layoutNode.y + 4} textAnchor="middle" fill="#6B7280" fontSize={12} fontWeight={600} className="select-none pointer-events-none">
                    +{layoutNode.overflowCount}
                  </text>
                </g>
              );
            }

            // Regular interactive node
            return (
              <a
                key={layoutNode.id}
                href={`/politiques/${layoutNode.node.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNodeClick(layoutNode);
                }}
                onMouseEnter={(e) => handleNodeHover(layoutNode, e)}
                onMouseLeave={() => setTooltip(null)}
                aria-label={`${layoutNode.node.fullName}${layoutNode.node.party ? ` (${layoutNode.node.party.shortName})` : ""}`}
                className="focus-visible:outline-none"
              >
                <circle cx={layoutNode.x} cy={layoutNode.y} r={layoutNode.radius + 2} fill="white" />
                {layoutNode.node.photoUrl ? (
                  <>
                    <clipPath id={`clip-full-${layoutNode.id}`}>
                      <circle cx={layoutNode.x} cy={layoutNode.y} r={layoutNode.radius} />
                    </clipPath>
                    <image
                      href={layoutNode.node.photoUrl}
                      x={layoutNode.x - layoutNode.radius}
                      y={layoutNode.y - layoutNode.radius}
                      width={layoutNode.radius * 2}
                      height={layoutNode.radius * 2}
                      clipPath={`url(#clip-full-${layoutNode.id})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  </>
                ) : (
                  <circle cx={layoutNode.x} cy={layoutNode.y} r={layoutNode.radius} fill={layoutNode.node.party?.color || "#6B7280"} />
                )}
                <circle cx={layoutNode.x} cy={layoutNode.y} r={layoutNode.radius} fill="none" stroke={layoutNode.node.party?.color || "#D1D5DB"} strokeWidth={1.5} />
                {/* Focus ring */}
                <circle cx={layoutNode.x} cy={layoutNode.y} r={layoutNode.radius + 4} fill="none" stroke="transparent" strokeWidth={2} className="focus-visible:stroke-primary" />
                <text x={layoutNode.x} y={layoutNode.y + layoutNode.radius + 14} textAnchor="middle" fill="#374151" fontSize={11} className="select-none pointer-events-none">
                  {truncateName(layoutNode.node.fullName)}
                </text>
              </a>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-popover border rounded-lg shadow-lg px-3 py-2 text-sm pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <p className="font-medium">{tooltip.content}</p>
          {tooltip.subtitle && (
            <p className="text-muted-foreground text-xs">{tooltip.subtitle}</p>
          )}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          onClick={() => setTransform((t) => ({ ...t, scale: Math.min(5, t.scale * 1.3) }))}
          className="w-8 h-8 rounded bg-background/90 border shadow-sm flex items-center justify-center text-lg hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Zoom avant"
        >
          +
        </button>
        <button
          onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.3, t.scale / 1.3) }))}
          className="w-8 h-8 rounded bg-background/90 border shadow-sm flex items-center justify-center text-lg hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Zoom arrière"
        >
          -
        </button>
        <button
          onClick={resetZoom}
          className="w-8 h-8 rounded bg-background/90 border shadow-sm flex items-center justify-center text-xs hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Réinitialiser le zoom"
        >
          1:1
        </button>
      </div>
    </div>
  );
}

function truncateName(name: string, max = 18): string {
  if (name.length <= max) return name;
  const parts = name.split(" ");
  if (parts.length > 2) {
    const short = `${parts[0]} ${parts[parts.length - 1]}`;
    if (short.length <= max) return short;
  }
  return name.slice(0, max - 1) + "\u2026";
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/components/relations/RelationsGraph.tsx 2>&1 | head -10
```

**Step 3: Commit**

```bash
git add src/components/relations/RelationsGraph.tsx
git commit -m "feat(relations): rewrite RelationsGraph as interactive SVG with zoom/pan"
```

---

### Task 9: Create RelationsDialog (fullscreen)

**Files:**
- Create: `src/components/relations/RelationsDialog.tsx`

**Step 1: Create the dialog component**

Create `src/components/relations/RelationsDialog.tsx`:

```typescript
"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { GraphNode, Cluster, RelationType } from "@/types/relations";
import { RelationsGraph } from "./RelationsGraph";
import { RelationsFilters } from "./RelationsFilters";
import { RelationLegend } from "./RelationLegend";
import { ALL_RELATION_TYPES } from "@/config/relations";

interface RelationsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  center: GraphNode;
  clusters: Cluster[];
  stats: { totalConnections: number; byType: Partial<Record<RelationType, number>> };
}

export function RelationsDialog({
  isOpen,
  onClose,
  center,
  clusters,
  stats,
}: RelationsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<RelationType[]>(ALL_RELATION_TYPES);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Open/close dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      triggerRef.current = document.activeElement;
      dialog.showModal();
    } else {
      dialog.close();
      // Return focus to trigger element
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    }
  }, [isOpen]);

  // Handle native dialog close (Escape key)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  // Compute dimensions based on viewport
  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      setDimensions({
        width: window.innerWidth - 32, // 16px padding each side
        height: window.innerHeight - 120, // space for header
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isOpen]);

  // Filter clusters by selected types
  const filteredClusters = clusters.filter((c) => selectedTypes.includes(c.type));

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose]
  );

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 w-full h-full max-w-none max-h-none m-0 p-0 bg-background backdrop:bg-black/50 overflow-hidden"
      aria-labelledby="relations-dialog-title"
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div className="flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b bg-background shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <h2 id="relations-dialog-title" className="text-lg font-bold truncate">
              Relations de {center.fullName}
            </h2>
            <div className="hidden sm:flex items-center gap-2">
              <RelationsFilters selectedTypes={selectedTypes} onChange={setSelectedTypes} compact />
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Mobile filters */}
        <div className="sm:hidden px-4 py-2 border-b bg-background shrink-0">
          <RelationsFilters selectedTypes={selectedTypes} onChange={setSelectedTypes} compact />
        </div>

        {/* Graph area */}
        <div className="flex-1 overflow-hidden">
          <RelationsGraph
            center={center}
            clusters={filteredClusters}
            width={dimensions.width}
            height={dimensions.height}
          />
        </div>

        {/* Footer legend */}
        <footer className="flex items-center justify-between px-4 py-2 border-t bg-background shrink-0">
          <RelationLegend activeTypes={stats.byType} />
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {stats.totalConnections} connexion{stats.totalConnections > 1 ? "s" : ""}
            <span className="hidden sm:inline"> · Ctrl+molette pour zoomer</span>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/components/relations/RelationsDialog.tsx 2>&1 | head -10
```

**Step 3: Commit**

```bash
git add src/components/relations/RelationsDialog.tsx
git commit -m "feat(relations): add RelationsDialog fullscreen component"
```

---

### Task 10: Rewrite RelationFilters and RelationLegend

**Files:**
- Rewrite: `src/components/relations/RelationFilters.tsx`
- Rewrite: `src/components/relations/RelationLegend.tsx`

**Step 1: Rewrite RelationFilters**

Supports two modes: full (page-level) and compact (dialog header). Replace `src/components/relations/RelationFilters.tsx`:

```typescript
"use client";

import { RelationType } from "@/types/relations";
import {
  RELATION_TYPE_LABELS,
  RELATION_TYPE_COLORS,
  ALL_RELATION_TYPES,
} from "@/config/relations";

interface RelationFiltersProps {
  selectedTypes: RelationType[];
  onChange: (types: RelationType[]) => void;
  compact?: boolean;
}

export function RelationFilters({ selectedTypes, onChange, compact = false }: RelationFiltersProps) {
  const handleToggle = (type: RelationType) => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length > 1) {
        onChange(selectedTypes.filter((t) => t !== type));
      }
    } else {
      onChange([...selectedTypes, type]);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filtrer les types de relations">
        {ALL_RELATION_TYPES.map((type) => {
          const isSelected = selectedTypes.includes(type);
          return (
            <button
              key={type}
              onClick={() => handleToggle(type)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                isSelected
                  ? "bg-foreground/10 text-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={isSelected}
              aria-label={RELATION_TYPE_LABELS[type]}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: isSelected ? RELATION_TYPE_COLORS[type] : "#D1D5DB",
                }}
              />
              <span className="hidden sm:inline">{RELATION_TYPE_LABELS[type]}</span>
              <span className="sm:hidden" aria-hidden="true">
                {RELATION_TYPE_LABELS[type].split(" ").pop()}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3" role="group" aria-label="Filtrer les types de relations">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Types de relations</h3>
        {selectedTypes.length < ALL_RELATION_TYPES.length && (
          <button
            onClick={() => onChange(ALL_RELATION_TYPES)}
            className="text-xs text-primary hover:underline"
          >
            Tout sélectionner
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ALL_RELATION_TYPES.map((type) => {
          const isSelected = selectedTypes.includes(type);
          return (
            <button
              key={type}
              onClick={() => handleToggle(type)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
              aria-pressed={isSelected}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  backgroundColor: isSelected ? RELATION_TYPE_COLORS[type] : "#D1D5DB",
                }}
              />
              <span className={isSelected ? "text-foreground" : "text-muted-foreground"}>
                {RELATION_TYPE_LABELS[type]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Rewrite RelationLegend**

Replace `src/components/relations/RelationLegend.tsx`:

```typescript
"use client";

import { RelationType } from "@/types/relations";
import { RELATION_TYPE_LABELS, RELATION_TYPE_COLORS } from "@/config/relations";

interface RelationLegendProps {
  activeTypes: Partial<Record<RelationType, number>>;
}

export function RelationLegend({ activeTypes }: RelationLegendProps) {
  const types = Object.entries(activeTypes) as [RelationType, number][];

  if (types.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3" role="list" aria-label="Légende des relations">
      {types.map(([type, count]) => (
        <div key={type} className="flex items-center gap-1.5 text-xs" role="listitem">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: RELATION_TYPE_COLORS[type] }}
            aria-hidden="true"
          />
          <span className="text-muted-foreground">
            {RELATION_TYPE_LABELS[type]} ({count})
          </span>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Verify both compile**

```bash
npx tsc --noEmit src/components/relations/RelationFilters.tsx src/components/relations/RelationLegend.tsx 2>&1 | head -10
```

**Step 4: Commit**

```bash
git add src/components/relations/RelationFilters.tsx src/components/relations/RelationLegend.tsx
git commit -m "feat(relations): rewrite filters (compact mode) and legend components"
```

---

### Task 11: Rewrite RelationsClient orchestrator

**Files:**
- Rewrite: `src/app/politiques/[slug]/relations/RelationsClient.tsx`

**Step 1: Rewrite the client component**

Replace `src/app/politiques/[slug]/relations/RelationsClient.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { RelationsPreview } from "@/components/relations/RelationsPreview";
import { RelationsDialog } from "@/components/relations/RelationsDialog";
import { RelationsResponse } from "@/types/relations";

interface RelationsClientProps {
  slug: string;
  politicianName: string;
}

export function RelationsClient({ slug, politicianName: _politicianName }: RelationsClientProps) {
  const [data, setData] = useState<RelationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchRelations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/politiques/${slug}/relations`);

      if (!response.ok) {
        throw new Error("Erreur lors du chargement des relations");
      }

      const result: RelationsResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchRelations();
  }, [fetchRelations]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[320px] border rounded-lg bg-muted/20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Chargement des relations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[320px] border rounded-lg bg-destructive/5">
        <div className="text-center">
          <p className="text-destructive mb-2">{error}</p>
          <button onClick={fetchRelations} className="text-sm text-primary hover:underline">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.clusters.length === 0) {
    return (
      <div className="flex items-center justify-center h-[320px] border rounded-lg bg-muted/20">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Aucune relation trouvée</p>
          <p className="text-sm text-muted-foreground">
            Ce représentant n&apos;a pas de connexions identifiées pour le moment
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <RelationsPreview
        center={data.center}
        clusters={data.clusters}
        totalConnections={data.stats.totalConnections}
        onOpen={() => setIsDialogOpen(true)}
      />

      <RelationsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        center={data.center}
        clusters={data.clusters}
        stats={data.stats}
      />
    </>
  );
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/app/politiques/\[slug\]/relations/RelationsClient.tsx 2>&1 | head -10
```

**Step 3: Commit**

```bash
git add src/app/politiques/\[slug\]/relations/RelationsClient.tsx
git commit -m "feat(relations): rewrite RelationsClient with preview + dialog architecture"
```

---

### Task 12: Update server page and metadata

**Files:**
- Modify: `src/app/politiques/[slug]/relations/page.tsx`

**Step 1: Update the page**

Update metadata description and page subtitle to reflect new categories. In `src/app/politiques/[slug]/relations/page.tsx`:

Change the metadata description:
```typescript
description: `Découvrez les relations politiques de ${politician.fullName} : gouvernement, entreprises, département, parcours partisan.`,
```

Change the page subtitle:
```typescript
<p className="text-muted-foreground">
  Visualisez les connexions politiques : gouvernement, entreprises en commun, département, parcours partisan
</p>
```

**Step 2: Verify the page compiles**

```bash
npx tsc --noEmit src/app/politiques/\[slug\]/relations/page.tsx 2>&1 | head -10
```

**Step 3: Commit**

```bash
git add src/app/politiques/\[slug\]/relations/page.tsx
git commit -m "feat(relations): update page metadata and descriptions for new categories"
```

---

### Task 13: Update MCP tool (transparence-politique-mcp)

**Files:**
- Modify: `/home/ldiaby/projects/transparence-politique-mcp/src/tools/politicians.ts`

**Step 1: Update the get_politician_relations tool**

Update the MCP tool to handle the new `clusters` response format. The tool should:
- Parse `clusters[]` instead of flat `nodes[]` + `links[]`
- Group output by cluster type
- Keep backward-compatible text output format

Read the current MCP tool implementation first and adapt minimally to handle both old and new API format.

**Step 2: Verify MCP compiles**

```bash
cd /home/ldiaby/projects/transparence-politique-mcp && npx tsc --noEmit
```

**Step 3: Commit in the MCP repo**

```bash
cd /home/ldiaby/projects/transparence-politique-mcp
git add src/tools/politicians.ts
git commit -m "feat: update get_politician_relations for clustered API response"
```

---

### Task 14: Format, build, and verify

**Step 1: Format all modified files**

```bash
npx prettier --write \
  src/types/relations.ts \
  src/config/relations.ts \
  src/components/relations/*.tsx \
  src/components/relations/*.ts \
  src/app/api/politiques/\[slug\]/relations/route.ts \
  src/app/politiques/\[slug\]/relations/RelationsClient.tsx \
  src/app/politiques/\[slug\]/relations/page.tsx
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

**Step 3: Build check**

```bash
rm -rf .next && npm run db:generate && npm run build
```

**Step 4: Fix any issues and commit**

```bash
git add -A
git commit -m "chore: format and fix build issues"
```

---

### Task 15: Visual regression test

**Step 1: Start dev server and test visually**

```bash
npm run dev
```

Navigate to a politician with government mandates (e.g., `/politiques/elisabeth-borne/relations`) and verify:
- Preview renders with clusters
- Click opens fullscreen dialog
- Zoom (Ctrl+scroll) works in dialog
- Escape closes dialog
- Tab navigates between nodes
- Mobile responsive (resize browser)

**Step 2: Run visual regression if available**

```bash
npm run visual -- --update
```

**Step 3: Final commit if visual snapshots updated**

```bash
git add -A
git commit -m "test: update visual snapshots for relations redesign"
```

---

### Task 16: Create GitHub issue for judicial cross-reference (deferred)

**Step 1: Create the issue**

```bash
gh issue create \
  --title "feat: cross-reference politicians in shared judicial affairs" \
  --body "$(cat <<'EOF'
## Context

The relations module redesign (PR #XXX) deferred the `SHARED_LEGAL_CASE` relation type because affairs are currently single-politician records with no cross-linking.

## Requirements

- Add ability to link multiple politicians to the same judicial affair
- Detection strategies:
  - Match by ECLI number / pourvoi number
  - Match by shared article/source URLs
  - Manual linking via admin interface
- Expose as a new cluster type in the relations API
- Respect presumption of innocence in display

## Technical notes

- Current `Affair` model has single `politicianId`
- Options: add `relatedAffairIds` array OR create a join table `AffairLink`
- See design doc: `docs/plans/2026-02-26-relations-redesign-design.md`
EOF
)"
```

**Step 2: Note the issue number for reference**
