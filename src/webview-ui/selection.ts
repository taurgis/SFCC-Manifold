/**
 * Node and edge selection management
 */

import type Konva from "konva";
import { NODE_COLORS, LAYOUT_CONFIG } from "./constants";
import {
  nodeGroups,
  selectedNodeId,
  setSelectedNodeId,
  pipelineData,
  placedNodes,
} from "./state";
import type { PlacedNode, PipelineNode } from "./types";

// Forward declarations to avoid circular dependency - these will be set by properties.ts
let showPropertiesPanelFn: (() => void) | null = null;
let renderNodePropertiesFn: ((node: PlacedNode | PipelineNode) => void) | null = null;

export function setPropertiesFunctions(
  showFn: () => void,
  renderFn: (node: PlacedNode | PipelineNode) => void
): void {
  showPropertiesPanelFn = showFn;
  renderNodePropertiesFn = renderFn;
}

const { nodeWidth, nodeHeight } = LAYOUT_CONFIG;

/**
 * Find a node by ID from pipeline data
 */
export function findNodeById(id: string): PipelineNode | PlacedNode | null {
  // First check placed nodes
  for (const node of placedNodes) {
    if (node.id === id) {
      return node;
    }
  }
  // Fall back to pipeline data
  for (const node of pipelineData.nodes) {
    if (node.id === id) {
      return node;
    }
  }
  return null;
}

/**
 * Clear selection state
 */
export function clearSelection(): void {
  if (selectedNodeId && nodeGroups[selectedNodeId]) {
    updateNodeVisual(selectedNodeId, false);
  }
  setSelectedNodeId(null);
}

/**
 * Update node visual state (selected/unselected)
 */
export function updateNodeVisual(nodeId: string, isSelected: boolean): void {
  const group = nodeGroups[nodeId];
  if (!group) {return;}

  const nodeData = findNodeById(nodeId);
  const nodeColor = nodeData
    ? NODE_COLORS[nodeData.type] || NODE_COLORS.unknown
    : NODE_COLORS.unknown;

  // Try to find Rect first (for regular nodes)
  const rects = group.find("Rect") as Konva.Rect[];
  if (rects && rects.length > 0) {
    const mainRect = rects[0];

    if (isSelected) {
      mainRect.fill(nodeColor);
      mainRect.stroke("#ffffff");
      mainRect.strokeWidth(3);
      mainRect.shadowBlur(30);
      mainRect.shadowOpacity(0.8);
      mainRect.shadowColor(nodeColor);

      // Hide gradient overlay
      if (rects[1]) {
        rects[1].opacity(0);
      }

      // Invert text colors
      const texts = group.find("Text") as Konva.Text[];
      for (const text of texts) {
        if (!text.getAttr("originalFill")) {
          text.setAttr("originalFill", text.fill());
        }
        text.fill("#0b1021");
      }

      // Update pill background
      const pillRect = rects[2];
      if (pillRect) {
        if (!pillRect.getAttr("originalFill")) {
          pillRect.setAttr("originalFill", pillRect.fill());
        }
        pillRect.fill("rgba(255, 255, 255, 0.9)");
      }
    } else {
      mainRect.fill("#0d1328");
      mainRect.stroke(nodeColor);
      mainRect.strokeWidth(2);
      mainRect.shadowBlur(15);
      mainRect.shadowOpacity(0.4);
      mainRect.shadowColor("#000");

      // Show gradient overlay
      if (rects[1]) {
        rects[1].opacity(1);
      }

      // Restore text colors
      const texts = group.find("Text") as Konva.Text[];
      for (const text of texts) {
        const originalFill = text.getAttr("originalFill");
        if (originalFill) {
          text.fill(originalFill);
        }
      }

      // Restore pill background
      const pillRect = rects[2];
      if (pillRect) {
        const originalPillFill = pillRect.getAttr("originalFill");
        if (originalPillFill) {
          pillRect.fill(originalPillFill);
        }
      }
    }
    return;
  }

  // Try to find Circle (for join nodes)
  const circles = group.find("Circle") as Konva.Circle[];
  if (circles && circles.length > 0) {
    for (const circle of circles) {
      if (circle.strokeWidth() > 0) {
        if (isSelected) {
          circle.fill(nodeColor);
          circle.stroke("#ffffff");
          circle.strokeWidth(4);
          circle.shadowBlur(20);
          circle.shadowOpacity(0.8);
          circle.shadowColor(nodeColor);
        } else {
          circle.fill("#0d1328");
          circle.stroke(nodeColor);
          circle.strokeWidth(2);
          circle.shadowBlur(10);
          circle.shadowOpacity(0.4);
          circle.shadowColor("#000");
        }
        break;
      }
    }
  }
}

/**
 * Handle node selection
 */
export function selectNode(node: PlacedNode, layer: Konva.Layer): void {
  // Deselect previous node
  if (selectedNodeId && selectedNodeId !== node.id) {
    updateNodeVisual(selectedNodeId, false);
  }

  // Select new node
  setSelectedNodeId(node.id);
  updateNodeVisual(node.id, true);
  layer.batchDraw();

  // Show panel and render properties (using injected functions)
  if (showPropertiesPanelFn) {
    showPropertiesPanelFn();
  }
  if (renderNodePropertiesFn) {
    renderNodePropertiesFn(node);
  }
}

/**
 * Navigate to a node (center view on it and select it)
 */
export function navigateToNode(
  nodeId: string,
  stage: Konva.Stage,
  layer: Konva.Layer,
  nodes: PlacedNode[]
): void {
  let node: PlacedNode | null = null;
  for (const n of nodes) {
    if (n.id === nodeId) {
      node = n;
      break;
    }
  }

  if (!node) {return;}

  // Center the view on the target node
  const container = document.getElementById("konva-container");
  if (!container) {return;}
  
  const containerRect = container.getBoundingClientRect();
  const scale = stage.scaleX();

  const newX = containerRect.width / 2 - (node.x + nodeWidth / 2) * scale;
  const newY = containerRect.height / 2 - (node.y + nodeHeight / 2) * scale;

  stage.position({ x: newX, y: newY });

  // Select the node
  selectNode(node, layer);
}
