/**
 * Source location in the XML file for deep-linking
 */
export interface SourceLocation {
  line: number;
  column?: number;
}

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
 * Represents a config property within a pipelet node
 */
export interface ConfigProperty {
  key: string;
  value: string;
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
  /** Config properties for pipelet nodes (e.g., ScriptFile, Transactional) */
  configProperties?: ConfigProperty[];
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
  /** Source location in the XML file for deep-linking */
  sourceLocation?: SourceLocation;
}

/**
 * Represents a bend point in a transition line
 * relative-to specifies whether the offset is relative to source or target node
 */
export interface BendPoint {
  relativeTo: "source" | "target";
  x: number;
  y: number;
}

/**
 * Represents additional display information for a transition
 */
export interface TransitionDisplay {
  bendPoints: BendPoint[];
}

export interface PipelineEdge {
  from: string;
  to: string;
  label?: string;
  /** Source connector name (e.g., 'error', 'yes', 'no') */
  sourceConnector?: string;
  /** Target connector name (e.g., 'in', 'in1', 'in2', 'loop') */
  targetConnector?: string;
  /** Display information including bend points for line routing */
  display?: TransitionDisplay;
  /** Source location in the XML file for deep-linking */
  sourceLocation?: SourceLocation;
}

export interface ParsedPipeline {
  name: string;
  group?: string;
  type?: string;
  description?: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}
