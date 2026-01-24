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
}

interface ForceGraphNode extends GraphNode {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface ForceGraphLink {
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
}: RelationsGraphProps) {
  const router = useRouter();
  const graphRef = useRef<any>(null);

  // Combine center with other nodes
  const allNodes: ForceGraphNode[] = [center, ...nodes];

  const graphData = {
    nodes: allNodes,
    links: links as ForceGraphLink[],
  };

  // Center the graph on mount
  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.centerAt(0, 0, 1000);
      graphRef.current.zoom(1.5, 1000);
    }
  }, []);

  // Handle node click - navigate to politician page
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback(
    (node: any) => {
      if (node.slug) {
        router.push(`/politiques/${node.slug}`);
      }
    },
    [router]
  );

  // Custom node rendering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isCenter = node.id === center.id;
      const radius = isCenter ? 12 : 8;
      const fontSize = Math.max(10 / globalScale, 3);

      // Draw circle
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI);
      ctx.fillStyle = node.party?.color || "#6B7280";
      ctx.fill();

      // Draw border for center node
      if (isCenter) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw label
      ctx.font = `${isCenter ? "bold " : ""}${fontSize}px Sans-Serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#333";

      // Truncate name if too long
      const name = node.fullName?.length > 20 ? node.fullName.slice(0, 18) + "..." : node.fullName || "";
      ctx.fillText(name, node.x || 0, (node.y || 0) + radius + 2);
    },
    [center.id]
  );

  // Custom link rendering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkColor = useCallback((link: any) => {
    return RELATION_TYPE_COLORS[link.type as RelationType] || "#999";
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkWidth = useCallback((link: any) => {
    return Math.max(1, (link.strength || 5) / 3);
  }, []);

  return (
    <div className="border rounded-lg overflow-hidden bg-muted/20">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={width}
        height={height}
        nodeId="id"
        nodeLabel={(node: any) =>
          `${node.fullName || ""}${node.party ? ` (${node.party.shortName})` : ""}`
        }
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, 12, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalParticles={0}
        onNodeClick={handleNodeClick}
        cooldownTicks={100}
        onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />
    </div>
  );
}
