/**
 * Path building for edge routing
 * 
 * Builds orthogonal paths between nodes using various routing strategies.
 */

import type { PlacedNode, Point, BendPoint } from "../types";
import { LAYOUT_CONFIG, EDGE_PAD } from "../constants";
import { nudgePoint } from "./anchors";
import {
  type Segment,
  buildNodeObstacles,
  segmentsToObstacles,
  computeRoutingBounds,
  isInsideObstacle,
  lineIntersectsNode,
} from "./collision";
import { aStarRoute, simplifyOrthogonalPath, flattenPoints } from "./pathfinding";

const { nodeWidth, nodeHeight, horizontalGap, verticalGap } = LAYOUT_CONFIG;

/**
 * Check if a point is inside a node's bounding box (with padding)
 * Use a larger padding to ensure waypoints near edges aren't shown inside nodes
 * @internal Exported for testing
 */
export function isInsideNode(point: Point, node: PlacedNode, padding: number = 15): boolean {
  return (
    point.x >= node.x - padding &&
    point.x <= node.x + nodeWidth + padding &&
    point.y >= node.y - padding &&
    point.y <= node.y + nodeHeight + padding
  );
}

/**
 * Check if a point is inside any node in the node map
 * @internal Exported for testing
 */
export function isInsideAnyNode(point: Point, nodeMap: Record<string, PlacedNode>): boolean {
  for (const node of Object.values(nodeMap)) {
    if (isInsideNode(point, node)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a waypoint represents a meaningful turn/corner in the path.
 * A waypoint is meaningful if it's near a corner point where the path
 * changes direction. Waypoints that are simply along a straight segment,
 * near the start/end points, or inside any node boundaries should not be shown.
 * @internal Exported for testing
 */
export function isWaypointMeaningful(
  waypoint: Point,
  pathPoints: number[],
  nodeMap: Record<string, PlacedNode>,
  tolerance: number = 20
): boolean {
  // Exclude waypoints that fall inside any node
  if (isInsideAnyNode(waypoint, nodeMap)) {
    return false;
  }

  // Need at least 3 points (6 values) to have a corner
  if (pathPoints.length < 6) {
    return false;
  }

  // Check each interior point (corner) of the path
  // Skip first point (start) and last point (end)
  for (let i = 2; i < pathPoints.length - 2; i += 2) {
    const cornerX = pathPoints[i];
    const cornerY = pathPoints[i + 1];

    // Check if waypoint is near this corner
    const dx = Math.abs(waypoint.x - cornerX);
    const dy = Math.abs(waypoint.y - cornerY);

    if (dx <= tolerance && dy <= tolerance) {
      // Waypoint is near a corner - this is a meaningful waypoint
      return true;
    }
  }

  return false;
}

/**
 * Filter waypoints to only include those that represent meaningful turns
 * and are not inside any node boundaries
 * @internal Exported for testing
 */
export function filterOnPathWaypoints(
  waypoints: Point[],
  pathPoints: number[],
  nodeMap: Record<string, PlacedNode>
): Point[] {
  return waypoints.filter(wp => isWaypointMeaningful(wp, pathPoints, nodeMap));
}

/**
 * Build back edge (loop) path
 * Creates a curved path that loops back around the left side
 */
export function buildBackEdgePath(
  fromNode: PlacedNode,
  toNode: PlacedNode
): { points: number[]; end: Point } {
  const x1 = fromNode.x + nodeWidth / 2;
  const y1 =
    fromNode.type === "join"
      ? fromNode.y + nodeHeight / 2 + 10
      : fromNode.y + nodeHeight;
  const x2 = toNode.x + nodeWidth / 2;
  const y2 =
    toNode.type === "join" ? toNode.y + nodeHeight / 2 - 10 : toNode.y;

  const loopOffset = 50;
  const leftX = Math.min(fromNode.x, toNode.x) - loopOffset;
  const points: number[] = [];
  const steps = 30;

  for (let t = 0; t <= 1; t += 1 / steps) {
    let px: number, py: number;
    if (t < 0.33) {
      const lt = t * 3;
      px = (1 - lt) * (1 - lt) * x1 + 2 * (1 - lt) * lt * x1 + lt * lt * leftX;
      py =
        (1 - lt) * (1 - lt) * y1 +
        2 * (1 - lt) * lt * (y1 + 30) +
        lt * lt * ((y1 + y2) / 2);
    } else if (t < 0.66) {
      const lt = (t - 0.33) * 3;
      px = leftX;
      py = (1 - lt) * ((y1 + y2) / 2 + 20) + lt * ((y1 + y2) / 2 - 20);
    } else {
      const lt = (t - 0.66) * 3;
      px = (1 - lt) * (1 - lt) * leftX + 2 * (1 - lt) * lt * x2 + lt * lt * x2;
      py =
        (1 - lt) * (1 - lt) * ((y1 + y2) / 2 - 20) +
        2 * (1 - lt) * lt * (y2 - 30) +
        lt * lt * y2;
    }
    points.push(px, py);
  }

  return { points, end: { x: x2, y: y2 } };
}

/**
 * Build auto-routed path using A* pathfinding
 */
export function buildAutoRoutedPath(
  start: Point,
  end: Point,
  fromNode: PlacedNode,
  toNode: PlacedNode,
  outSide: string,
  inSide: string,
  nodeMap: Record<string, PlacedNode>,
  occupiedSegments: Segment[]
): number[] | null {
  const launch = nudgePoint(start, outSide, 14);
  const approach = nudgePoint(end, inSide, 14);

  const obstacles = [
    ...buildNodeObstacles(nodeMap, fromNode.id, toNode.id),
    ...segmentsToObstacles(occupiedSegments),
  ];

  const bounds = computeRoutingBounds(nodeMap, start, end);

  // Avoid attempting paths starting inside an obstacle
  if (isInsideObstacle(launch.x, launch.y, obstacles)) {
    obstacles.push({
      left: launch.x - EDGE_PAD,
      right: launch.x + EDGE_PAD,
      top: launch.y - EDGE_PAD,
      bottom: launch.y + EDGE_PAD,
    });
  }

  const route = aStarRoute(launch, approach, obstacles, bounds);
  if (!route) return null;

  const stitched: Point[] = [start, launch, ...route, approach, end];
  const simplified = simplifyOrthogonalPath(stitched);
  const flattened = flattenPoints(simplified);
  ensureMinFinalSegment(flattened);
  return flattened;
}

/**
 * Build path through source and target waypoints using orthogonal segments
 */
function buildBendpointPath(
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
 * Build path through a single waypoint
 */
function buildSingleWaypointPath(
  points: number[],
  start: Point,
  end: Point,
  wpX: number,
  wpY: number,
  outSide: string,
  inSide: string
): void {
  const minApproachDistance = 30; // Minimum distance for arrow visibility

  if (outSide === "right" || outSide === "left") {
    // Exit horizontally
    points.push(wpX, start.y);

    if (inSide === "top") {
      // Need to approach from above - ensure enough vertical space
      const approachY = end.y - minApproachDistance;
      if (start.y < approachY) {
        // Already above, go down to approach height, then horizontal, then down
        points.push(wpX, approachY);
        points.push(end.x, approachY);
      } else {
        // Need to go up first to get above target
        const aboveY = Math.min(start.y, end.y - minApproachDistance);
        points.push(wpX, aboveY);
        points.push(end.x, aboveY);
      }
    } else if (inSide === "bottom") {
      // Need to approach from below - ensure enough vertical space
      const approachY = end.y + minApproachDistance;
      if (start.y > approachY) {
        points.push(wpX, approachY);
        points.push(end.x, approachY);
      } else {
        const belowY = Math.max(start.y, end.y + minApproachDistance);
        points.push(wpX, belowY);
        points.push(end.x, belowY);
      }
    } else if (inSide === "left" || inSide === "right") {
      // Approaching from side - go to waypoint then to end
      points.push(wpX, end.y);
    } else {
      // Default: vertical to waypoint y, then horizontal
      points.push(wpX, wpY);
      points.push(end.x, wpY);
    }
  } else {
    // Exit vertically
    points.push(start.x, wpY);

    if (inSide === "left") {
      // Approach from the left
      const approachX = end.x - minApproachDistance;
      points.push(approachX, wpY);
      points.push(approachX, end.y);
    } else if (inSide === "right") {
      // Approach from the right
      const approachX = end.x + minApproachDistance;
      points.push(approachX, wpY);
      points.push(approachX, end.y);
    } else {
      // Then horizontal to waypoint x, then vertical
      points.push(wpX, wpY);
      points.push(wpX, end.y);
    }
  }
}

// ===== Routing helper functions =====

/**
 * Route from bottom exit to top entry with obstacle avoidance
 * @internal Exported for testing
 */
export function routeBottomToTop(
  points: number[],
  start: Point,
  end: Point,
  dx: number,
  _dy: number,
  fromNode: PlacedNode,
  toNode: PlacedNode,
  nodeMap: Record<string, PlacedNode>
): void {
  if (Math.abs(dx) > 5) {
    const midY = (start.y + end.y) / 2;
    const blocker = lineIntersectsNode(
      start.x,
      midY,
      end.x,
      midY,
      nodeMap,
      fromNode.id,
      toNode.id
    );
    if (blocker) {
      const clearanceY = Math.min(start.y + 30, blocker.y - 25);
      if (start.x > blocker.x + nodeWidth) {
        const clearX = blocker.x + nodeWidth + 25;
        points.push(start.x, clearanceY);
        points.push(clearX, clearanceY);
        points.push(clearX, end.y);
      } else if (start.x < blocker.x) {
        const clearX = blocker.x - 25;
        points.push(start.x, clearanceY);
        points.push(clearX, clearanceY);
        points.push(clearX, end.y);
      } else {
        const goRight = end.x > start.x;
        const clearX = goRight ? blocker.x + nodeWidth + 25 : blocker.x - 25;
        points.push(start.x, clearanceY);
        points.push(clearX, clearanceY);
        points.push(clearX, end.y);
      }
    } else {
      const vertBlocker1 = lineIntersectsNode(
        start.x,
        start.y,
        start.x,
        midY,
        nodeMap,
        fromNode.id,
        toNode.id
      );
      const vertBlocker2 = lineIntersectsNode(
        end.x,
        midY,
        end.x,
        end.y,
        nodeMap,
        fromNode.id,
        toNode.id
      );
      if (vertBlocker1 || vertBlocker2) {
        const blocker = vertBlocker1 || vertBlocker2;
        const clearX = blocker!.x + nodeWidth + 25;
        points.push(clearX, start.y);
        points.push(clearX, end.y);
      } else {
        points.push(start.x, midY);
        points.push(end.x, midY);
      }
    }
  } else {
    const vertBlocker = lineIntersectsNode(
      start.x,
      start.y,
      end.x,
      end.y,
      nodeMap,
      fromNode.id,
      toNode.id
    );
    if (vertBlocker) {
      const clearanceX = vertBlocker.x + nodeWidth + 25;
      points.push(clearanceX, start.y);
      points.push(clearanceX, end.y);
    }
  }
}

/**
 * Route from right exit to top entry
 * @internal Exported for testing
 */
export function routeRightToTop(
  points: number[],
  start: Point,
  end: Point,
  dy: number,
  startOffset: number,
  toNode: PlacedNode,
  nodeMap: Record<string, PlacedNode>,
  _blockingNode: PlacedNode | null
): void {
  const dx = end.x - start.x;
  const laneSpacing = Math.abs(startOffset) * 7.5;
  let baseClearance = 30;
  if (dx < 0) {
    baseClearance = 50;
  }
  const distanceOffset = Math.min(Math.abs(dy) / 7, 90);
  let clearanceX =
    start.x + nodeWidth / 2 + baseClearance + laneSpacing + distanceOffset;
  let aboveTargetY = end.y - 25;

  const vertBlocker = lineIntersectsNode(
    clearanceX,
    start.y,
    clearanceX,
    aboveTargetY,
    nodeMap,
    "",
    toNode.id
  );
  if (vertBlocker) {
    clearanceX = vertBlocker.x + nodeWidth + 25;
  }

  const horizBlocker = lineIntersectsNode(
    clearanceX,
    aboveTargetY,
    end.x,
    aboveTargetY,
    nodeMap,
    "",
    toNode.id
  );
  if (horizBlocker) {
    aboveTargetY = horizBlocker.y - 25;
  }

  points.push(clearanceX, start.y);
  points.push(clearanceX, aboveTargetY);
  points.push(end.x, aboveTargetY);
}

/**
 * Route from left exit to top entry
 * @internal Exported for testing
 */
export function routeLeftToTop(
  points: number[],
  start: Point,
  end: Point,
  dx: number,
  dy: number,
  startOffset: number,
  toNode: PlacedNode,
  nodeMap: Record<string, PlacedNode>,
  blockingNode: PlacedNode | null
): void {
  const laneSpacing = Math.abs(startOffset) * 7.5;
  let baseClearance = 30;
  if (dx > 0) {
    baseClearance = 50;
  }
  const distanceOffset = Math.min(Math.abs(dy) / 7, 90);
  let clearanceX =
    start.x - nodeWidth / 2 - baseClearance - laneSpacing - distanceOffset;
  let aboveTargetY = end.y - 25;

  if (blockingNode) {
    const blockerLeft = blockingNode.x - 25;
    if (clearanceX > blockerLeft) {
      clearanceX = blockerLeft;
    }
    const blockerTop = blockingNode.y;
    const blockerBottom = blockingNode.y + nodeHeight;
    if (aboveTargetY > blockerTop - 10 && aboveTargetY < blockerBottom + 10) {
      aboveTargetY = blockerBottom + 25;
    }
  }

  const vertBlocker = lineIntersectsNode(
    clearanceX,
    start.y,
    clearanceX,
    aboveTargetY,
    nodeMap,
    "",
    toNode.id
  );
  if (vertBlocker) {
    clearanceX = vertBlocker.x - 25;
  }

  const horizBlocker = lineIntersectsNode(
    clearanceX,
    aboveTargetY,
    end.x,
    aboveTargetY,
    nodeMap,
    "",
    toNode.id
  );
  if (horizBlocker) {
    aboveTargetY = horizBlocker.y + nodeHeight + 25;
  }

  points.push(clearanceX, start.y);
  points.push(clearanceX, aboveTargetY);
  points.push(end.x, aboveTargetY);
}

/**
 * Route from left exit to left entry
 * @internal Exported for testing
 */
export function routeLeftToLeft(
  points: number[],
  start: Point,
  end: Point,
  dy: number,
  startOffset: number,
  toNode: PlacedNode,
  blockingNode: PlacedNode | null
): void {
  const laneSpacing = Math.abs(startOffset) * 7.5;
  const baseClearance = 30;
  const distanceOffset = Math.min(Math.abs(dy) / 7, 90);
  let clearanceX =
    start.x - nodeWidth / 2 - baseClearance - laneSpacing - distanceOffset;

  if (blockingNode) {
    const blockerLeft = blockingNode.x - 25;
    if (clearanceX > blockerLeft) {
      clearanceX = blockerLeft;
    }
  }

  const targetLeftX = toNode.x - 25;
  if (clearanceX > targetLeftX) {
    clearanceX = targetLeftX - 25;
  }

  points.push(clearanceX, start.y);
  points.push(clearanceX, end.y);
}

/**
 * Route from bottom exit to right entry - simple L-shape
 * @internal Exported for testing
 */
export function routeBottomToRight(points: number[], start: Point, end: Point): void {
  points.push(start.x, end.y);
}

/**
 * Route from bottom exit to left entry - simple L-shape
 * @internal Exported for testing
 */
export function routeBottomToLeft(points: number[], start: Point, end: Point): void {
  points.push(start.x, end.y);
}

/**
 * Route from right exit to bottom entry
 * @internal Exported for testing
 */
export function routeRightToBottom(
  points: number[],
  start: Point,
  end: Point,
  fromNode: PlacedNode,
  toNode: PlacedNode,
  nodeMap: Record<string, PlacedNode>
): void {
  const dy = end.y - start.y;
  const targetAbove = dy < 0;

  if (targetAbove) {
    // Target is above source - need to go right, up, then approach from below
    const clearanceX = Math.max(start.x + 30, end.x + nodeWidth / 2 + 30);
    const belowTargetY = end.y + 30;

    points.push(clearanceX, start.y);
    points.push(clearanceX, belowTargetY);
    points.push(end.x, belowTargetY);
  } else {
    // Target is below or same level - standard routing
    const horizBlocker = lineIntersectsNode(
      start.x,
      start.y,
      end.x,
      start.y,
      nodeMap,
      fromNode.id,
      toNode.id
    );
    if (horizBlocker) {
      const belowY = horizBlocker.y + nodeHeight + 25;
      points.push(start.x, belowY);
      points.push(end.x, belowY);
    } else {
      points.push(end.x, start.y);
    }
  }
}

/**
 * Route from left exit to bottom entry
 * @internal Exported for testing
 */
export function routeLeftToBottom(
  points: number[],
  start: Point,
  end: Point,
  fromNode: PlacedNode,
  toNode: PlacedNode,
  nodeMap: Record<string, PlacedNode>
): void {
  const dy = end.y - start.y;
  const targetAbove = dy < 0;

  if (targetAbove) {
    // Target is above source - need to go left, up, then approach from below
    const clearanceX = Math.min(start.x - 30, end.x - nodeWidth / 2 - 30);
    const belowTargetY = end.y + 30;

    points.push(clearanceX, start.y);
    points.push(clearanceX, belowTargetY);
    points.push(end.x, belowTargetY);
  } else {
    // Target is below or same level - standard routing
    const horizBlocker = lineIntersectsNode(
      start.x,
      start.y,
      end.x,
      start.y,
      nodeMap,
      fromNode.id,
      toNode.id
    );
    if (horizBlocker) {
      const belowY = horizBlocker.y + nodeHeight + 25;
      points.push(start.x, belowY);
      points.push(end.x, belowY);
    } else {
      points.push(end.x, start.y);
    }
  }
}

/**
 * Route from right exit to left entry
 * @internal Exported for testing
 */
export function routeRightToLeft(
  points: number[],
  start: Point,
  end: Point,
  dy: number,
  startOffset: number,
  endOffset: number,
  fromNode: PlacedNode,
  toNode: PlacedNode,
  nodeMap: Record<string, PlacedNode>
): void {
  if (Math.abs(dy) > 10) {
    let midX = (start.x + end.x) / 2;
    const routeY = start.y + startOffset;

    const vertBlocker = lineIntersectsNode(
      midX,
      Math.min(start.y, end.y),
      midX,
      Math.max(start.y, end.y),
      nodeMap,
      fromNode.id,
      toNode.id
    );
    if (vertBlocker) {
      midX = vertBlocker.x + nodeWidth + 25;
    }

    points.push(midX, routeY);
    points.push(midX, end.y + endOffset);
  }
}

/**
 * Route from left exit to right entry
 * @internal Exported for testing
 */
export function routeLeftToRight(
  points: number[],
  start: Point,
  end: Point,
  dy: number,
  startOffset: number,
  endOffset: number,
  fromNode: PlacedNode,
  toNode: PlacedNode,
  nodeMap: Record<string, PlacedNode>
): void {
  if (Math.abs(dy) > 10) {
    let midX = (start.x + end.x) / 2;
    const routeY = start.y + startOffset;

    const vertBlocker = lineIntersectsNode(
      midX,
      Math.min(start.y, end.y),
      midX,
      Math.max(start.y, end.y),
      nodeMap,
      fromNode.id,
      toNode.id
    );
    if (vertBlocker) {
      midX = vertBlocker.x - 25;
    }

    points.push(midX, routeY);
    points.push(midX, end.y + endOffset);
  }
}

/**
 * Route from top exit to bottom entry
 * @internal Exported for testing
 */
export function routeTopToBottom(
  points: number[],
  start: Point,
  end: Point,
  dx: number,
  startOffset: number,
  endOffset: number
): void {
  if (Math.abs(dx) > 5) {
    const midY = (start.y + end.y) / 2;
    const routeX = start.x + startOffset;
    points.push(routeX, midY);
    points.push(end.x + endOffset, midY);
  }
}

/**
 * Ensure the final segment has minimum length for arrow visibility
 */
export function ensureMinFinalSegment(points: number[]): void {
  const minFinalSegment = 25;
  if (points.length >= 4) {
    const lastX = points[points.length - 2];
    const lastY = points[points.length - 1];
    const prevX = points[points.length - 4];
    const prevY = points[points.length - 3];

    const finalDx = Math.abs(lastX - prevX);
    const finalDy = Math.abs(lastY - prevY);

    if (finalDx < 5 && finalDy < minFinalSegment && finalDy > 0) {
      const extension = minFinalSegment - finalDy;
      if (lastY > prevY) {
        points[points.length - 3] = prevY - extension;
      } else {
        points[points.length - 3] = prevY + extension;
      }
    } else if (finalDy < 5 && finalDx < minFinalSegment && finalDx > 0) {
      const extension = minFinalSegment - finalDx;
      if (lastX > prevX) {
        points[points.length - 4] = prevX - extension;
      } else {
        points[points.length - 4] = prevX + extension;
      }
    }
  }
}

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
  occupiedSegments: Segment[]
): number[] | OrthogonalPathResult {
  const points = [start.x, start.y];
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  // Check if we have bendpoints that suggest specific waypoints
  const hasBendPoints = bendPoints && bendPoints.length > 0;
  const calculatedWaypoints: Point[] = [];

  if (hasBendPoints) {
    // Use bendpoints to guide routing
    const sourceBend = bendPoints!.find((bp) => bp.relativeTo === "source");
    const targetBend = bendPoints!.find((bp) => bp.relativeTo === "target");

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

      // Store waypoints for visualization
      calculatedWaypoints.push({ x: sourceWaypointX, y: sourceWaypointY });
      calculatedWaypoints.push({ x: targetWaypointX, y: targetWaypointY });

      // Build path using waypoints with orthogonal routing
      buildBendpointPath(
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
    } else if (sourceBend) {
      // Only source bendpoint - route through it
      const waypointX =
        fromNode.x + nodeWidth / 2 + sourceBend.x * horizontalGap;
      const waypointY =
        fromNode.y + nodeHeight / 2 + sourceBend.y * verticalGap;

      // Store waypoint for visualization
      calculatedWaypoints.push({ x: waypointX, y: waypointY });

      buildSingleWaypointPath(
        points,
        start,
        end,
        waypointX,
        waypointY,
        outSide,
        inSide
      );
    } else if (targetBend) {
      // Only target bendpoint - approach from that direction
      const waypointX =
        toNode.x + nodeWidth / 2 + targetBend.x * horizontalGap;
      const waypointY =
        toNode.y + nodeHeight / 2 + targetBend.y * verticalGap;

      // Store waypoint for visualization
      calculatedWaypoints.push({ x: waypointX, y: waypointY });

      buildSingleWaypointPath(
        points,
        start,
        end,
        waypointX,
        waypointY,
        outSide,
        inSide
      );
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
      occupiedSegments
    );

    if (autoRouted) {
      return autoRouted;
    }

    // Fallback to previous heuristic routing when pathfinding fails
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
      if (outSide === "right" || outSide === "left") {
        points.push(end.x, start.y);
      } else {
        points.push(start.x, end.y);
      }
    }
  }

  points.push(end.x, end.y);
  ensureMinFinalSegment(points);

  // Return with waypoints if bendpoints were used, but filter out
  // waypoints that lie on the path or inside any node (they don't represent meaningful deviations)
  if (calculatedWaypoints.length > 0) {
    const meaningfulWaypoints = filterOnPathWaypoints(calculatedWaypoints, points, nodeMap);
    if (meaningfulWaypoints.length > 0) {
      return { points, waypoints: meaningfulWaypoints };
    }
  }
  return points;
}
