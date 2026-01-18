/**
 * Global state management for the canvas
 * Centralizes all shared state that was previously scattered across modules
 */

import type Konva from "konva";
import type { PlacedNode, PipelineData } from "./types";

// Node groups storage for selection
export const nodeGroups: Record<string, Konva.Group> = {};

// Edge groups storage for selection
export const edgeGroups: Record<string, Konva.Group> = {};

// Selection state
export let selectedNodeId: string | null = null;
export let selectedEdgeId: string | null = null;

// Viewport culling state
export let viewportCullingEnabled = true;

export function setSelectedNodeId(id: string | null): void {
  selectedNodeId = id;
}

export function setSelectedEdgeId(id: string | null): void {
  selectedEdgeId = id;
}

export function setViewportCullingEnabled(enabled: boolean): void {
  viewportCullingEnabled = enabled;
}

// Pipeline data - will be set during initialization
export let pipelineData: PipelineData = { nodes: [], edges: [] };
export let placedNodes: PlacedNode[] = [];

export function setPipelineData(data: PipelineData): void {
  pipelineData = data;
}

export function setPlacedNodes(nodes: PlacedNode[]): void {
  placedNodes = nodes;
}

// Initial start node for navigation (set by main script)
export let initialStartNode: string | null = null;

export function setInitialStartNode(node: string | null): void {
  initialStartNode = node;
}
