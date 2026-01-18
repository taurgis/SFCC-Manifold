/**
 * Path building for edge routing
 *
 * Main orchestration module that builds orthogonal paths between nodes.
 * Delegates to specialized modules for specific routing strategies.
 * Supports channel-based routing for cleaner multi-edge paths.
 */

import type { PlacedNode, Point, BendPoint } from "../types";
import { LAYOUT_CONFIG } from "../constants";
import type { Segment } from "./collision";
import type { ChannelRegistry } from "./channelRouting";

// Re-export from sub-modules for backward compatibility
export {
  isInsideNode,
  isInsideAnyNode,
  pathSegmentHitsNode,
  bendpointPathHasCollision,
} from "./nodeCollision";

export {
  isWaypointMeaningful,
  filterOnPathWaypoints,
} from "./waypoints";

export { buildBackEdgePath } from "./backEdge";

export { buildAutoRoutedPath } from "./autoRouting";

export { ensureMinFinalSegment } from "./pathUtils";

export {
  routeBottomToTop,
  routeRightToTop,
  routeLeftToTop,
  routeLeftToLeft,
  routeBottomToRight,
  routeBottomToLeft,
  routeRightToBottom,
  routeLeftToBottom,
  routeRightToLeft,
  routeLeftToRight,
  routeTopToBottom,
} from "./directionRouting";

export { ChannelRegistry } from "./channelRouting";

// Import from sub-modules for internal use
import { filterOnPathWaypoints } from "./waypoints";
import { buildAutoRoutedPath } from "./autoRouting";
import { buildBendpointPath, buildSingleWaypointPath } from "./bendpointRouting";
import type { BendpointPathResult } from "./bendpointRouting";
import { ensureMinFinalSegment } from "./pathUtils";
import {
  routeBottomToTop,
  routeRightToTop,
  routeLeftToTop,
  routeLeftToLeft,
  routeBottomToRight,
  routeBottomToLeft,
  routeRightToBottom,
  routeLeftToBottom,
  routeRightToLeft,
  routeLeftToRight,
  routeTopToBottom,
} from "./directionRouting";

const { nodeWidth, nodeHeight, horizontalGap, verticalGap } = LAYOUT_CONFIG;

/**
 * Result from buildOrthogonalPath including waypoints for visualization
 */
export interface OrthogonalPathResult {
  points: number[];
  /** Calculated waypoints from bendpoints (for visualization) */
  waypoints: Point[];
}

/**
 * Build orthogonal path between points
 * Uses XML bendpoints when available, otherwise falls back to smart routing
 * Returns both the path points and any calculated waypoints for visualization
 *
 * @param channelRegistry - Optional channel registry for merging parallel edges
 */
