/**
 * Bendpoint-based path routing
 *
 * Builds orthogonal paths guided by XML bendpoints.
 */

import type { PlacedNode, Point } from "../types";
import type { Segment } from "./collision";
import { bendpointPathHasCollision } from "./nodeCollision";
import { buildAutoRoutedPath } from "./autoRouting";

/**
 * Build path through source and target waypoints using orthogonal segments
 */
export function buildBendpointPath(
  points: number[],
  start: Point,
  end: Point,
  srcWpX: number,
  srcWpY: number,
  tgtWpX: number,
  tgtWpY: number,
  outSide: string,
  _inSide: string
): void {
  // Exit horizontally or vertically based on outSide
  if (outSide === "right" || outSide === "left") {
    // First segment: horizontal from start
    points.push(srcWpX, start.y);
    // Second segment: vertical to target approach height
    points.push(srcWpX, tgtWpY);
    // Third segment: horizontal to target x
    if (Math.abs(srcWpX - end.x) > 5) {
      points.push(end.x, tgtWpY);
    }
  } else {
    // First segment: vertical from start
    points.push(start.x, srcWpY);
    // Second segment: horizontal to target approach
    points.push(tgtWpX, srcWpY);
    // Third segment: vertical to target
    if (Math.abs(srcWpY - end.y) > 5) {
      points.push(tgtWpX, end.y);
    }
  }
}

/**
 * Build path through a single waypoint.
 * Returns true if path was built successfully, false if collision detected.
 */
export function buildSingleWaypointPath(
  points: number[],
  start: Point,
  end: Point,
  wpX: number,
  wpY: number,
  outSide: string,
  inSide: string,
  nodeMap: Record<string, PlacedNode>,
  fromNodeId: string,
  toNodeId: string,
  occupiedSegments: Segment[],
  fromNode: PlacedNode,
  toNode: PlacedNode
): boolean {
  const minApproachDistance = 30; // Minimum distance for arrow visibility
  const proposedPoints: number[] = [start.x, start.y];

  if (outSide === "right" || outSide === "left") {
    // Exit horizontally
    proposedPoints.push(wpX, start.y);

    if (inSide === "top") {
      // Need to approach from above - ensure enough vertical space
      const approachY = end.y - minApproachDistance;
      if (start.y < approachY) {
        // Already above, go down to approach height, then horizontal, then down
        proposedPoints.push(wpX, approachY);
        proposedPoints.push(end.x, approachY);
      } else {
        // Need to go up first to get above target
        const aboveY = Math.min(start.y, end.y - minApproachDistance);
        proposedPoints.push(wpX, aboveY);
        proposedPoints.push(end.x, aboveY);
      }
    } else if (inSide === "bottom") {
      // Need to approach from below - ensure enough vertical space
      const approachY = end.y + minApproachDistance;
      if (start.y > approachY) {
        proposedPoints.push(wpX, approachY);
        proposedPoints.push(end.x, approachY);
      } else {
        const belowY = Math.max(start.y, end.y + minApproachDistance);
        proposedPoints.push(wpX, belowY);
        proposedPoints.push(end.x, belowY);
      }
    } else if (inSide === "left" || inSide === "right") {
      // Approaching from side - go to waypoint then to end
      proposedPoints.push(wpX, end.y);
    } else {
      // Default: vertical to waypoint y, then horizontal
      proposedPoints.push(wpX, wpY);
      proposedPoints.push(end.x, wpY);
    }
  } else {
    // Exit vertically
    proposedPoints.push(start.x, wpY);

    if (inSide === "left") {
      // Approach from the left
      const approachX = end.x - minApproachDistance;
      proposedPoints.push(approachX, wpY);
      proposedPoints.push(approachX, end.y);
    } else if (inSide === "right") {
      // Approach from the right
      const approachX = end.x + minApproachDistance;
      proposedPoints.push(approachX, wpY);
      proposedPoints.push(approachX, end.y);
    } else {
      // Then horizontal to waypoint x, then vertical
      proposedPoints.push(wpX, wpY);
      proposedPoints.push(wpX, end.y);
    }
  }

  proposedPoints.push(end.x, end.y);

  // Check for collisions before committing to this path
  if (bendpointPathHasCollision(proposedPoints, nodeMap, fromNodeId, toNodeId)) {
    // Collision detected - fall back to A* pathfinding
    const autoRouted = buildAutoRoutedPath(
      start,
      end,
      fromNode,
      toNode,
      outSide,
      inSide,
      nodeMap,
      occupiedSegments
    );
    if (autoRouted) {
      // Clear the points array and add the auto-routed path
      // (excluding start which should already be handled by caller)
      for (let i = 2; i < autoRouted.length; i += 2) {
        points.push(autoRouted[i], autoRouted[i + 1]);
      }
      return true; // A* found a path
    }
    return false; // Signal that routing failed
  }

  // No collision - add all points except start (already in points) and end (added later)
  for (let i = 2; i < proposedPoints.length - 2; i += 2) {
    points.push(proposedPoints[i], proposedPoints[i + 1]);
  }
  return true;
}
