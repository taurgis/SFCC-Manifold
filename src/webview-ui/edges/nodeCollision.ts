/**
 * Node collision detection for path building
 *
 * Provides functions to check if points or path segments collide with nodes.
 */

import type { PlacedNode, Point } from "../types";
import { LAYOUT_CONFIG } from "../constants";

const { nodeWidth, nodeHeight } = LAYOUT_CONFIG;

/**
 * Check if a point is inside a node's bounding box (with padding)
 * Use a larger padding to ensure waypoints near edges aren't shown inside nodes
 */
export function isInsideNode(
  point: Point,
  node: PlacedNode,
  padding: number = 15
): boolean {
  return (
    point.x >= node.x - padding &&
    point.x <= node.x + nodeWidth + padding &&
    point.y >= node.y - padding &&
    point.y <= node.y + nodeHeight + padding
  );
}

/**
 * Check if a point is inside any node in the node map
 */
export function isInsideAnyNode(
  point: Point,
  nodeMap: Record<string, PlacedNode>
): boolean {
  for (const node of Object.values(nodeMap)) {
    if (isInsideNode(point, node)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a proposed path segment intersects any node (excluding source/target).
 * Returns the blocking node if found, otherwise null.
 */
export function pathSegmentHitsNode(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  nodeMap: Record<string, PlacedNode>,
  excludeIds: string[]
): PlacedNode | null {
  const padding = 10; // Small padding to detect near-misses
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  for (const node of Object.values(nodeMap)) {
    if (excludeIds.includes(node.id)) {
      continue;
    }

    const nodeLeft = node.x - padding;
    const nodeRight = node.x + nodeWidth + padding;
    const nodeTop = node.y - padding;
    const nodeBottom = node.y + nodeHeight + padding;

    // Check if segment overlaps with node bounding box
    const segmentOverlapsX = maxX >= nodeLeft && minX <= nodeRight;
    const segmentOverlapsY = maxY >= nodeTop && minY <= nodeBottom;

    if (segmentOverlapsX && segmentOverlapsY) {
      return node;
    }
  }
  return null;
}

/**
 * Check if an entire bendpoint path collides with any nodes.
 */
export function bendpointPathHasCollision(
  proposedPoints: number[],
  nodeMap: Record<string, PlacedNode>,
  fromNodeId: string,
  toNodeId: string
): boolean {
  const excludeIds = [fromNodeId, toNodeId];
  // Check each segment of the path
  for (let i = 0; i < proposedPoints.length - 2; i += 2) {
    const x1 = proposedPoints[i];
    const y1 = proposedPoints[i + 1];
    const x2 = proposedPoints[i + 2];
    const y2 = proposedPoints[i + 3];

    if (pathSegmentHitsNode(x1, y1, x2, y2, nodeMap, excludeIds)) {
      return true;
    }
  }
  return false;
}
