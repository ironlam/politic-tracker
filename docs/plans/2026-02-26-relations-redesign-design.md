# Relations Module Redesign

**Date:** 2026-02-26
**Status:** Approved

## Context

The current relations module uses a `react-force-graph-2d` force-directed graph that is unreadable: nodes overlap, labels collide, and the layout is non-deterministic (different on every load). The relation categories are too basic (same party, same legislature) and don't surface the most interesting political connections.

## Design Decisions

### Categories (4, replacing 6)

| Type | Source | Detection |
|------|--------|-----------|
| `SAME_GOVERNMENT` | Mandates + new `governmentName` field | Same `governmentName` (e.g., "Gouvernement Borne") |
| `SHARED_COMPANY` | `Declaration.details.financialParticipations` + `directorships` | Same normalized company name (uppercase, excl. redacted) |
| `SAME_DEPARTMENT` | `Mandate.departmentCode` | Same department code, current mandates |
| `PARTY_HISTORY` | `PartyMembership` | At least one shared party in history |

**Removed:** `SAME_PARTY` (obvious, visible on profile), `SAME_LEGISLATURE` (577 deputies = no value), `SAME_EUROPEAN_GROUP` (too few politicians).

**Deferred (separate issue):** `SHARED_LEGAL_CASE` — requires cross-referencing affairs by case number/ECLI.

### Visualization: SVG Radial Clusters

**Approach:** Replace Canvas force-directed graph with deterministic SVG radial layout.

- Politician at center, fixed position
- Each cluster positioned at equal angles (90° for 4 clusters)
- Nodes within clusters arranged in arc of circle around their zone
- No physics simulation — layout computed once, deterministic
- Links: quadratic bezier curves from center to each node, colored by cluster
- Multi-cluster nodes (e.g., same government AND same company) get multiple colored links, positioned between clusters
- Anti-overlap: bounding box collision detection for labels, double arc for clusters >8 nodes

### Preview vs Fullscreen

**Preview (embedded in profile page):**
- Fixed height: 320px desktop / 240px mobile
- Simplified radial layout: center photo + cluster labels with counts ("Gvt Borne · 4") + max 3 nodes per cluster + "+N others"
- Links at opacity 0.3
- Hover cluster → highlight nodes/links
- Click anywhere → opens fullscreen
- Overlay: "Cliquer pour explorer" + expand icon
- No scroll/zoom — contained SVG, pointer-events limited to click
- `role="img"` + descriptive `aria-label`

**Fullscreen (`<dialog>` native):**
- `<dialog>` with `aria-modal="true"`, 100vw × 100vh with padding
- Sticky header: politician name + category filter toggles + close button (X)
- Full SVG with all nodes
- Zoom: Ctrl+scroll (desktop) / pinch (mobile) — no conflict (dialog has no page scroll)
- Pan: drag on background
- Hover node: tooltip (full name, party, current mandate)
- Click node: navigate to politician profile
- Click link: highlight + tooltip with detail ("SCI La Forestière")
- Escape / X: close dialog, focus returns to trigger button
- Filters: category toggles, fade transition on disable
- Legend: colors + counts per category

**Mobile fullscreen:**
- Same `<dialog>`, compact header (icons, no text labels for filters)
- Portrait SVG, clusters repositioned vertically if needed
- Pinch-to-zoom native
- Tap node = tooltip, double-tap = navigate

### Accessibility (WCAG AA)

- Preview: `role="img"` + `aria-label` describing the network
- Fullscreen: each SVG node is a focusable `<a>` with `aria-label`, Tab navigation between nodes
- `<dialog>`: native focus trap, `aria-labelledby` on title
- `prefers-reduced-motion`: no animated transitions

### API Response (revised)

```typescript
// GET /api/politiques/[slug]/relations
{
  center: GraphNode,
  clusters: {
    type: RelationType,
    label: string,           // "Gouvernement Borne (2022-2024)"
    nodes: GraphNode[],
    links: GraphLink[],
  }[],
  stats: {
    totalConnections: number,
    byType: Record<RelationType, number>
  }
}
```

Breaking change: `nodes[]` + `links[]` flat → `clusters[]` grouped. Old format deprecated, MCP contract updated in parallel.

### Tech Stack

**Added:**
- `d3-scale`, `d3-shape` (math only, no DOM manipulation)

**Removed:**
- `react-force-graph-2d`

**Component architecture:**
```
RelationsClient.tsx          ← Client component, fetch + state
├── RelationsPreview.tsx     ← SVG preview (simplified, clickable)
├── RelationsDialog.tsx      ← <dialog> wrapper (fullscreen)
│   ├── RelationsGraph.tsx   ← Full interactive SVG
│   ├── RelationsFilters.tsx ← Category toggles (rewritten)
│   └── RelationsLegend.tsx  ← Legend (rewritten)
└── useRelationsLayout.ts   ← Custom hook: computes positions
```

**`useRelationsLayout` hook:**
- Input: `clusters[]` + container dimensions + mode (preview/full)
- Output: `{x, y}` positions for nodes, link paths, label positions
- Deterministic: same input = same output
- Preview mode: max 3 nodes per cluster
- Full mode: all nodes, anti-overlap

### Data Migration

- Add `governmentName String?` to `Mandate` model in Prisma schema
- Backfill script: re-read `gouvernement` column from government CSV sync data
- Update `sync:government` script to populate `governmentName` on import

### Files

**Created:**
- `src/components/relations/RelationsPreview.tsx`
- `src/components/relations/RelationsDialog.tsx`
- `src/components/relations/useRelationsLayout.ts`

**Rewritten:**
- `src/components/relations/RelationsGraph.tsx`
- `src/components/relations/RelationFilters.tsx`
- `src/components/relations/RelationLegend.tsx`
- `src/app/politiques/[slug]/relations/RelationsClient.tsx`
- `src/app/api/politiques/[slug]/relations/route.ts`
- `src/config/relations.ts`
- `src/types/relations.ts`

**Deleted:**
- `react-force-graph-2d` dependency from `package.json`
