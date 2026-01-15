export type PipelineNodeType =
  | "start"
  | "end"
  | "pipelet"
  | "call"
  | "jump"
  | "interaction"
  | "decision"
  | "join"
  | "loop"
  | "text"
  | "unknown";

/**
 * Represents a key-binding within a pipelet node
 */
export interface KeyBinding {
  key: string;
  alias: string;
}

/**
 * Represents a template configuration in interaction nodes
 */
export interface TemplateConfig {
  name: string;
  buffered?: boolean;
  dynamic?: boolean;
}

export interface PipelineNode {
  id: string;
  label: string;
  type: PipelineNodeType;
  branch: string;
  attributes: Record<string, string | undefined>;
  /** Key bindings for pipelet nodes (input/output mappings) */
  bindings?: KeyBinding[];
  /** Template configuration for interaction nodes */
  template?: TemplateConfig;
  /** Description text for text nodes */
  description?: string;
  position?: {
    x?: number;
    y?: number;
    width?: number;
    orientation?: string;
  };
}

export interface PipelineEdge {
  from: string;
  to: string;
  label?: string;
}

export interface ParsedPipeline {
  name: string;
  group?: string;
  type?: string;
  description?: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}
