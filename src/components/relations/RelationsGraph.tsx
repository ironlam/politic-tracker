"use client";

import { useRef, useState, useCallback, useEffect, useSyncExternalStore, useMemo } from "react";
import { useRouter } from "next/navigation";
import { GraphNode, Cluster } from "@/types/relations";
import { RELATION_TYPE_COLORS } from "@/config/relations";
import { useRelationsLayout, LayoutNode } from "./useRelationsLayout";

function subscribeToMotionPreference(callback: () => void) {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getMotionPreference() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getMotionPreferenceServer() {
  return false;
}

interface RelationsGraphProps {
  center: GraphNode;
  clusters: Cluster[];
  width: number;
  height: number;
}

function truncateName(name: string, max = 18): string {
  if (name.length <= max) return name;
  const parts = name.split(" ");
  if (parts.length > 2) {
    const shortened = `${parts[0]} ${parts[parts.length - 1]}`;
    if (shortened.length <= max) return shortened;
    return shortened.slice(0, max - 1) + "\u2026";
  }
  return name.slice(0, max - 1) + "\u2026";
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  text: string;
}

export function RelationsGraph({ center, clusters, width, height }: RelationsGraphProps) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<Transform>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    text: "",
  });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    getMotionPreference,
    getMotionPreferenceServer
  );

  const layout = useRelationsLayout({
    center,
    clusters,
    width,
    height,
    mode: "full",
  });

  const { viewBox, links, clusterLabels, nodes } = layout;

  // Reset transform when layout changes significantly
  const layoutKey = useMemo(
    () => `${width}-${height}-${clusters.length}`,
    [width, height, clusters.length]
  );
  useEffect(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, [layoutKey]);

  // Ctrl+wheel zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform((t) => ({
        ...t,
        scale: Math.max(0.2, Math.min(5, t.scale * delta)),
      }));
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Only pan on background, not on links or nodes
      const target = e.target as SVGElement;
      if (target.closest("a") || target.closest("[data-interactive]")) return;
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

  useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setTransform((t) => ({
        ...t,
        x: panStartRef.current.tx + dx,
        y: panStartRef.current.ty + dy,
      }));
    };

    const handleMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning]);

  // Node hover
  const handleNodeHover = useCallback((e: React.MouseEvent, node: LayoutNode) => {
    const party = node.node.party ? ` (${node.node.party.shortName})` : "";
    setTooltip({
      visible: true,
      x: e.clientX + 12,
      y: e.clientY - 8,
      text: `${node.node.fullName}${party}`,
    });
  }, []);

  // Link hover
  const handleLinkHover = useCallback((e: React.MouseEvent, label?: string) => {
    if (!label) return;
    setTooltip({
      visible: true,
      x: e.clientX + 12,
      y: e.clientY - 8,
      text: label,
    });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltip((t) => ({ ...t, visible: false }));
  }, []);

  // Navigation
  const handleNodeClick = useCallback(
    (e: React.MouseEvent, slug: string) => {
      e.preventDefault();
      if (slug) {
        router.push(`/politiques/${slug}`);
      }
    },
    [router]
  );

  // Zoom controls
  const zoomIn = () =>
    setTransform((t) => ({
      ...t,
      scale: Math.min(5, t.scale * 1.3),
    }));
  const zoomOut = () =>
    setTransform((t) => ({
      ...t,
      scale: Math.max(0.2, t.scale / 1.3),
    }));
  const zoomReset = () => setTransform({ x: 0, y: 0, scale: 1 });

  const transitionStyle = reducedMotion ? "none" : "transform 0.1s ease-out";

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        className="block select-none"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        role="img"
        aria-label={`Graphe interactif des relations de ${center.fullName}`}
      >
        <g
          transform={`translate(${transform.x / (transform.scale || 1)}, ${transform.y / (transform.scale || 1)}) scale(${transform.scale})`}
          style={{ transition: isPanning ? "none" : transitionStyle }}
        >
          <defs>
            {nodes.map((n) => (
              <clipPath key={n.id} id={`clip-full-${n.id}`}>
                <circle cx={n.x} cy={n.y} r={n.radius} />
              </clipPath>
            ))}
          </defs>

          {/* Links */}
          {links.map((link, i) => (
            <path
              key={i}
              d={link.path}
              stroke={link.color}
              strokeWidth={1.5}
              fill="none"
              opacity={0.4}
              data-interactive="true"
              onMouseMove={(e) => handleLinkHover(e, link.label)}
              onMouseLeave={hideTooltip}
              style={{ cursor: link.label ? "help" : "default" }}
            />
          ))}

          {/* Cluster labels */}
          {clusterLabels.map((label, i) => (
            <text
              key={i}
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              fill={label.color}
              fontSize={11}
              fontWeight={600}
              opacity={0.8}
            >
              {label.text}
            </text>
          ))}

          {/* Nodes */}
          {nodes.map((n) => (
            <GraphNodeSVG
              key={n.id}
              node={n}
              isMainCenter={n.id === center.id}
              onHover={handleNodeHover}
              onLeave={hideTooltip}
              onClick={handleNodeClick}
            />
          ))}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-50 px-2 py-1 rounded bg-popover border text-xs shadow-md pointer-events-none text-popover-foreground"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          onClick={zoomIn}
          className="w-8 h-8 rounded bg-background/90 border shadow-sm flex items-center justify-center text-lg hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label="Zoom avant"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-8 h-8 rounded bg-background/90 border shadow-sm flex items-center justify-center text-lg hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label="Zoom arriere"
        >
          −
        </button>
        <button
          onClick={zoomReset}
          className="w-8 h-8 rounded bg-background/90 border shadow-sm flex items-center justify-center text-xs hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label="Reinitialiser le zoom"
        >
          1:1
        </button>
      </div>
    </div>
  );
}

