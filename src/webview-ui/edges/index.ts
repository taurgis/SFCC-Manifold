/**
 * Edge routing module - public API
 * 
 * Re-exports all edge-related functionality for easy importing.
 */

// Edge utilities
export {
  normalizeLabel,
  isErrorEdge,
  inferExitSideFromBendpoints,
  inferEntrySideFromBendpoints,
} from "./edgeUtils";

// Anchor calculations
export {
  JOIN_RADIUS,
  getAnchor,
  getAnchorPoint,
  getArrowAngleForSide,
  calculateArrowAngleFromPoints,
  sideVector,
  nudgePoint,
} from "./anchors";

// Collision detection
export {
  type ObstacleRect,
  type Segment,
  ROUTING_GRID_STEP,
  ROUTING_MARGIN,
  ROUTING_SEGMENT_THICKNESS,
  lineIntersectsNode,
  buildNodeObstacles,
  segmentsToObstacles,
  computeRoutingBounds,
  isInsideObstacle,
  pointsToSegments,
} from "./collision";

// A* pathfinding
export {
  snapToGrid,
  aStarRoute,
  simplifyOrthogonalPath,
  flattenPoints,
} from "./pathfinding";

// Side determination
export {
  setDebugLogging,
  determineSides,
  determineSidesFromNodeMap,
  determineSidesFromMap,
} from "./sideDetermination";

// Path building
export {
  buildBackEdgePath,
  buildAutoRoutedPath,
  buildOrthogonalPath,
  ensureMinFinalSegment,
  type OrthogonalPathResult,
} from "./pathBuilder";