export function buildOrthogonalPath(
  start: Point,
  end: Point,
  bendPoints: BendPoint[] | null | undefined,
  fromNode: PlacedNode,
  toNode: PlacedNode,
  outSide: string,
  inSide: string,
  startOffset: number,
  endOffset: number,
  nodeMap: Record<string, PlacedNode>,
  blockingNode: PlacedNode | null,
  occupiedSegments: Segment[],
  channelRegistry?: ChannelRegistry
): number[] | OrthogonalPathResult {
  const points = [start.x, start.y];
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  // Check if we have bendpoints that suggest specific waypoints
  const hasBendPoints = bendPoints && bendPoints.length > 0;
  const calculatedWaypoints: Point[] = [];

  if (hasBendPoints) {
    // Use bendpoints to guide routing
    const sourceBend = bendPoints.find((bp) => bp.relativeTo === "source");
    const targetBend = bendPoints.find((bp) => bp.relativeTo === "target");

    // Convert grid-based bendpoints to pixel waypoints
    if (sourceBend && targetBend) {
      // Calculate waypoint from source bendpoint
      const sourceWaypointX =
        fromNode.x + nodeWidth / 2 + sourceBend.x * horizontalGap;
      const sourceWaypointY =
        fromNode.y + nodeHeight / 2 + sourceBend.y * verticalGap;

      // Calculate waypoint from target bendpoint
      const targetWaypointX =
        toNode.x + nodeWidth / 2 + targetBend.x * horizontalGap;
      const targetWaypointY =
        toNode.y + nodeHeight / 2 + targetBend.y * verticalGap;

      // Build path using waypoints with orthogonal routing
      // The function returns actual waypoints used (may differ from XML due to optimization)
      const result: BendpointPathResult = buildBendpointPath(
        points,
        start,
        end,
        sourceWaypointX,
        sourceWaypointY,
        targetWaypointX,
        targetWaypointY,
        outSide,
        inSide
      );

      // Use actual waypoints from the optimized path for visualization
      calculatedWaypoints.push(...result.actualWaypoints);
    } else if (sourceBend) {
      // Only source bendpoint - route through it
      const waypointX =
        fromNode.x + nodeWidth / 2 + sourceBend.x * horizontalGap;
      const waypointY =
        fromNode.y + nodeHeight / 2 + sourceBend.y * verticalGap;

      // Store waypoint for visualization
      calculatedWaypoints.push({ x: waypointX, y: waypointY });

      const success = buildSingleWaypointPath(
        points,
        start,
        end,
        waypointX,
        waypointY,
        outSide,
        inSide,
        nodeMap,
        fromNode.id,
        toNode.id,
        occupiedSegments,
        fromNode,
        toNode
      );
      if (!success) {
        // A* also failed - continue with original points (will be minimal)
      }
    } else if (targetBend) {
      // Only target bendpoint - approach from that direction
      const waypointX =
        toNode.x + nodeWidth / 2 + targetBend.x * horizontalGap;
      const waypointY =
        toNode.y + nodeHeight / 2 + targetBend.y * verticalGap;

      // Store waypoint for visualization
      calculatedWaypoints.push({ x: waypointX, y: waypointY });

      const success = buildSingleWaypointPath(
        points,
        start,
        end,
        waypointX,
        waypointY,
        outSide,
        inSide,
        nodeMap,
        fromNode.id,
        toNode.id,
        occupiedSegments,
        fromNode,
        toNode
      );
      if (!success) {
        // A* also failed - continue with original points (will be minimal)
      }
    }
  } else {
    // Fast path: straight vertical connection (bottom→top, nodes aligned)
    const isStraightVertical =
      outSide === "bottom" && inSide === "top" && Math.abs(dx) < 5 && dy > 0;

    if (isStraightVertical) {
      // Simple straight line - no routing needed
      points.push(end.x, end.y);
      return points;
    }

    // Fast path: straight horizontal connection (right→left or left→right, same row)
    const isStraightHorizontal =
      ((outSide === "right" && inSide === "left") ||
        (outSide === "left" && inSide === "right")) &&
      Math.abs(dy) < 5;

    if (isStraightHorizontal) {
      // Simple straight line - no routing needed
      points.push(end.x, end.y);
      return points;
    }

    const autoRouted = buildAutoRoutedPath(
      start,
      end,
      fromNode,
      toNode,
      outSide,
      inSide,
      nodeMap,
      occupiedSegments,
      channelRegistry
    );

    if (autoRouted) {
      return autoRouted;
    }

    // Fallback to previous heuristic routing when pathfinding fails
    applyFallbackRouting(
      points,
      start,
      end,
      dx,
      dy,
      outSide,
      inSide,
      startOffset,
      endOffset,
      fromNode,
      toNode,
      nodeMap,
      blockingNode
    );
  }

  points.push(end.x, end.y);
  ensureMinFinalSegment(points);

  // Return with waypoints if bendpoints were used, but filter out
  // waypoints that lie on the path or inside any node (they don't represent meaningful deviations)
  if (calculatedWaypoints.length > 0) {
    const meaningfulWaypoints = filterOnPathWaypoints(
      calculatedWaypoints,
      points,
      nodeMap
    );
    if (meaningfulWaypoints.length > 0) {
      return { points, waypoints: meaningfulWaypoints };
    }
  }
  return points;
}

/**
 * Apply fallback heuristic routing when A* pathfinding fails
 */
function applyFallbackRouting(
  points: number[],
  start: Point,
  end: Point,
  dx: number,
  dy: number,
  outSide: string,
  inSide: string,
  startOffset: number,
  endOffset: number,
  fromNode: PlacedNode,
  toNode: PlacedNode,
  nodeMap: Record<string, PlacedNode>,
  blockingNode: PlacedNode | null
): void {
  if (outSide === "bottom" && inSide === "top") {
    routeBottomToTop(points, start, end, dx, dy, fromNode, toNode, nodeMap);
  } else if (outSide === "right" && inSide === "top") {
    routeRightToTop(
      points,
      start,
      end,
      dy,
      startOffset,
      toNode,
      nodeMap,
      blockingNode
    );
  } else if (outSide === "left" && inSide === "top") {
    routeLeftToTop(
      points,
      start,
      end,
      dx,
      dy,
      startOffset,
      toNode,
      nodeMap,
      blockingNode
    );
  } else if (outSide === "left" && inSide === "left") {
    routeLeftToLeft(points, start, end, dy, startOffset, toNode, blockingNode);
  } else if (outSide === "bottom" && inSide === "right") {
    routeBottomToRight(points, start, end);
  } else if (outSide === "bottom" && inSide === "left") {
    routeBottomToLeft(points, start, end);
  } else if (outSide === "right" && inSide === "bottom") {
    routeRightToBottom(points, start, end, fromNode, toNode, nodeMap);
  } else if (outSide === "left" && inSide === "bottom") {
    routeLeftToBottom(points, start, end, fromNode, toNode, nodeMap);
  } else if (outSide === "right" && inSide === "left") {
    routeRightToLeft(
      points,
      start,
      end,
      dy,
      startOffset,
      endOffset,
      fromNode,
      toNode,
      nodeMap
    );
  } else if (outSide === "left" && inSide === "right") {
    routeLeftToRight(
      points,
      start,
      end,
      dy,
      startOffset,
      endOffset,
      fromNode,
      toNode,
      nodeMap
    );
  } else if (outSide === "top" && inSide === "bottom") {
    routeTopToBottom(points, start, end, dx, startOffset, endOffset);
  } else if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
    // Diagonal fallback
    if (outSide === "right" || outSide === "left") {
      points.push(end.x, start.y);
    } else {
      points.push(start.x, end.y);
    }
  }
}
