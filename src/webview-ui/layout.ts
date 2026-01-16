/**
 * Node layout calculation
 * Implements layout logic that mirrors the SFCC pipeline editor
 */

import { LAYOUT_CONFIG } from "./constants";
import type { PipelineNode, PlacedNode, Bounds } from "./types";

const { nodeWidth, nodeHeight, horizontalGap, verticalGap, baseX, baseY } =
  LAYOUT_CONFIG;

interface GridPositionMap {
  [nodeId: string]: { gridX: number; gridY: number };
}

interface LayoutOptions {
  /**
   * Keep normalized grid coordinates on the returned nodes.
   * Useful for offline tooling that needs both pixel and grid positions.
   */
  preserveGrid?: boolean;
}

/**
 * Calculate node positions using XML grid coordinates
 */
export function calculateLayout(
  nodes: PipelineNode[],
  options?: LayoutOptions
): PlacedNode[] {
  let placedNodes: PlacedNode[] = [];
  const preserveGrid = options?.preserveGrid === true;

  try {
    // Track absolute grid positions for each node
    const nodeGridPositions: GridPositionMap = {};
    const occupiedCells: Record<string, boolean> = {};

    // First pass: identify top-level branches
    const topLevelBranches: Record<string, boolean> = {};
    for (const node of nodes) {
      const branch = node.branch;
      if (branch.indexOf("/") === -1) {
        topLevelBranches[branch] = true;
      }
    }

    // Process all nodes
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const pos = node.position;

      // Determine the absolute grid position
      let gridX: number;
      let gridY: number;

      // Check if this is the first node in its branch
      const isFirstInBranch = isFirstNodeInBranchFn(node.id, nodes, i);
      const isTopLevelBranch = topLevelBranches[node.branch];
      const isNestedBranch = !isTopLevelBranch;

      // Get XML position values (default to 0)
      const xmlX = pos?.x !== undefined ? pos.x : 0;
      const xmlY = pos?.y !== undefined ? pos.y : 1;

      if (isFirstInBranch && isTopLevelBranch) {
        // First node in a top-level branch: use ABSOLUTE positioning
        gridX = xmlX;
        gridY = xmlY;
      } else if (isFirstInBranch && isNestedBranch) {
        // First node in a nested branch: RELATIVE to parent branch node
        const parentPos = findParentNodePosition(
          node,
          nodeGridPositions,
          nodes,
          i
        );
        if (parentPos) {
          gridX = parentPos.gridX + xmlX;
          gridY = parentPos.gridY + xmlY;
        } else {
          // Fallback: use absolute positioning
          gridX = xmlX;
          gridY = xmlY;
        }
      } else {
        // Subsequent node in any branch: RELATIVE to previous node in same branch
        const prevPos = findPreviousNodePosition(
          node,
          nodeGridPositions,
          nodes,
          i
        );
        if (prevPos) {
          gridX = prevPos.gridX + xmlX;
          gridY = prevPos.gridY + xmlY;
        } else {
          // Fallback: use absolute positioning
          gridX = xmlX;
          gridY = xmlY;
        }
      }

      // Store the computed position
      nodeGridPositions[node.id] = { gridX, gridY };

      // Mark cell as occupied
      const cellKey = `${gridX},${gridY}`;
      occupiedCells[cellKey] = true;

      placedNodes.push({
        id: node.id,
        label: node.label,
        type: node.type,
        branch: node.branch,
        attributes: node.attributes || {},
        configProperties: node.configProperties || [],
        bindings: node.bindings || [],
        template: node.template || null,
        description: node.description || null,
        orientation: pos?.orientation ?? null,
        gridX,
        gridY,
        x: 0,
        y: 0,
      });
    }

    // Find minimum grid coordinates
    let minGridX = 0;
    let minGridY = 0;
    for (const n of placedNodes) {
      if (n.gridX !== undefined && n.gridX < minGridX) minGridX = n.gridX;
      if (n.gridY !== undefined && n.gridY < minGridY) minGridY = n.gridY;
    }

    // Convert grid coordinates to pixel coordinates
    for (const n of placedNodes) {
      const normalizedGridX = n.gridX! - minGridX;
      const normalizedGridY = n.gridY! - minGridY;

      n.x = baseX + (normalizedGridX * horizontalGap);
      n.y = baseY + (normalizedGridY * verticalGap);

      if (preserveGrid) {
        n.gridX = normalizedGridX;
        n.gridY = normalizedGridY;
      } else {
        delete n.gridX;
        delete n.gridY;
      }
    }
  } catch (e) {
    console.error("Layout error:", e);
    // Fallback to simple grid layout
    placedNodes = nodes.map((node, i) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      branch: node.branch,
      attributes: node.attributes || {},
      configProperties: node.configProperties || [],
      bindings: node.bindings || [],
      template: node.template || null,
      description: node.description || null,
      x: baseX + (i % 5) * horizontalGap,
      y: baseY + Math.floor(i / 5) * verticalGap,
    }));
  }

  return placedNodes;
}