function GraphNodeSVG({
  node,
  isMainCenter,
  onHover,
  onLeave,
  onClick,
}: {
  node: LayoutNode;
  isMainCenter: boolean;
  onHover: (e: React.MouseEvent, node: LayoutNode) => void;
  onLeave: () => void;
  onClick: (e: React.MouseEvent, slug: string) => void;
}) {
  const { x, y, radius, isCenter, isOverflow, overflowCount } = node;
  const color = isMainCenter ? "#1f2937" : (node.node.party?.color ?? "#6B7280");

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
          fontSize={12}
          fontWeight={600}
          fill="#6B7280"
        >
          +{overflowCount}
        </text>
      </g>
    );
  }

  const photoUrl = node.node.photoUrl;
  const displayName = truncateName(node.node.fullName, 18);
  const slug = node.node.slug;

  const content = (
    <>
      {/* Border circle */}
      <circle
        cx={x}
        cy={y}
        r={radius + 2}
        fill={color}
        stroke={isMainCenter ? "#111827" : color}
        strokeWidth={isMainCenter ? 3 : 2}
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
          clipPath={`url(#clip-full-${node.id})`}
          preserveAspectRatio="xMidYMid slice"
        />
      )}
      {/* Name below */}
      <text
        x={x}
        y={y + radius + 14}
        textAnchor="middle"
        fontSize={isMainCenter ? 13 : 10}
        fontWeight={isMainCenter ? 700 : 400}
        fill="#374151"
      >
        {displayName}
      </text>
    </>
  );

  if (isCenter || !slug) {
    return (
      <g
        onMouseMove={(e) => onHover(e, node)}
        onMouseLeave={onLeave}
        data-interactive="true"
        style={{ cursor: "default" }}
      >
        {content}
      </g>
    );
  }

  return (
    <a
      href={`/politiques/${slug}`}
      onClick={(e) => onClick(e, slug)}
      onMouseMove={(e) => onHover(e, node)}
      onMouseLeave={onLeave}
      data-interactive="true"
      style={{ cursor: "pointer" }}
    >
      {content}
    </a>
  );
}
