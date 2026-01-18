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
 * Result from buildBendpointPath including actual waypoints used
 */
export interface BendpointPathResult {
  /** The actual waypoints where the path turns (for visualization) */
  actualWaypoints: Point[];
}

/**
 * Build path through source and target waypoints using orthogonal segments.
 * Optimizes routing based on both exit side (outSide) and entry side (inSide)
 * to avoid unnecessary detours.
 * 
 * Returns the actual waypoint positions used (which may differ from XML bendpoints
 * due to routing optimization).
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
  inSide: string
): BendpointPathResult {
  const actualWaypoints: Point[] = [];

  // Exit horizontally (right or left)
  if (outSide === "right" || outSide === "left") {
    if (inSide === "right" || inSide === "left") {
      // Both horizontal exit and entry
      // Determine the optimal channel X based on direction of travel

      // For right-side entry, we must approach from the right (larger X)
      // For left-side entry, we must approach from the left (smaller X)
      let channelX: number;

      if (inSide === "right") {
        // Entry from right - channel must be to the right of the entry point
        // Use the maximum of the waypoints, but ensure it's >= end.x + some margin
        channelX = Math.max(srcWpX, tgtWpX, end.x + 30);
      } else {
        // Entry from left - channel must be to the left of the entry point
        channelX = Math.min(srcWpX, tgtWpX, end.x - 30);
      }

      // For the exit side, ensure we actually go in that direction first
      if (outSide === "right" && channelX < start.x) {
        // Exiting right but channel is to the left - need to go right first
        channelX = Math.max(channelX, start.x + 30);
      } else if (outSide === "left" && channelX > start.x) {
        // Exiting left but channel is to the right - need to go left first
        channelX = Math.min(channelX, start.x - 30);
      }

      // First segment: horizontal to channel
      points.push(channelX, start.y);
      // Second segment: vertical down/up the channel to align with entry
      points.push(channelX, end.y);
      
      // Record actual waypoints at the corners (where path turns)
      // First corner: horizontal to vertical turn
      actualWaypoints.push({ x: channelX, y: start.y });
      // Second corner: vertical to horizontal turn  
      actualWaypoints.push({ x: channelX, y: end.y });
      // End point (horizontal back to anchor) is handled by caller pushing end
    } else if (inSide === "top" || inSide === "bottom") {
      // Horizontal exit to vertical entry
      // Go horizontal to waypoint, then vertical to approach the target
      points.push(srcWpX, start.y);

      // For top entry, approach from above; for bottom, from below
      const approachY =
        inSide === "top"
          ? Math.min(srcWpY, tgtWpY, end.y - 30)
          : Math.max(srcWpY, tgtWpY, end.y + 30);

      if (Math.abs(srcWpX - end.x) > 5) {
        // Need to move horizontally to align with target
        points.push(srcWpX, approachY);
        points.push(end.x, approachY);
      } else {
        points.push(srcWpX, approachY);
        points.push(end.x, approachY);
      }
      // Record waypoint at the turn
      actualWaypoints.push({ x: srcWpX, y: approachY });
    } else {
      // Default horizontal exit routing
      points.push(srcWpX, start.y);
      points.push(srcWpX, tgtWpY);
      if (Math.abs(srcWpX - end.x) > 5) {
        points.push(end.x, tgtWpY);
      }
      // Record waypoint
      actualWaypoints.push({ x: srcWpX, y: tgtWpY });
    }
  } else {
    // Exit vertically (top or bottom)
    if (inSide === "top" || inSide === "bottom") {
      // Both vertical exit and entry
      let channelY: number;

      if (inSide === "top") {
        // Entry from top - channel must be above the entry point
        channelY = Math.min(srcWpY, tgtWpY, end.y - 30);
      } else {
        // Entry from bottom - channel must be below the entry point
        channelY = Math.max(srcWpY, tgtWpY, end.y + 30);
      }

      // Ensure we go in the exit direction first
      if (outSide === "bottom" && channelY < start.y) {
        channelY = Math.max(channelY, start.y + 30);
      } else if (outSide === "top" && channelY > start.y) {
        channelY = Math.min(channelY, start.y - 30);
      }

      // First segment: vertical to channel
      points.push(start.x, channelY);
      // Second segment: horizontal along the channel
      points.push(end.x, channelY);
      
      // Record actual waypoints at the corners
      actualWaypoints.push({ x: start.x, y: channelY });
      actualWaypoints.push({ x: end.x, y: channelY });
      // End point is added by caller
    } else if (inSide === "right" || inSide === "left") {
      // Vertical exit to horizontal entry
      points.push(start.x, srcWpY);

      // For right entry, approach from the right; for left, from left
      const approachX =
        inSide === "right"
          ? Math.max(srcWpX, tgtWpX, end.x + 30)
          : Math.min(srcWpX, tgtWpX, end.x - 30);

      if (Math.abs(srcWpY - end.y) > 5) {
        points.push(approachX, srcWpY);
        points.push(approachX, end.y);
      } else {
        points.push(approachX, srcWpY);
        points.push(approachX, end.y);
      }
      // Record waypoint
      actualWaypoints.push({ x: approachX, y: srcWpY });
    } else {
      // Default vertical exit routing
      points.push(start.x, srcWpY);
      points.push(tgtWpX, srcWpY);
      if (Math.abs(srcWpY - end.y) > 5) {
        points.push(tgtWpX, end.y);
      }
      // Record waypoint
      actualWaypoints.push({ x: tgtWpX, y: srcWpY });
    }
  }

  return { actualWaypoints };
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
