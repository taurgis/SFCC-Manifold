/**
 * Anchor point calculation for edge routing
 * 
 * Provides functions to calculate connection points on nodes
 * based on which side the edge exits/enters from.
 */

import type { Point, PlacedNode } from "../types";
import { LAYOUT_CONFIG } from "../constants";

const { nodeWidth, nodeHeight } = LAYOUT_CONFIG;

// Join node radius constant
export const JOIN_RADIUS = 10;

/**
 * Get anchor point for a node side
 * 
 * @param node - The placed node
 * @param side - Which side of the node ("top", "bottom", "left", "right")
 * @param offset - Offset along the side for multiple edges (perpendicular to side direction)
 * @returns The anchor point coordinates
 */
export function getAnchor(node: PlacedNode, side: string, offset: number): Point {
  if (node.type === "join") {
    const centerX = node.x + nodeWidth / 2;
    const centerY = node.y + nodeHeight / 2;

    if (side === "top") {return { x: centerX + offset, y: centerY - JOIN_RADIUS };}
    if (side === "bottom") {return { x: centerX + offset, y: centerY + JOIN_RADIUS };}
    if (side === "left") {return { x: centerX - JOIN_RADIUS, y: centerY + offset };}
    return { x: centerX + JOIN_RADIUS, y: centerY + offset };
  }

  if (side === "top") {return { x: node.x + nodeWidth / 2 + offset, y: node.y };}
  if (side === "bottom") {return { x: node.x + nodeWidth / 2 + offset, y: node.y + nodeHeight };}
  if (side === "left") {return { x: node.x, y: node.y + nodeHeight / 2 + offset };}
  return { x: node.x + nodeWidth, y: node.y + nodeHeight / 2 + offset };
}

/**
 * Get anchor point without offset - simplified version for debugging tools
 * 
 * @param node - The placed node
 * @param side - Which side of the node
 * @returns The anchor point at the center of that side
 */
export function getAnchorPoint(node: PlacedNode, side: string): Point {
  return getAnchor(node, side, 0);
}

/**
 * Get arrow angle for a given entry side
 * Arrow points INTO the target node from the specified side
 * 
 * @param side - The entry side
 * @returns Angle in radians
 */
export function getArrowAngleForSide(side: string): number {
  // If entering from top, arrow points down (into the top of the node)
  if (side === "top") {return Math.PI / 2;} // 90° = down
  // If entering from bottom, arrow points up (into the bottom of the node)
  if (side === "bottom") {return -Math.PI / 2;} // -90° = up
  // If entering from left, arrow points right (into the left of the node)
  if (side === "left") {return 0;} // 0° = right
  // If entering from right, arrow points left (into the right of the node)
  return Math.PI; // 180° = left
}

/**
 * Calculate arrow angle from path points
 * Uses the last segment of the path to determine direction
 * 
 * @param points - Flat array of [x1, y1, x2, y2, ...]
 * @returns Angle in radians
 */
export function calculateArrowAngleFromPoints(points: number[]): number {
  if (points.length < 4) {return 0;}

  // Find the last two DISTINCT points (some paths have duplicate endpoints)
  const lastX = points[points.length - 2];
  const lastY = points[points.length - 1];

  // Walk backwards to find a point that's different from the last point
  for (let i = points.length - 4; i >= 0; i -= 2) {
    const prevX = points[i];
    const prevY = points[i + 1];
    const dx = lastX - prevX;
    const dy = lastY - prevY;

    // If this point is different, use it to calculate the angle
    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
      return Math.atan2(dy, dx);
    }
  }

  // Fallback: all points are the same (shouldn't happen)
  return 0;
}

/**
 * Get unit vector for a side direction
 * 
 * @param side - The side ("top", "bottom", "left", "right")
 * @returns Unit vector pointing outward from that side
 */
export function sideVector(side: string): Point {
  switch (side) {
    case "top":
      return { x: 0, y: -1 };
    case "bottom":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    default:
      return { x: 1, y: 0 };
  }
}

/**
 * Move a point away from a side by a given distance
 * 
 * @param point - The starting point
 * @param side - The side direction to move
 * @param distance - How far to move
 * @returns The nudged point
 */
export function nudgePoint(point: Point, side: string, distance: number): Point {
  const v = sideVector(side);
  return { x: point.x + v.x * distance, y: point.y + v.y * distance };
}
