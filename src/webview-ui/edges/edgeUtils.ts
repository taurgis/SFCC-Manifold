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
 * @param bendPoints - Array of bendpoints from edge display data
 * @returns Inferred entry side or null
 */
export function inferEntrySideFromBendpoints(
  bendPoints: BendPoint[] | undefined
): string | null {
  if (!bendPoints || bendPoints.length === 0) {return null;}

  // Look for target-relative bendpoint
  const targetBend = bendPoints.find((bp) => bp.relativeTo === "target");
  if (!targetBend) {return null;}

  // The direction TO the target determines entry side
  // x > 0 means coming from left (entering right side)
  // x < 0 means coming from right (entering left side)
  // y > 0 means coming from above (entering bottom side)
  // y < 0 means coming from below (entering top side)
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
