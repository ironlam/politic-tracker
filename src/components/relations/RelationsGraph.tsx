"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { GraphNode, GraphLink, RelationType } from "@/types/relations";
import { RELATION_TYPE_COLORS } from "@/config/relations";

// Dynamic import to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  ),
});

interface RelationsGraphProps {
  center: GraphNode;
  nodes: GraphNode[];
  links: GraphLink[];
  width?: number;
  height?: number;
  isMobile?: boolean;
}

interface ForceGraphNode extends GraphNode {
  [key: string]: unknown;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface ForceGraphLink {
  [key: string]: unknown;
  source: string;
  target: string;
  type: RelationType;
  strength: number;
  label?: string;
}

export function RelationsGraph({
  center,
  nodes,
  links,
  width = 800,
  height = 500,
  isMobile = false,
}: RelationsGraphProps) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);

  // Combine center with other nodes
  const allNodes = [center, ...nodes] as ForceGraphNode[];

  const graphData = {
    nodes: allNodes,
    links: links as ForceGraphLink[],
  };

  // Calculate optimal distance based on node count
  const nodeCount = allNodes.length;
  const baseDistance = isMobile ? 80 : 120;
  const linkDistance = Math.max(baseDistance, baseDistance + nodeCount * 3);
  const chargeStrength = isMobile ? -200 : -300 - nodeCount * 5;

  // Center the graph on mount and configure forces
  useEffect(() => {
    if (graphRef.current) {
      // Configure d3 forces for better spacing
      graphRef.current.d3Force("charge")?.strength(chargeStrength);
      graphRef.current.d3Force("link")?.distance(linkDistance);
      graphRef.current.d3Force("center")?.strength(0.05);

      // Add collision force to prevent overlap
      const d3 = graphRef.current.d3Force;
      if (d3) {
        graphRef.current.d3Force("collide", null);
      }

      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 500);
    }
  }, [chargeStrength, linkDistance, nodeCount]);

  // Handle node click - navigate to politician page
  const handleNodeClick = useCallback(
    (node: { [key: string]: unknown }) => {
      const n = node as ForceGraphNode;
      if (n.slug) {
        router.push(`/politiques/${n.slug}`);
      }
    },
    [router]
  );

  // Custom node rendering - optimized for readability
  const nodeCanvasObject = useCallback(
    (node: { [key: string]: unknown }, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as ForceGraphNode;
      const isCenter = n.id === center.id;
      const baseRadius = isMobile ? 6 : 8;
      const radius = isCenter ? baseRadius * 1.5 : baseRadius;

      // Only show labels when zoomed in enough
      const showLabel = globalScale > 0.6;
      const fontSize = isMobile ? 9 : 11;

      // Draw circle with white background for contrast
      ctx.beginPath();
      ctx.arc(n.x || 0, n.y || 0, radius + 2, 0, 2 * Math.PI);
      ctx.fillStyle = "#fff";
      ctx.fill();

      // Draw colored circle
      ctx.beginPath();
      ctx.arc(n.x || 0, n.y || 0, radius, 0, 2 * Math.PI);
      ctx.fillStyle = n.party?.color || "#6B7280";
      ctx.fill();

      // Draw border for center node
      if (isCenter) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Draw label only when zoomed in
      if (showLabel) {
        const scaledFontSize = Math.max(fontSize / globalScale, 8);
        ctx.font = `${isCenter ? "bold " : ""}${scaledFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // Get short name (first name + last initial or just last name)
        const fullName = n.fullName || "";
        const parts = fullName.split(" ");
        let displayName = fullName;
        if (parts.length > 2) {
          // First name + Last name (skip middle names)
          displayName = `${parts[0]} ${parts[parts.length - 1]}`;
        }
        if (displayName.length > 18) {
          displayName = displayName.slice(0, 16) + "\u2026";
        }

        // Draw text background for readability
        const textWidth = ctx.measureText(displayName).width;
        const padding = 2;
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.fillRect(
          (n.x || 0) - textWidth / 2 - padding,
          (n.y || 0) + radius + 2,
          textWidth + padding * 2,
          scaledFontSize + 2
        );

        // Draw text
        ctx.fillStyle = isCenter ? "#000" : "#333";
        ctx.fillText(displayName, n.x || 0, (n.y || 0) + radius + 3);
      }
    },
    [center.id, isMobile]
  );

  // Custom link rendering
  const linkColor = useCallback((link: { [key: string]: unknown }) => {
    const l = link as ForceGraphLink;
    return RELATION_TYPE_COLORS[l.type] || "#999";
  }, []);

  const linkWidth = useCallback((link: { [key: string]: unknown }) => {
    const l = link as ForceGraphLink;
    return Math.max(1, (l.strength || 5) / 3);
  }, []);

  return (
    <div className="border rounded-lg overflow-hidden bg-muted/20 relative">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={width}
        height={height}
        nodeId="id"
        nodeLabel={(node) => {
          const n = node as ForceGraphNode;
          return `${n.fullName || ""}${n.party ? ` (${n.party.shortName})` : ""}`;
        }}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node, color: string, ctx: CanvasRenderingContext2D) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc((node.x as number) || 0, (node.y as number) || 0, 15, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalParticles={0}
        onNodeClick={handleNodeClick}
        cooldownTicks={150}
        warmupTicks={50}
        onEngineStop={() => graphRef.current?.zoomToFit(400, 60)}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        // Improved force settings for much better spacing
        d3AlphaDecay={0.01}
        d3VelocityDecay={0.2}
      />

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          onClick={() => graphRef.current?.zoom(graphRef.current.zoom() * 1.3, 300)}
          className="w-8 h-8 rounded bg-background/90 border shadow-sm flex items-center justify-center text-lg hover:bg-muted transition-colors"
          title="Zoom avant"
        >
          +
        </button>
        <button
          onClick={() => graphRef.current?.zoom(graphRef.current.zoom() / 1.3, 300)}
          className="w-8 h-8 rounded bg-background/90 border shadow-sm flex items-center justify-center text-lg hover:bg-muted transition-colors"
          title="Zoom arrière"
        >
          −
        </button>
        <button
          onClick={() => graphRef.current?.zoomToFit(400, 60)}
          className="w-8 h-8 rounded bg-background/90 border shadow-sm flex items-center justify-center text-xs hover:bg-muted transition-colors"
          title="Ajuster à l'écran"
        >
          ⊡
        </button>
      </div>
    </div>
  );
}