/**
 * Check if this is the first node encountered in its branch
 */
function isFirstNodeInBranchFn(
  nodeId: string,
  allNodes: PipelineNode[],
  currentIndex: number
): boolean {
  const currentNode = allNodes[currentIndex];
  const branchPath = currentNode.branch;

  for (let i = 0; i < currentIndex; i++) {
    if (allNodes[i].branch === branchPath) {
      return false;
    }
  }
  return true;
}

/**
 * Find the position of the parent branch's node
 */
function findParentNodePosition(
  node: PipelineNode,
  nodeGridPositions: GridPositionMap,
  allNodes: PipelineNode[],
  currentIndex: number
): { gridX: number; gridY: number } | null {
  const branch = node.branch;
  const slashIndex = branch.lastIndexOf("/");
  if (slashIndex === -1) return null;

  const parentNodeId = branch.substring(0, slashIndex);

  // Look for this exact node ID
  let pos = nodeGridPositions[parentNodeId];
  if (pos) return pos;

  // Try to find by branch matching
  const lastColonBeforeSlash = parentNodeId.lastIndexOf(":");
  if (lastColonBeforeSlash > 0) {
    const secondLastColon = parentNodeId.lastIndexOf(
      ":",
      lastColonBeforeSlash - 1
    );
    if (secondLastColon > 0) {
      for (let i = currentIndex - 1; i >= 0; i--) {
        const otherNode = allNodes[i];
        if (otherNode.id === parentNodeId) {
          pos = nodeGridPositions[otherNode.id];
          if (pos) return pos;
        }
      }
    }
  }

  // Fallback: look for any node whose ID matches the parent path
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (allNodes[i].id === parentNodeId) {
      pos = nodeGridPositions[allNodes[i].id];
      if (pos) return pos;
    }
  }

  return null;
}

/**
 * Find the position of the previous node in the same branch
 */
function findPreviousNodePosition(
  node: PipelineNode,
  nodeGridPositions: GridPositionMap,
  allNodes: PipelineNode[],
  currentIndex: number
): { gridX: number; gridY: number } | null {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (allNodes[i].branch === node.branch) {
      const pos = nodeGridPositions[allNodes[i].id];
      if (pos) return pos;
    }
  }
  return null;
}

/**
 * Build a lookup map from node ID to node data
 */
export function buildNodeMap(
  placedNodes: PlacedNode[]
): Record<string, PlacedNode> {
  const nodeMap: Record<string, PlacedNode> = {};
  for (const node of placedNodes) {
    nodeMap[node.id] = node;
  }
  return nodeMap;
}

/**
 * Calculate canvas bounds based on placed nodes
 */
export function calculateBounds(placedNodes: PlacedNode[]): Bounds {
  let maxX = baseX;
  let maxY = baseY;

  for (const n of placedNodes) {
    if (n.x + nodeWidth > maxX) maxX = n.x + nodeWidth;
    if (n.y + nodeHeight > maxY) maxY = n.y + nodeHeight;
  }

  return {
    maxX: maxX + horizontalGap,
    maxY: maxY + verticalGap,
  };
}
