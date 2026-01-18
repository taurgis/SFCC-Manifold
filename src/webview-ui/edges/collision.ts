/**
 * Collision detection for edge routing
 * 
 * Provides functions to detect intersections between edge paths and nodes,
 * and to build obstacle rectangles for pathfinding.
 */

import type { PlacedNode, Point } from "../types";
import { LAYOUT_CONFIG, EDGE_PAD } from "../constants";

const { nodeWidth, nodeHeight } = LAYOUT_CONFIG;

/**
 * Obstacle rectangle for pathfinding
 */
export interface ObstacleRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Line segment for occupied path tracking
 */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Routing configuration
export const ROUTING_GRID_STEP = 18;
export const ROUTING_MARGIN = 200;
export const ROUTING_SEGMENT_THICKNESS = 10;

/**
 * Check if a line segment intersects any node
 * 
 * @param x1 - Start X
 * @param y1 - Start Y
 * @param x2 - End X
 * @param y2 - End Y
 * @param nodeMap - Map of all nodes
 * @param fromNodeId - Source node ID (excluded from collision)
 * @param toNodeId - Target node ID (excluded from collision)
 * @returns The blocking node if intersection found, null otherwise
 */
export function lineIntersectsNode(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  nodeMap: Record<string, PlacedNode>,
  fromNodeId: string,
  toNodeId: string
): PlacedNode | null {
  if (!nodeMap) {return null;}
  const padding = 10;

  for (const nodeId in nodeMap) {
    if (nodeId === fromNodeId || nodeId === toNodeId) {continue;}
    const node = nodeMap[nodeId];
    const nodeLeft = node.x - padding;
    const nodeRight = node.x + nodeWidth + padding;
    const nodeTop = node.y - padding;
    const nodeBottom = node.y + nodeHeight + padding;

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    // Check horizontal line
    if (Math.abs(y1 - y2) < 5) {
      if (y1 > nodeTop && y1 < nodeBottom) {
        if (maxX > nodeLeft && minX < nodeRight) {
          return node;
        }
      }
    }
    // Check vertical line
    else if (Math.abs(x1 - x2) < 5) {
      if (x1 > nodeLeft && x1 < nodeRight) {
        if (maxY > nodeTop && minY < nodeBottom) {
          return node;
        }
      }
    }
  }
  return null;
}

/**
 * Build obstacle rectangles from nodes for pathfinding
 * 
 * @param nodeMap - Map of all nodes
 * @param fromNodeId - Source node ID (excluded)
 * @param toNodeId - Target node ID (excluded)
 * @returns Array of obstacle rectangles
 */
export function buildNodeObstacles(
  nodeMap: Record<string, PlacedNode>,
  fromNodeId: string,
  toNodeId: string
): ObstacleRect[] {
  const padding = EDGE_PAD;
  const obstacles: ObstacleRect[] = [];
  
  for (const [id, node] of Object.entries(nodeMap)) {
    if (id === fromNodeId || id === toNodeId) {continue;}
    obstacles.push({
      left: node.x - padding,
      right: node.x + nodeWidth + padding,
      top: node.y - padding,
      bottom: node.y + nodeHeight + padding,
    });
  }
  return obstacles;
}

/**
 * Convert line segments to obstacle rectangles
 * Used to avoid overlapping with already-drawn edges
 * 
 * @param segments - Array of line segments
 * @returns Array of obstacle rectangles
 */
export function segmentsToObstacles(segments: Segment[]): ObstacleRect[] {
  const obstacles: ObstacleRect[] = [];
  
  for (const seg of segments) {
    const minX = Math.min(seg.x1, seg.x2) - ROUTING_SEGMENT_THICKNESS;
    const maxX = Math.max(seg.x1, seg.x2) + ROUTING_SEGMENT_THICKNESS;
    const minY = Math.min(seg.y1, seg.y2) - ROUTING_SEGMENT_THICKNESS;
    const maxY = Math.max(seg.y1, seg.y2) + ROUTING_SEGMENT_THICKNESS;
    obstacles.push({ left: minX, right: maxX, top: minY, bottom: maxY });
  }
  return obstacles;
}

/**
 * Compute bounds for routing grid
 * 
 * @param nodeMap - Map of all nodes
 * @param start - Start point
 * @param end - End point
 * @returns Bounding box with margin
 */
export function computeRoutingBounds(
  nodeMap: Record<string, PlacedNode>,
  start: Point,
  end: Point
): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Math.min(start.x, end.x);
  let maxX = Math.max(start.x, end.x);
  let minY = Math.min(start.y, end.y);
  let maxY = Math.max(start.y, end.y);

  for (const node of Object.values(nodeMap)) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x + nodeWidth);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y + nodeHeight);
  }

  return {
    minX: minX - ROUTING_MARGIN,
    maxX: maxX + ROUTING_MARGIN,
    minY: minY - ROUTING_MARGIN,
    maxY: maxY + ROUTING_MARGIN,
  };
}

/**
 * Check if a point is inside any obstacle rectangle
 * 
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param obstacles - Array of obstacle rectangles
 * @returns true if point is inside an obstacle
 */
export function isInsideObstacle(
  x: number,
  y: number,
  obstacles: ObstacleRect[]
): boolean {
  for (const obs of obstacles) {
    if (x >= obs.left && x <= obs.right && y >= obs.top && y <= obs.bottom) {
      return true;
    }
  }
  return false;
}

/**
 * Convert point array to segment array
 * 
 * @param points - Flat array of [x1, y1, x2, y2, ...]
 * @returns Array of segment objects
 */
export function pointsToSegments(points: number[]): Segment[] {
  const segments: Segment[] = [];
  
  for (let i = 0; i < points.length - 2; i += 2) {
    segments.push({
      x1: points[i],
      y1: points[i + 1],
      x2: points[i + 2],
      y2: points[i + 3],
    });
  }
  return segments;
}
