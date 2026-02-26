"use client";

import { useRef, useState, useEffect } from "react";
import { GraphNode, Cluster } from "@/types/relations";
import { RELATION_TYPE_COLORS } from "@/config/relations";
import { useRelationsLayout, LayoutNode } from "./useRelationsLayout";

interface RelationsPreviewProps {
  center: GraphNode;
  clusters: Cluster[];
  totalConnections: number;
  onOpen: () => void;
}

function truncateName(name: string, max = 16): string {
  if (name.length <= max) return name;
  const parts = name.split(" ");
  if (parts.length > 2) {
    const shortened = `${parts[0]} ${parts[parts.length - 1]}`;
    if (shortened.length <= max) return shortened;
    return shortened.slice(0, max - 1) + "\u2026";
  }
  return name.slice(0, max - 1) + "\u2026";
}

export function RelationsPreview({
  center,
  clusters,
  totalConnections,
  onOpen,
}: RelationsPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 320 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;
      setDimensions({
        width: rect.width,
        height: isMobile ? 240 : 320,
      });
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layout = useRelationsLayout({
    center,
    clusters,
    width: dimensions.width,
    height: dimensions.height,
    mode: "preview",
  });

  const { viewBox, links, clusterLabels, nodes } = layout;

  return (
    <div ref={containerRef} className="w-full">
      <button
        onClick={onOpen}
        className="relative w-full rounded-lg border bg-muted/20 overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
        aria-label={`Graphe des relations de ${center.fullName} : ${totalConnections} connexions. Cliquer pour explorer.`}
      >
        <svg
          role="img"
          aria-label={`Apercu des ${totalConnections} relations de ${center.fullName}`}
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          className="block"
        >
          <defs>
            {nodes.map((n) => (
              <clipPath key={n.id} id={`clip-preview-${n.id}`}>
                <circle cx={n.x} cy={n.y} r={n.radius} />
              </clipPath>
            ))}
          </defs>

          {/* Links */}
          <g opacity={0.3}>
            {links.map((link, i) => (
              <path key={i} d={link.path} stroke={link.color} strokeWidth={1.5} fill="none" />
            ))}
          </g>

          {/* Cluster labels */}
          {clusterLabels.map((label, i) => (
            <text
              key={i}
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              fill={label.color}
              fontSize={10}
              fontWeight={600}
              opacity={0.8}
            >
              {label.text}
            </text>
          ))}

          {/* Nodes */}
          {nodes.map((n) => (
            <NodePreview key={n.id} node={n} />
          ))}
        </svg>

        {/* Bottom overlay pill */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/90 border px-3 py-1 rounded-full text-xs font-medium text-muted-foreground shadow-sm pointer-events-none">
          Cliquer pour explorer
        </div>
      </button>
    </div>
  );
}

function NodePreview({ node }: { node: LayoutNode }) {
  const { x, y, radius, isCenter, isOverflow, overflowCount } = node;
  const color = isCenter ? "#1f2937" : (node.node.party?.color ?? "#6B7280");

  if (isOverflow) {
    return (
      <g>
        <circle
          cx={x}
          cy={y}
          r={radius}
          fill="none"
          stroke={
            RELATION_TYPE_COLORS[node.clusterType as keyof typeof RELATION_TYPE_COLORS] ?? "#6B7280"
          }
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fontWeight={600}
          fill="#6B7280"
        >
          +{overflowCount}
        </text>
      </g>
    );
  }

  const photoUrl = node.node.photoUrl;
  const displayName = isCenter
    ? truncateName(node.node.fullName, 20)
    : truncateName(node.node.fullName, 16);

  return (
    <g>
      {/* Border circle */}
      <circle
        cx={x}
        cy={y}
        r={radius + 1.5}
        fill={color}
        stroke={isCenter ? "#111827" : color}
        strokeWidth={isCenter ? 2.5 : 1.5}
      />
      {/* White background (fallback) */}
      <circle cx={x} cy={y} r={radius} fill="#fff" />
      {/* Photo */}
      {photoUrl && (
        <image
          href={photoUrl}
          x={x - radius}
          y={y - radius}
          width={radius * 2}
          height={radius * 2}
          clipPath={`url(#clip-preview-${node.id})`}
          preserveAspectRatio="xMidYMid slice"
        />
      )}
      {/* Name below */}
      <text
        x={x}
        y={y + radius + 10}
        textAnchor="middle"
        fontSize={isCenter ? 12 : 9}
        fontWeight={isCenter ? 700 : 400}
        fill="#374151"
      >
        {displayName}
      </text>
    </g>
  );
}
