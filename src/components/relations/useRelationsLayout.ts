"use client";

import { useMemo } from "react";
import { GraphNode, Cluster, RelationType } from "@/types/relations";
import { RELATION_TYPE_COLORS } from "@/config/relations";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  node: GraphNode;
  clusterType: string;
  isCenter: boolean;
  isOverflow: boolean;
  overflowCount?: number;
}

export interface LayoutLink {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  path: string; // SVG quadratic bezier "M sx sy Q cx cy tx ty"
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

// ---------------------------------------------------------------------------
// Hook parameters
// ---------------------------------------------------------------------------

interface UseRelationsLayoutParams {
  center: GraphNode;
  clusters: Cluster[];
  width: number;
  height: number;
  mode: "preview" | "full";
}

// ---------------------------------------------------------------------------
// Geometry helpers (pure functions)
// ---------------------------------------------------------------------------

/**
 * Build a quadratic bezier SVG path between two points with a perpendicular
 * offset that gives the link a gentle curve. The control point is placed at
 * the midpoint of the segment, offset perpendicular to the segment direction
 * by 15 % of the segment length.
 */
function bezierPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return `M ${sx} ${sy} L ${tx} ${ty}`;

  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;

  // Perpendicular unit vector
  const px = -dy / dist;
  const py = dx / dist;

  const offset = dist * 0.15;
  const cx = mx + px * offset;
  const cy = my + py * offset;

  return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
}

/**
 * Distribute `count` positions evenly along an arc centred at (cx, cy) with a
 * given radius, start angle and total arc span. Returns an array of {x, y}.
 */
function arcPositions(
  cx: number,
  cy: number,
  count: number,
  arcRadius: number,
  startAngle: number,
  arcSpan: number
): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  if (count === 1) {
    return [
      {
        x: cx + arcRadius * Math.cos(startAngle),
        y: cy + arcRadius * Math.sin(startAngle),
      },
    ];
  }

  const positions: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1); // 0..1
    const angle = startAngle - arcSpan / 2 + t * arcSpan;
    positions.push({
      x: cx + arcRadius * Math.cos(angle),
      y: cy + arcRadius * Math.sin(angle),
    });
  }
  return positions;
}

/**
 * Determine the text-anchor of a cluster label based on its angle relative to
 * the center.
 */
function labelAnchor(angle: number): "start" | "middle" | "end" {
  // Normalise angle to [0, 2PI)
  const a = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  // Right side → start, left side → end, top/bottom → middle
  if (a > Math.PI * 0.25 && a < Math.PI * 0.75) return "middle"; // bottom
  if (a >= Math.PI * 0.75 && a <= Math.PI * 1.25) return "end"; // left
  if (a > Math.PI * 1.25 && a < Math.PI * 1.75) return "middle"; // top
  return "start"; // right
}

// ---------------------------------------------------------------------------
// Main layout computation (pure)
// ---------------------------------------------------------------------------

