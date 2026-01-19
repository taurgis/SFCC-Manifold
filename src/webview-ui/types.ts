/**
 * Type declarations for the webview canvas
 */

import type Konva from "konva";

// Extend Window interface for global state
declare global {
  interface Window {
    placedNodes: PlacedNode[];
    pipelineStage: Konva.Stage;
    pipelineLayer: Konva.Layer;
    drawGridFn: () => void;
    handleConnectionClick: (nodeId: string) => void;
    acquireVsCodeApi: () => VSCodeAPI;
  }
}

export interface VSCodeAPI {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

export interface PipelineData {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

export interface PipelineNode {
  id: string;
  label: string;
  type: string;
  branch: string;
  attributes: Record<string, string>;
  configProperties: ConfigProperty[];
  bindings: Binding[];
  template: Template | null;
  description: string | null;
  position?: NodePosition;
  sourceLocation?: SourceLocation;
}

export interface PlacedNode extends PipelineNode {
  x: number;
  y: number;
  orientation?: string | null;
  gridX?: number;
  gridY?: number;
}

export interface NodePosition {
  x?: number;
  y?: number;
  orientation?: string;
}

export interface SourceLocation {
  line: number;
  column?: number;
}

export interface PipelineEdge {
  from: string;
  to: string;
  label?: string;
  sourceConnector?: string;
  targetConnector?: string;
  display?: {
    bendPoints?: BendPoint[];
  };
  sourceLocation?: SourceLocation;
}

export interface BendPoint {
  x: number;
  y: number;
  relativeTo?: "source" | "target";
}

export interface ConfigProperty {
  key: string;
  value: unknown;
}

export interface Binding {
  key: string;
  alias: string | null;
}

export interface Template {
  name: string;
  buffered?: boolean;
  dynamic?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  maxX: number;
  maxY: number;
}

export interface GridPosition {
  gridX: number;
  gridY: number;
}

export interface SideDetermination {
  outSide: "top" | "bottom" | "left" | "right";
  inSide: "top" | "bottom" | "left" | "right";
  blockingNode: PlacedNode | null;
}

export interface PlannedEdge {
  i: number;
  edgeId: string;
  edge: PipelineEdge;
  fromNode: PlacedNode;
  toNode: PlacedNode;
  outSide: string;
  inSide: string;
  blockingNode: PlacedNode | null;
}

// Export empty object to make this a module
export {};
