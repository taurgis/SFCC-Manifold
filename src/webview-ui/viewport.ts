/**
 * Viewport culling module
 * Optimizes rendering by hiding elements outside the visible area
 */

import type Konva from "konva";
import { LAYOUT_CONFIG, CULLING_MARGIN } from "./constants";
import { nodeGroups, edgeGroups, viewportCullingEnabled, placedNodes } from "./state";
import type { PlacedNode } from "./types";

const { nodeWidth, nodeHeight } = LAYOUT_CONFIG;

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Check if a bounding box is visible in the current viewport
 */
export function isInViewport(bounds: BoundingBox, stage: Konva.Stage): boolean {
  if (!viewportCullingEnabled) {return true;}

  const scale = stage.scaleX();
  const stagePos = stage.position();
  const container = stage.container();
  const viewWidth = container.clientWidth;
  const viewHeight = container.clientHeight;

  // Calculate viewport bounds in stage coordinates
  const vpLeft = -stagePos.x / scale - CULLING_MARGIN;
  const vpTop = -stagePos.y / scale - CULLING_MARGIN;
  const vpRight = (viewWidth - stagePos.x) / scale + CULLING_MARGIN;
  const vpBottom = (viewHeight - stagePos.y) / scale + CULLING_MARGIN;

  // Check if bounds intersect viewport
  return !(
    bounds.x + bounds.width < vpLeft ||
    bounds.x > vpRight ||
    bounds.y + bounds.height < vpTop ||
    bounds.y > vpBottom
  );
}

/**
 * Check if a node is visible in the viewport
 */
export function isNodeVisible(node: PlacedNode, stage: Konva.Stage): boolean {
  return isInViewport(
    {
      x: node.x,
      y: node.y,
      width: nodeWidth,
      height: nodeHeight,
    },
    stage
  );
}

/**
 * Check if an edge is visible in the viewport
 */
export function isEdgeVisible(points: number[], stage: Konva.Stage): boolean {
  if (!points || points.length < 4) {return true;}

  let minX = points[0];
  let maxX = points[0];
  let minY = points[1];
  let maxY = points[1];

  for (let i = 2; i < points.length; i += 2) {
    if (points[i] < minX) {minX = points[i];}
    if (points[i] > maxX) {maxX = points[i];}
    if (points[i + 1] < minY) {minY = points[i + 1];}
    if (points[i + 1] > maxY) {maxY = points[i + 1];}
  }

  return isInViewport(
    {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
    stage
  );
}

/**
 * Update visibility of all nodes and edges based on viewport
 */
export function updateViewportCulling(
  stage: Konva.Stage,
  _layer: Konva.Layer
): void {
  // Update node visibility
  for (const nodeId in nodeGroups) {
    const group = nodeGroups[nodeId];
    if (group) {
      // Find node in placedNodes (which always have x, y)
      const nodeData = placedNodes.find((n) => n.id === nodeId);
      if (nodeData) {
        const shouldBeVisible = isNodeVisible(nodeData, stage);
        if (group.visible() !== shouldBeVisible) {
          group.visible(shouldBeVisible);
        }
      }
    }
  }

  // Update edge visibility
  for (const edgeId in edgeGroups) {
    const group = edgeGroups[edgeId];
    if (group) {
      const edgeLine = group.findOne(".edge-line") as Konva.Line | undefined;
      if (edgeLine) {
        const points = edgeLine.points();
        const shouldBeVisible = isEdgeVisible(points, stage);
        if (group.visible() !== shouldBeVisible) {
          group.visible(shouldBeVisible);
        }
      }
    }
  }
}
