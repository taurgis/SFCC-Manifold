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

export interface PipelineNode {
  id: string;
  label: string;
  type: PipelineNodeType;
  branch: string;
  attributes: Record<string, string | undefined>;
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
