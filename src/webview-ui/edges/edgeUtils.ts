/**
 * Edge utility functions for label normalization and edge type detection
 * 
 * This module provides pure functions for working with edge labels,
 * independent of any rendering framework.
 */

import type { BendPoint } from "../types";

/**
 * Normalize edge label for comparison
 * Converts to lowercase and normalizes separators to underscores
 */
export function normalizeLabel(label: string | null | undefined): string {
  if (!label) {return "";}
  return String(label).toLowerCase().replace(/[\s-]/g, "_");
}

/**
 * Check if edge is an error edge based on its label
 */
export function isErrorEdge(label: string | null | undefined): boolean {
  const l = normalizeLabel(label);
  return l === "error" || l.indexOf("error") !== -1 || l === "pipelet_error";
}

/**
 * Infer exit side from XML bendpoints
 * Returns the side if it can be inferred, null otherwise
 * 
 * @param bendPoints - Array of bendpoints from edge display data
 * @returns Inferred exit side or null
 */
export function inferExitSideFromBendpoints(
  bendPoints: BendPoint[] | undefined
): string | null {
  if (!bendPoints || bendPoints.length === 0) {return null;}

  // Look for source-relative bendpoint
  const sourceBend = bendPoints.find((bp) => bp.relativeTo === "source");
  if (!sourceBend) {return null;}

  // x > 0 means go right, x < 0 means go left
  // y > 0 means go down, y < 0 means go up
  // The primary direction determines exit side
  const absX = Math.abs(sourceBend.x);
  const absY = Math.abs(sourceBend.y);

  if (absX > absY) {
    // Primarily horizontal movement
    return sourceBend.x > 0 ? "right" : "left";
  } else if (absY > absX) {
    // Primarily vertical movement
    return sourceBend.y > 0 ? "bottom" : "top";
  } else if (absX > 0) {
    // Equal but non-zero, prefer horizontal for error/branch edges
    return sourceBend.x > 0 ? "right" : "left";
  }

  return null;
}

/**
 * Infer entry side from XML bendpoints
 * Returns the side if it can be inferred, null otherwise
 * 
 * Bendpoint coordinates are relative to the target node center:
 * - x > 0: waypoint is to the right of target → approach from right → enter right side
 * - x < 0: waypoint is to the left of target → approach from left → enter left side
 * - y > 0: waypoint is below target → approach from below → enter bottom side
 * - y < 0: waypoint is above target → approach from above → enter top side
 * 
 * @param bendPoints - Array of bendpoints from edge display data
 * @returns Inferred entry side or null
 */
export function inferEntrySideFromBendpoints(
  bendPoints: BendPoint[] | undefined
): string | null {
  if (!bendPoints || bendPoints.length === 0) {return null;}

  // Look for target-relative bendpoint(s) and combine if multiple exist
  const targetBends = bendPoints.filter((bp) => bp.relativeTo === "target");
  if (targetBends.length === 0) {return null;}

  // If multiple target bendpoints exist, use the one closest to origin (smallest offset)
  // This represents the final approach direction
  let targetBend = targetBends[0];
  let minDistance = Math.abs(targetBend.x) + Math.abs(targetBend.y);
  
  for (let i = 1; i < targetBends.length; i++) {
    const dist = Math.abs(targetBends[i].x) + Math.abs(targetBends[i].y);
    if (dist < minDistance) {
      minDistance = dist;
      targetBend = targetBends[i];
    }
  }

  const absX = Math.abs(targetBend.x);
  const absY = Math.abs(targetBend.y);

  if (absX > absY) {
    // Primarily horizontal approach
    return targetBend.x > 0 ? "right" : "left";
  } else if (absY > absX) {
    // Primarily vertical approach
    return targetBend.y > 0 ? "bottom" : "top";
  } else if (absY > 0) {
    // Equal but non-zero, prefer vertical for standard entry
    return targetBend.y > 0 ? "bottom" : "top";
  }

  return null;
}

/**
 * Get all source bendpoints sorted by distance from source
 * Useful for multi-waypoint routing
 */
export function getSourceBendpoints(bendPoints: BendPoint[] | undefined): BendPoint[] {
  if (!bendPoints || bendPoints.length === 0) {return [];}
  
  return bendPoints
    .filter((bp) => bp.relativeTo === "source")
    .sort((a, b) => {
      const distA = Math.abs(a.x) + Math.abs(a.y);
      const distB = Math.abs(b.x) + Math.abs(b.y);
      return distA - distB;
    });
}

/**
 * Get all target bendpoints sorted by distance from target (closest first)
 * Useful for multi-waypoint routing
 */
export function getTargetBendpoints(bendPoints: BendPoint[] | undefined): BendPoint[] {
  if (!bendPoints || bendPoints.length === 0) {return [];}
  
  return bendPoints
    .filter((bp) => bp.relativeTo === "target")
    .sort((a, b) => {
      const distA = Math.abs(a.x) + Math.abs(a.y);
      const distB = Math.abs(b.x) + Math.abs(b.y);
      return distA - distB;
    });
}
