/**
 * A* pathfinding integration for automatic path routing
 *
 * Builds orthogonal paths using A* algorithm with obstacle avoidance.
 */

import type { PlacedNode, Point } from "../types";
import { EDGE_PAD } from "../constants";
import { nudgePoint } from "./anchors";
import {
  type Segment,
  buildNodeObstacles,
  segmentsToObstacles,
  computeRoutingBounds,
  isInsideObstacle,
} from "./collision";
import {
  aStarRoute,
  simplifyOrthogonalPath,
  flattenPoints,
} from "./pathfinding";
import { ensureMinFinalSegment } from "./pathUtils";

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
  if (!route) {
    return null;
  }

  const stitched: Point[] = [start, launch, ...route, approach, end];
  const simplified = simplifyOrthogonalPath(stitched);
  const flattened = flattenPoints(simplified);
  ensureMinFinalSegment(flattened);
  return flattened;
}
