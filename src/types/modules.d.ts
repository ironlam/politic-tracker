// Type declarations for external modules without types

declare module "swagger-ui-react" {
  import { FC } from "react";

  interface SwaggerUIProps {
    url?: string;
    spec?: object;
    docExpansion?: "list" | "full" | "none";
    defaultModelsExpandDepth?: number;
    displayOperationId?: boolean;
    filter?: boolean | string;
    maxDisplayedTags?: number;
    showExtensions?: boolean;
    showCommonExtensions?: boolean;
    supportedSubmitMethods?: string[];
    tryItOutEnabled?: boolean;
    validatorUrl?: string | null;
  }

  const SwaggerUI: FC<SwaggerUIProps>;
  export default SwaggerUI;
}

declare module "react-force-graph-2d" {
  import { Component, Ref } from "react";

  // Force-graph node object with d3 simulation properties
  // Uses index signature to allow arbitrary user-defined properties
  interface NodeObject {
    [key: string]: unknown;
    id?: string | number;
    x?: number;
    y?: number;
    fx?: number;
    fy?: number;
    vx?: number;
    vy?: number;
  }

  // Force-graph link object
  interface LinkObject {
    [key: string]: unknown;
    source?: string | number | NodeObject;
    target?: string | number | NodeObject;
  }

  interface ForceGraph2DProps {
    ref?: Ref<ForceGraph2D>;
    graphData: { nodes: NodeObject[]; links: LinkObject[] };
    width?: number;
    height?: number;
    backgroundColor?: string;
    nodeId?: string;
    nodeLabel?: string | ((node: NodeObject) => string);
    nodeVal?: string | number | ((node: NodeObject) => number);
    nodeColor?: string | ((node: NodeObject) => string);
    nodeAutoColorBy?: string | ((node: NodeObject) => string | null);
    nodeCanvasObject?: (
      node: NodeObject,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => void;
    nodeCanvasObjectMode?: string | ((node: NodeObject) => string);
    nodePointerAreaPaint?: (node: NodeObject, color: string, ctx: CanvasRenderingContext2D) => void;
    linkSource?: string;
    linkTarget?: string;
    linkLabel?: string | ((link: LinkObject) => string);
    linkColor?: string | ((link: LinkObject) => string);
    linkWidth?: number | ((link: LinkObject) => number);
    linkDirectionalParticles?: number | ((link: LinkObject) => number);
    linkDirectionalParticleWidth?: number | ((link: LinkObject) => number);
    onNodeClick?: (node: NodeObject, event: MouseEvent) => void;
    onNodeHover?: (node: NodeObject | null, prevNode: NodeObject | null) => void;
    onLinkClick?: (link: LinkObject, event: MouseEvent) => void;
    onLinkHover?: (link: LinkObject | null, prevLink: LinkObject | null) => void;
    cooldownTicks?: number;
    cooldownTime?: number;
    onEngineStop?: () => void;
    enableZoomInteraction?: boolean;
    enablePanInteraction?: boolean;
    enableNodeDrag?: boolean;
    enablePointerInteraction?: boolean;
    d3AlphaDecay?: number;
    d3VelocityDecay?: number;
    warmupTicks?: number;
  }

  export default class ForceGraph2D extends Component<ForceGraph2DProps> {
    centerAt(x?: number, y?: number, duration?: number): void;
    zoom(factor?: number, duration?: number): void;
    zoomToFit(duration?: number, padding?: number): void;
    pauseAnimation(): void;
    resumeAnimation(): void;
    refresh(): void;
    d3Force(forceName: string, force?: unknown): unknown;
  }
}
