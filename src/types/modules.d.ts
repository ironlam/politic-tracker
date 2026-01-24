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
  import { Component, RefObject, Ref } from "react";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface ForceGraph2DProps {
    ref?: Ref<ForceGraph2D>;
    graphData: { nodes: any[]; links: any[] };
    width?: number;
    height?: number;
    backgroundColor?: string;
    nodeId?: string;
    nodeLabel?: string | ((node: any) => string);
    nodeVal?: string | number | ((node: any) => number);
    nodeColor?: string | ((node: any) => string);
    nodeAutoColorBy?: string | ((node: any) => string | null);
    nodeCanvasObject?: (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => void;
    nodeCanvasObjectMode?: string | ((node: any) => string);
    nodePointerAreaPaint?: (node: any, color: string, ctx: CanvasRenderingContext2D) => void;
    linkSource?: string;
    linkTarget?: string;
    linkLabel?: string | ((link: any) => string);
    linkColor?: string | ((link: any) => string);
    linkWidth?: number | ((link: any) => number);
    linkDirectionalParticles?: number | ((link: any) => number);
    linkDirectionalParticleWidth?: number | ((link: any) => number);
    onNodeClick?: (node: any, event: MouseEvent) => void;
    onNodeHover?: (node: any | null, prevNode: any | null) => void;
    onLinkClick?: (link: any, event: MouseEvent) => void;
    onLinkHover?: (link: any | null, prevLink: any | null) => void;
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
  }
}
