/**
 * Waypoint filtering and validation for path building
 *
 * Provides functions to determine if waypoints are meaningful and should be displayed.
 */

import type { PlacedNode, Point } from "../types";
import { isInsideAnyNode } from "./nodeCollision";

/**
 * Check if a waypoint represents a meaningful turn/corner in the path.
 * A waypoint is meaningful if it's near a corner point where the path
 * changes direction. Waypoints that are simply along a straight segment,
 * near the start/end points, or inside any node boundaries should not be shown.
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
 */
export function filterOnPathWaypoints(
  waypoints: Point[],
  pathPoints: number[],
  nodeMap: Record<string, PlacedNode>
): Point[] {
  return waypoints.filter((wp) =>
    isWaypointMeaningful(wp, pathPoints, nodeMap)
  );
}