function computeLayout(
  center: GraphNode,
  clusters: Cluster[],
  width: number,
  height: number,
  mode: "preview" | "full"
): RelationsLayout {
  const isPreview = mode === "preview";

  // Size constants
  const centerRadius = isPreview ? 24 : 28;
  const nodeRadius = isPreview ? 14 : 18;
  const maxNodesPreview = 3;
  const clusterDistanceFactor = isPreview ? 0.32 : 0.35;
  const innerArcRadius = isPreview ? 45 : 60;
  const padding = isPreview ? 40 : 60;

  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);
  const clusterDistance = minDim * clusterDistanceFactor;

  // Filter to clusters that have at least one node
  const activeClusters = clusters.filter((c) => c.nodes.length > 0);
  const clusterCount = activeClusters.length;

  const layoutNodes: LayoutNode[] = [];
  const layoutLinks: LayoutLink[] = [];
  const layoutLabels: LayoutClusterLabel[] = [];

  // 1. Center node --------------------------------------------------------
  layoutNodes.push({
    id: center.id,
    x: cx,
    y: cy,
    radius: centerRadius,
    node: center,
    clusterType: "center",
    isCenter: true,
    isOverflow: false,
  });

  // 2. Cluster nodes + links + labels ------------------------------------
  activeClusters.forEach((cluster, idx) => {
    // Angle for this cluster (start from top = -PI/2, go clockwise)
    const angle =
      clusterCount === 1 ? -Math.PI / 2 : -Math.PI / 2 + (idx / clusterCount) * 2 * Math.PI;

    // Cluster center position
    const clusterCx = cx + clusterDistance * Math.cos(angle);
    const clusterCy = cy + clusterDistance * Math.sin(angle);

    const clusterColor = RELATION_TYPE_COLORS[cluster.type as RelationType] ?? "#6B7280";

    // Determine displayed nodes
    let displayedNodes = cluster.nodes;
    let overflowCount = 0;

    if (isPreview && cluster.nodes.length > maxNodesPreview) {
      displayedNodes = cluster.nodes.slice(0, maxNodesPreview);
      overflowCount = cluster.nodes.length - maxNodesPreview;
    }

    // Arc geometry
    const nodeCount = displayedNodes.length + (overflowCount > 0 ? 1 : 0);
    const arcSpan = Math.min(Math.PI * 0.6, nodeCount * 0.3 + 0.2);
    const positions = arcPositions(clusterCx, clusterCy, nodeCount, innerArcRadius, angle, arcSpan);

    // Place real nodes
    displayedNodes.forEach((graphNode, posIdx) => {
      const pos = positions[posIdx];
      layoutNodes.push({
        id: graphNode.id,
        x: pos!.x,
        y: pos!.y,
        radius: nodeRadius,
        node: graphNode,
        clusterType: cluster.type,
        isCenter: false,
        isOverflow: false,
      });
    });

    // Place overflow "+N" node if needed
    if (overflowCount > 0) {
      const overflowPos = positions[positions.length - 1];
      // Build a synthetic GraphNode for the overflow indicator
      const overflowNode: GraphNode = {
        id: `overflow-${cluster.type}`,
        slug: "",
        fullName: `+${overflowCount}`,
        photoUrl: null,
        party: null,
        mandateType: null,
      };
      layoutNodes.push({
        id: overflowNode.id,
        x: overflowPos!.x,
        y: overflowPos!.y,
        radius: nodeRadius,
        node: overflowNode,
        clusterType: cluster.type,
        isCenter: false,
        isOverflow: true,
        overflowCount,
      });
    }

    // Build links — only for nodes actually displayed
    const displayedNodeIds = new Set(displayedNodes.map((n) => n.id));

    cluster.links.forEach((link) => {
      const sourceIsCenter = link.source === center.id;
      const targetIsCenter = link.target === center.id;

      // Find positions for source and target
      let sNode: LayoutNode | undefined;
      let tNode: LayoutNode | undefined;

      if (sourceIsCenter) {
        sNode = layoutNodes[0]; // center is always first
      } else if (displayedNodeIds.has(link.source)) {
        sNode = layoutNodes.find((n) => n.id === link.source);
      }

      if (targetIsCenter) {
        tNode = layoutNodes[0];
      } else if (displayedNodeIds.has(link.target)) {
        tNode = layoutNodes.find((n) => n.id === link.target);
      }

      if (sNode && tNode) {
        layoutLinks.push({
          sourceX: sNode.x,
          sourceY: sNode.y,
          targetX: tNode.x,
          targetY: tNode.y,
          path: bezierPath(sNode.x, sNode.y, tNode.x, tNode.y),
          color: clusterColor,
          label: link.label,
        });
      }
    });

    // Cluster label — positioned above the arc
    const labelOffset = innerArcRadius + 22;
    const labelX = clusterCx + labelOffset * Math.cos(angle) * 0.3;
    const labelY = clusterCy - labelOffset * 0.6;

    let labelText = cluster.label;
    if (isPreview) {
      labelText = `${cluster.label} \u00B7 ${cluster.nodes.length}`;
    }

    layoutLabels.push({
      x: labelX,
      y: labelY,
      text: labelText,
      color: clusterColor,
      anchor: labelAnchor(angle),
    });
  });

  // 3. ViewBox — compute from all node positions + padding ----------------
  if (layoutNodes.length === 0) {
    return {
      nodes: [],
      links: [],
      clusterLabels: [],
      viewBox: { x: 0, y: 0, width, height },
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of layoutNodes) {
    const r = n.radius;
    if (n.x - r < minX) minX = n.x - r;
    if (n.y - r < minY) minY = n.y - r;
    if (n.x + r > maxX) maxX = n.x + r;
    if (n.y + r > maxY) maxY = n.y + r;
  }

  // Also account for cluster labels (approximate text width)
  for (const label of layoutLabels) {
    const approxHalfWidth = label.text.length * 4;
    if (label.x - approxHalfWidth < minX) minX = label.x - approxHalfWidth;
    if (label.x + approxHalfWidth > maxX) maxX = label.x + approxHalfWidth;
    if (label.y - 12 < minY) minY = label.y - 12;
    if (label.y + 12 > maxY) maxY = label.y + 12;
  }

  return {
    nodes: layoutNodes,
    links: layoutLinks,
    clusterLabels: layoutLabels,
    viewBox: {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    },
  };
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useRelationsLayout({
  center,
  clusters,
  width,
  height,
  mode,
}: UseRelationsLayoutParams): RelationsLayout {
  return useMemo(
    () => computeLayout(center, clusters, width, height, mode),
    [center, clusters, width, height, mode]
  );
}
