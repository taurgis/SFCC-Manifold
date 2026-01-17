/**
 * Edge drawing, routing, and selection module
 */

import Konva from "konva";
import {
  LAYOUT_CONFIG,
  EDGE_SPACING,
  EDGE_PAD,
  getEdgeColor,
  isLoopBackEdge,
} from "./constants";
import {
  edgeGroups,
  selectedEdgeId,
  setSelectedEdgeId,
} from "./state";
import { clearSelection } from "./selection";
import { showPropertiesPanel, renderEdgeProperties } from "./properties";
import type { PlacedNode, PipelineEdge, Point, BendPoint } from "./types";

const { nodeWidth, nodeHeight, horizontalGap, verticalGap } = LAYOUT_CONFIG;

type ObstacleRect = { left: number; right: number; top: number; bottom: number };
type Segment = { x1: number; y1: number; x2: number; y2: number };

const ROUTING_GRID_STEP = 18;
const ROUTING_MARGIN = 200;
const ROUTING_SEGMENT_THICKNESS = 10;

/**
 * Normalize edge label for comparison
 */
function normalizeLabel(label: string | null | undefined): string {
  if (!label) return "";
  return String(label).toLowerCase().replace(/[\s-]/g, "_");
}

/**
 * Check if edge is an error edge
 */
function isErrorEdge(label: string | null | undefined): boolean {
  const l = normalizeLabel(label);
  return l === "error" || l.indexOf("error") !== -1 || l === "pipelet_error";
}

/**
 * Infer exit side from XML bendpoints
 * Returns the side if it can be inferred, null otherwise
 */
function inferExitSideFromBendpoints(bendPoints: BendPoint[] | undefined): string | null {
  if (!bendPoints || bendPoints.length === 0) return null;
  
  // Look for source-relative bendpoint
  const sourceBend = bendPoints.find(bp => bp.relativeTo === "source");
  if (!sourceBend) return null;
  
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
 */
function inferEntrySideFromBendpoints(bendPoints: BendPoint[] | undefined): string | null {
  if (!bendPoints || bendPoints.length === 0) return null;
  
  // Look for target-relative bendpoint
  const targetBend = bendPoints.find(bp => bp.relativeTo === "target");
  if (!targetBend) return null;
  
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

/**
 * Get anchor point for a node side
 */
function getAnchor(
  node: PlacedNode,
  side: string,
  offset: number
): Point {
  if (node.type === "join") {
    const joinRadius = 10;
    const centerX = node.x + nodeWidth / 2;
    const centerY = node.y + nodeHeight / 2;

    if (side === "top") return { x: centerX + offset, y: centerY - joinRadius };
    if (side === "bottom")
      return { x: centerX + offset, y: centerY + joinRadius };
    if (side === "left") return { x: centerX - joinRadius, y: centerY + offset };
    return { x: centerX + joinRadius, y: centerY + offset };
  }

  if (side === "top")
    return { x: node.x + nodeWidth / 2 + offset, y: node.y };
  if (side === "bottom")
    return { x: node.x + nodeWidth / 2 + offset, y: node.y + nodeHeight };
  if (side === "left")
    return { x: node.x, y: node.y + nodeHeight / 2 + offset };
  return { x: node.x + nodeWidth, y: node.y + nodeHeight / 2 + offset };
}

/**
 * Get arrow angle for a given entry side
 * Arrow points INTO the target node from the specified side
 */
function getArrowAngleForSide(side: string): number {
  // If entering from top, arrow points down (into the top of the node)
  if (side === "top") return Math.PI / 2;      // 90° = down
  // If entering from bottom, arrow points up (into the bottom of the node)
  if (side === "bottom") return -Math.PI / 2;  // -90° = up
  // If entering from left, arrow points right (into the left of the node)
  if (side === "left") return 0;               // 0° = right
  // If entering from right, arrow points left (into the right of the node)
  return Math.PI;                              // 180° = left
}

function calculateArrowAngleFromPoints(points: number[]): number {
  if (points.length < 4) return 0;
  
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

function sideVector(side: string): Point {
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

function nudgePoint(point: Point, side: string, distance: number): Point {
  const v = sideVector(side);
  return { x: point.x + v.x * distance, y: point.y + v.y * distance };
}

/**
 * Check if a line segment intersects any node
 */
function lineIntersectsNode(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  nodeMap: Record<string, PlacedNode>,
  fromNodeId: string,
  toNodeId: string
): PlacedNode | null {
  if (!nodeMap) return null;
  const padding = 10;

  for (const nodeId in nodeMap) {
    if (nodeId === fromNodeId || nodeId === toNodeId) continue;
    const node = nodeMap[nodeId];
    const nodeLeft = node.x - padding;
    const nodeRight = node.x + nodeWidth + padding;
    const nodeTop = node.y - padding;
    const nodeBottom = node.y + nodeHeight + padding;

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    // Check horizontal line
    if (Math.abs(y1 - y2) < 5) {
      if (y1 > nodeTop && y1 < nodeBottom) {
        if (maxX > nodeLeft && minX < nodeRight) {
          return node;
        }
      }
    }
    // Check vertical line
    else if (Math.abs(x1 - x2) < 5) {
      if (x1 > nodeLeft && x1 < nodeRight) {
        if (maxY > nodeTop && minY < nodeBottom) {
          return node;
        }
      }
    }
  }
  return null;
}

function buildNodeObstacles(
  nodeMap: Record<string, PlacedNode>,
  fromNodeId: string,
  toNodeId: string
): ObstacleRect[] {
  const padding = EDGE_PAD;
  const obstacles: ObstacleRect[] = [];
  for (const [id, node] of Object.entries(nodeMap)) {
    if (id === fromNodeId || id === toNodeId) continue;
    obstacles.push({
      left: node.x - padding,
      right: node.x + nodeWidth + padding,
      top: node.y - padding,
      bottom: node.y + nodeHeight + padding,
    });
  }
  return obstacles;
}

function segmentsToObstacles(segments: Segment[]): ObstacleRect[] {
  const obstacles: ObstacleRect[] = [];
  for (const seg of segments) {
    const minX = Math.min(seg.x1, seg.x2) - ROUTING_SEGMENT_THICKNESS;
    const maxX = Math.max(seg.x1, seg.x2) + ROUTING_SEGMENT_THICKNESS;
    const minY = Math.min(seg.y1, seg.y2) - ROUTING_SEGMENT_THICKNESS;
    const maxY = Math.max(seg.y1, seg.y2) + ROUTING_SEGMENT_THICKNESS;
    obstacles.push({ left: minX, right: maxX, top: minY, bottom: maxY });
  }
  return obstacles;
}

function computeRoutingBounds(
  nodeMap: Record<string, PlacedNode>,
  start: Point,
  end: Point
): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Math.min(start.x, end.x);
  let maxX = Math.max(start.x, end.x);
  let minY = Math.min(start.y, end.y);
  let maxY = Math.max(start.y, end.y);

  for (const node of Object.values(nodeMap)) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x + nodeWidth);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y + nodeHeight);
  }

  return {
    minX: minX - ROUTING_MARGIN,
    maxX: maxX + ROUTING_MARGIN,
    minY: minY - ROUTING_MARGIN,
    maxY: maxY + ROUTING_MARGIN,
  };
}

function isInsideObstacle(x: number, y: number, obstacles: ObstacleRect[]): boolean {
  for (const obs of obstacles) {
    if (x >= obs.left && x <= obs.right && y >= obs.top && y <= obs.bottom) {
      return true;
    }
  }
  return false;
}

function snapToGrid(value: number): number {
  return Math.round(value / ROUTING_GRID_STEP) * ROUTING_GRID_STEP;
}

function pointKey(x: number, y: number): string {
  return `${x}|${y}`;
}

function reconstructPath(
  cameFrom: Record<string, string>,
  currentKey: string,
  nodeLookup: Record<string, Point>
): Point[] {
  const path: Point[] = [nodeLookup[currentKey]];
  let key = currentKey;
  while (cameFrom[key]) {
    key = cameFrom[key];
    path.push(nodeLookup[key]);
  }
  return path.reverse();
}

function aStarRoute(
  start: Point,
  end: Point,
  obstacles: ObstacleRect[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): Point[] | null {
  const startX = snapToGrid(start.x);
  const startY = snapToGrid(start.y);
  const endX = snapToGrid(end.x);
  const endY = snapToGrid(end.y);

  const startKey = pointKey(startX, startY);
  const goalKey = pointKey(endX, endY);

  const openSet: string[] = [startKey];
  const cameFrom: Record<string, string> = {};
  const gScore: Record<string, number> = { [startKey]: 0 };
  const fScore: Record<string, number> = {
    [startKey]: Math.abs(startX - endX) + Math.abs(startY - endY),
  };

  const nodeLookup: Record<string, Point> = {
    [startKey]: { x: startX, y: startY },
  };

  const maxIterations = 12000;
  let iterations = 0;

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations += 1;
    openSet.sort((a, b) => (fScore[a] ?? Infinity) - (fScore[b] ?? Infinity));
    const current = openSet.shift();
    if (!current) break;
    if (current === goalKey) {
      nodeLookup[goalKey] = { x: endX, y: endY };
      return reconstructPath(cameFrom, current, nodeLookup);
    }

    const currentPoint = nodeLookup[current];
    const neighbors: Point[] = [
      { x: currentPoint.x + ROUTING_GRID_STEP, y: currentPoint.y },
      { x: currentPoint.x - ROUTING_GRID_STEP, y: currentPoint.y },
      { x: currentPoint.x, y: currentPoint.y + ROUTING_GRID_STEP },
      { x: currentPoint.x, y: currentPoint.y - ROUTING_GRID_STEP },
    ];

    for (const nb of neighbors) {
      if (
        nb.x < bounds.minX ||
        nb.x > bounds.maxX ||
        nb.y < bounds.minY ||
        nb.y > bounds.maxY
      ) {
        continue;
      }

      if (isInsideObstacle(nb.x, nb.y, obstacles)) continue;

      const nbKey = pointKey(nb.x, nb.y);
      const tentativeG = (gScore[current] ?? Infinity) + ROUTING_GRID_STEP;

      if (tentativeG >= (gScore[nbKey] ?? Infinity)) continue;

      cameFrom[nbKey] = current;
      gScore[nbKey] = tentativeG;
      const heuristic = Math.abs(nb.x - endX) + Math.abs(nb.y - endY);
      fScore[nbKey] = tentativeG + heuristic * 1.1; // light bias toward directness
      nodeLookup[nbKey] = nb;

      if (!openSet.includes(nbKey)) {
        openSet.push(nbKey);
      }
    }
  }

  return null;
}

function simplifyOrthogonalPath(path: Point[]): Point[] {
  if (path.length < 3) return path;
  const simplified: Point[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = path[i];
    const next = path[i + 1];

    const dirPrev = { x: curr.x - prev.x, y: curr.y - prev.y };
    const dirNext = { x: next.x - curr.x, y: next.y - curr.y };
    const collinear = dirPrev.x === 0 && dirNext.x === 0;
    const horizontal = dirPrev.y === 0 && dirNext.y === 0;

    if (collinear || horizontal) {
      continue;
    }
    simplified.push(curr);
  }
  simplified.push(path[path.length - 1]);
  return simplified;
}

function flattenPoints(points: Point[]): number[] {
  const result: number[] = [];
  for (const p of points) {
    result.push(p.x, p.y);
  }
  return result;
}

function pointsToSegments(points: number[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 2; i += 2) {
    segments.push({
      x1: points[i],
      y1: points[i + 1],
      x2: points[i + 2],
      y2: points[i + 3],
    });
  }
  return segments;
}

/**
 * Determine exit and entry sides for an edge
 * Priority: 1) XML bendpoints, 2) Smart routing based on positions, 3) Connector hints
 */
function determineSides(
  edge: PipelineEdge,
  fromNode: PlacedNode,
  toNode: PlacedNode,
  nodeMap: Record<string, PlacedNode>
): { outSide: string; inSide: string; blockingNode: PlacedNode | null } {
  const label = edge.label;
  const isError = isErrorEdge(label);
  const dx = toNode.x + nodeWidth / 2 - (fromNode.x + nodeWidth / 2);
  const dy = toNode.y + nodeHeight / 2 - (fromNode.y + nodeHeight / 2);

  const sourceConn = (edge.sourceConnector || "").toLowerCase();
  const targetConn = (edge.targetConnector || "").toLowerCase();
  
  // Get bendpoints from edge display data
  const bendPoints = edge.display?.bendPoints;
  
  // First, check if bendpoints provide explicit routing hints
  const bendExitSide = inferExitSideFromBendpoints(bendPoints);
  const bendEntrySide = inferEntrySideFromBendpoints(bendPoints);

  let outSide = "bottom";
  let inSide = "top";

  const targetToRight = dx > nodeWidth * 0.3;
  const targetToLeft = dx < -nodeWidth * 0.3;
  const targetDirectlyBelow = Math.abs(dx) < nodeWidth * 0.5 && dy > 0;
  const targetAbove = dy < -nodeHeight * 0.3;
  const targetBelow = dy > nodeHeight * 0.3;

  console.log(`[EdgeRouting] Edge "${label}" from "${fromNode.label}" to "${toNode.label}" (type: ${toNode.type})`);
  console.log(`[EdgeRouting]   dx=${dx.toFixed(0)}, dy=${dy.toFixed(0)}`);
  console.log(`[EdgeRouting]   sourceConn="${sourceConn}", targetConn="${targetConn}"`);
  console.log(`[EdgeRouting]   bendExitSide=${bendExitSide}, bendEntrySide=${bendEntrySide}`);

  let cellBelowEmpty = true;
  let blockingNode: PlacedNode | null = null;

  if (nodeMap) {
    const sourceBottomY = fromNode.y + nodeHeight;
    const targetTopY = toNode.y;
    const sourceCenterX = fromNode.x + nodeWidth / 2;

    if (dy > 0) {
      for (const nodeId in nodeMap) {
        if (nodeId === fromNode.id || nodeId === toNode.id) continue;
        const otherNode = nodeMap[nodeId];
        const otherCenterX = otherNode.x + nodeWidth / 2;
        const otherTop = otherNode.y;

        if (Math.abs(otherCenterX - sourceCenterX) < nodeWidth * 0.8) {
          if (otherTop >= sourceBottomY - 10 && otherTop < targetTopY) {
            cellBelowEmpty = false;
            blockingNode = otherNode;
            break;
          }
        }
      }
    }
  }

  // ===== DETERMINE EXIT SIDE =====
  
  // Priority 1: Bendpoints take precedence (XML-defined routing)
  if (bendExitSide) {
    outSide = bendExitSide;
  }
  // Priority 2: Source connector type (error, yes, no)
  else if (sourceConn === "error" || sourceConn === "pipelet_error" || isError) {
    outSide = "right";
  } else if (sourceConn === "yes" || sourceConn === "true") {
    if (targetDirectlyBelow && cellBelowEmpty) {
      outSide = "bottom";
    } else {
      outSide = "right";
    }
  } else if (sourceConn === "no" || sourceConn === "false") {
    if (targetDirectlyBelow && cellBelowEmpty) {
      outSide = "bottom";
    } else {
      outSide = "left";
    }
  }
  // Priority 3: Smart routing based on relative positions
  else {
    // When target is directly to the side on the same row, exit from that side for a direct path
    const targetOnSameRowForExit = Math.abs(dy) < nodeHeight * 0.5;
    if (targetOnSameRowForExit && (targetToLeft || targetToRight)) {
      outSide = targetToLeft ? "left" : "right";
    } else if (!cellBelowEmpty) {
      if (targetToLeft) {
        outSide = "left";
      } else if (targetToRight) {
        outSide = "right";
      } else {
        outSide = "left";
      }
    }
  }

  // ===== DETERMINE ENTRY SIDE =====
  
  // Priority 1: Bendpoints take precedence (XML-defined routing)
  if (bendEntrySide) {
    inSide = bendEntrySide;
  }
  // Priority 2: Smart routing based on exit side, positions, and node types
  else {
    const targetOnSameRow = Math.abs(dy) < nodeHeight * 0.5;
    const targetDirectlyToRight = targetToRight && targetOnSameRow;
    const targetDirectlyToLeft = targetToLeft && targetOnSameRow;
    const sourceToRightOfTarget = dx < -nodeWidth * 0.8;
    const sourceToLeftOfTarget = dx > nodeWidth * 0.8;
    
    // Check if horizontal routing is clearly better (target primarily to the side)
    // This handles cases where target is not on exact same row but is more horizontal than vertical
    const horizontalDistance = Math.abs(dx);
    const verticalDistance = Math.abs(dy);
    const targetPrimarilyToSide = horizontalDistance > verticalDistance * 0.8 && horizontalDistance > nodeWidth * 0.5;
    
    // For join nodes, prefer entry from the direction of approach
    const isJoinTarget = toNode.type === "join";

    console.log(`[EdgeRouting]   isJoinTarget=${isJoinTarget}, outSide=${outSide}`);
    console.log(`[EdgeRouting]   horizontalDist=${horizontalDistance.toFixed(0)}, verticalDist=${verticalDistance.toFixed(0)}`);
    console.log(`[EdgeRouting]   targetToRight=${targetToRight}, targetToLeft=${targetToLeft}`);

    // For join nodes, always determine entry based on approach direction
    if (isJoinTarget) {
      // Determine which direction is dominant
      const verticalDominant = verticalDistance > horizontalDistance * 1.2;
      const horizontalDominant = horizontalDistance > verticalDistance * 1.2;
      
      // When exiting vertically (bottom/top) and target has significant horizontal offset
      // (more than one node width away), prefer horizontal entry - this creates cleaner paths
      const exitingVertically = outSide === "bottom" || outSide === "top";
      const significantHorizontalOffset = horizontalDistance > nodeWidth;
      const preferHorizontalDueToExit = exitingVertically && significantHorizontalOffset;
      
      console.log(`[EdgeRouting]   Join: verticalDominant=${verticalDominant}, horizontalDominant=${horizontalDominant}`);
      console.log(`[EdgeRouting]   Join: exitingVertically=${exitingVertically}, sigHOffset=${significantHorizontalOffset}, preferHDueToExit=${preferHorizontalDueToExit}`);
      
      if (horizontalDominant || (targetOnSameRow && targetPrimarilyToSide) || preferHorizontalDueToExit) {
        // Approaching more from the side - use horizontal entry
        if (targetToRight || dx > 0) {
          inSide = "left";
          // Only change exit side if horizontal is naturally dominant, not if we're forcing it due to exit direction
          if (outSide === "bottom" && horizontalDominant && !preferHorizontalDueToExit) outSide = "right";
          console.log(`[EdgeRouting]   Join MATCH: horizontal from left -> inSide=left`);
        } else if (targetToLeft || dx < 0) {
          inSide = "right";
          // Only change exit side if horizontal is naturally dominant, not if we're forcing it due to exit direction
          if (outSide === "bottom" && horizontalDominant && !preferHorizontalDueToExit) outSide = "left";
          console.log(`[EdgeRouting]   Join MATCH: horizontal from right -> inSide=right`);
        } else {
          inSide = "top";
          console.log(`[EdgeRouting]   Join MATCH: horizontal centered -> inSide=top`);
        }
      } else if (verticalDominant || targetBelow) {
        // Vertical is dominant - enter from top (if target below) or bottom (if target above)
        if (targetBelow || dy > 0) {
          inSide = "top";
          console.log(`[EdgeRouting]   Join MATCH: vertical from above -> inSide=top`);
        } else {
          inSide = "bottom";
          console.log(`[EdgeRouting]   Join MATCH: vertical from below -> inSide=bottom`);
        }
      } else if (Math.abs(dx) < nodeWidth * 0.3) {
        // Target is nearly aligned - enter from top/bottom
        inSide = dy > 0 ? "top" : "bottom";
        console.log(`[EdgeRouting]   Join MATCH: aligned -> inSide=${inSide}`);
      } else {
        // Mixed case - use side based on dx
        if (dx > 0) {
          inSide = "left";
          console.log(`[EdgeRouting]   Join MATCH: mixed dx>0 -> inSide=left`);
        } else {
          inSide = "right";
          console.log(`[EdgeRouting]   Join MATCH: mixed dx<0 -> inSide=right`);
        }
      }
    }
    // Non-join targets
    else if (outSide === "right" && targetDirectlyToRight) {
      inSide = "left";
    } else if (outSide === "left" && targetDirectlyToLeft) {
      inSide = "right";
    } else if (outSide === "bottom" && targetOnSameRow) {
      if (targetToRight) {
        outSide = "right";
        inSide = "left";
      } else if (targetToLeft) {
        outSide = "left";
        inSide = "right";
      }
    } else if (outSide === "bottom" && targetPrimarilyToSide && !blockingNode) {
      // Target is more to the side than below - use horizontal routing
      if (targetToRight) {
        outSide = "right";
        inSide = "left";
      } else if (targetToLeft) {
        outSide = "left";
        inSide = "right";
      }
    } else if (outSide === "bottom" && sourceToRightOfTarget) {
      inSide = "right";
    } else if (outSide === "bottom" && sourceToLeftOfTarget) {
      inSide = "left";
    } else if (blockingNode) {
      // Keep the default or connector-based inSide
      if (targetToLeft) {
        inSide = "right";
      } else if (targetToRight) {
        inSide = "left";
      } else {
        inSide = "left";
      }
    }
    // Priority 3: Target connector hints
    else if (targetConn === "in" || targetConn === "in1" || targetConn === "in2") {
      inSide = "top";
    } else if (targetConn === "loop") {
      inSide = "top";
    } else if (targetConn === "left") {
      inSide = "left";
    } else if (targetConn === "right") {
      inSide = "right";
    } else if (targetConn === "bottom") {
      inSide = "bottom";
    } else if (targetConn) {
      inSide = "top";
    }
    // Smart defaults based on exit side
    else {
      if (outSide === "right") {
        if (targetToRight) {
          inSide = "left";
        } else if (targetAbove) {
          inSide = "bottom";
        } else {
          inSide = "top";
        }
      } else if (outSide === "left") {
        if (targetToLeft) {
          inSide = "right";
        } else if (targetAbove) {
          inSide = "bottom";
        } else {
          inSide = "top";
        }
      }
    }
  }

  // Handle back edges (target above source) - but respect bendpoints
  if (targetAbove && !bendExitSide && !bendEntrySide) {
    if (outSide === "bottom") outSide = "top";
    if ((outSide === "right" || outSide === "left") && inSide === "top") {
      inSide = "bottom";
    }
  }

  return { outSide, inSide, blockingNode };
}

/**
 * Build back edge (loop) path
 */
function buildBackEdgePath(
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
    toNode.type === "join"
      ? toNode.y + nodeHeight / 2 - 10
      : toNode.y;

  const loopOffset = 50;
  const leftX = Math.min(fromNode.x, toNode.x) - loopOffset;
  const points: number[] = [];
  const steps = 30;

  for (let t = 0; t <= 1; t += 1 / steps) {
    let px: number, py: number;
    if (t < 0.33) {
      const lt = t * 3;
      px =
        (1 - lt) * (1 - lt) * x1 + 2 * (1 - lt) * lt * x1 + lt * lt * leftX;
      py =
        (1 - lt) * (1 - lt) * y1 +
        2 * (1 - lt) * lt * (y1 + 30) +
        lt * lt * ((y1 + y2) / 2);
    } else if (t < 0.66) {
      const lt = (t - 0.33) * 3;
      px = leftX;
      py =
        (1 - lt) * ((y1 + y2) / 2 + 20) + lt * ((y1 + y2) / 2 - 20);
    } else {
      const lt = (t - 0.66) * 3;
      px =
        (1 - lt) * (1 - lt) * leftX + 2 * (1 - lt) * lt * x2 + lt * lt * x2;
      py =
        (1 - lt) * (1 - lt) * ((y1 + y2) / 2 - 20) +
        2 * (1 - lt) * lt * (y2 - 30) +
        lt * lt * y2;
    }
    points.push(px, py);
  }

  return { points, end: { x: x2, y: y2 } };
}

function buildAutoRoutedPath(
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
 * Build orthogonal path between points
 * Uses XML bendpoints when available, otherwise falls back to smart routing
 */
function buildOrthogonalPath(
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
): number[] {
  const points = [start.x, start.y];
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  // Check if we have bendpoints that suggest specific waypoints
  const hasBendPoints = bendPoints && bendPoints.length > 0;
  
  if (hasBendPoints) {
    // Use bendpoints to guide routing
    const sourceBend = bendPoints!.find(bp => bp.relativeTo === "source");
    const targetBend = bendPoints!.find(bp => bp.relativeTo === "target");
    
    // Convert grid-based bendpoints to pixel waypoints
    if (sourceBend && targetBend) {
      // Calculate waypoint from source bendpoint
      const sourceWaypointX = fromNode.x + nodeWidth / 2 + sourceBend.x * horizontalGap;
      const sourceWaypointY = fromNode.y + nodeHeight / 2 + sourceBend.y * verticalGap;
      
      // Calculate waypoint from target bendpoint  
      const targetWaypointX = toNode.x + nodeWidth / 2 + targetBend.x * horizontalGap;
      const targetWaypointY = toNode.y + nodeHeight / 2 + targetBend.y * verticalGap;
      
      // Build path using waypoints with orthogonal routing
      buildBendpointPath(points, start, end, sourceWaypointX, sourceWaypointY, 
                         targetWaypointX, targetWaypointY, outSide, inSide);
    } else if (sourceBend) {
      // Only source bendpoint - route through it
      const waypointX = fromNode.x + nodeWidth / 2 + sourceBend.x * horizontalGap;
      const waypointY = fromNode.y + nodeHeight / 2 + sourceBend.y * verticalGap;
      buildSingleWaypointPath(points, start, end, waypointX, waypointY, outSide, inSide);
    } else if (targetBend) {
      // Only target bendpoint - approach from that direction
      const waypointX = toNode.x + nodeWidth / 2 + targetBend.x * horizontalGap;
      const waypointY = toNode.y + nodeHeight / 2 + targetBend.y * verticalGap;
      buildSingleWaypointPath(points, start, end, waypointX, waypointY, outSide, inSide);
    }
  } else {
    // Fast path: straight vertical connection (bottom→top, nodes aligned)
    const isStraightVertical =
      outSide === "bottom" &&
      inSide === "top" &&
      Math.abs(dx) < 5 &&
      dy > 0;
    
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
      routeLeftToLeft(
        points,
        start,
        end,
        dy,
        startOffset,
        toNode,
        blockingNode
      );
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
  return points;
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
  inSide: string
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

// Routing helper functions
function routeBottomToTop(
  points: number[],
  start: Point,
  end: Point,
  dx: number,
  dy: number,
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

function routeRightToTop(
  points: number[],
  start: Point,
  end: Point,
  dy: number,
  startOffset: number,
  toNode: PlacedNode,
  nodeMap: Record<string, PlacedNode>,
  blockingNode: PlacedNode | null
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

function routeLeftToTop(
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

function routeLeftToLeft(
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

function routeBottomToRight(
  points: number[],
  start: Point,
  end: Point
): void {
  points.push(start.x, end.y);
}

function routeBottomToLeft(
  points: number[],
  start: Point,
  end: Point
): void {
  points.push(start.x, end.y);
}

function routeRightToBottom(
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
    // Calculate clearance to the right of source
    const clearanceX = Math.max(start.x + 30, end.x + nodeWidth / 2 + 30);
    // Go below the target to approach from bottom
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

function routeLeftToBottom(
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
    // Calculate clearance to the left of source
    const clearanceX = Math.min(start.x - 30, end.x - nodeWidth / 2 - 30);
    // Go below the target to approach from bottom
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

function routeRightToLeft(
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

function routeLeftToRight(
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

function routeTopToBottom(
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

function ensureMinFinalSegment(points: number[]): void {
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
 * Clear edge selection
 */
export function clearEdgeSelection(layer: Konva.Layer): void {
  if (selectedEdgeId && edgeGroups[selectedEdgeId]) {
    const group = edgeGroups[selectedEdgeId];
    const edgeData = group.getAttr("edgeData") as PipelineEdge;
    const originalColor = getEdgeColor(edgeData.label);

    const edgeLine = group.findOne(".edge-line") as Konva.Line | undefined;
    if (edgeLine) {
      edgeLine.stroke(originalColor);
      edgeLine.strokeWidth(2);
    }

    const arrowLine = group.findOne(".edge-arrow") as
      | Konva.RegularPolygon
      | undefined;
    if (arrowLine) {
      arrowLine.fill(originalColor);
      arrowLine.stroke(originalColor);
    }

    const texts = group.find("Text") as Konva.Text[];
    texts.forEach((text) => {
      text.fill(originalColor);
    });

    const glow = group.findOne(".edge-glow");
    if (glow) {
      glow.destroy();
    }
  }
  setSelectedEdgeId(null);
}

/**
 * Select an edge
 */
function selectEdge(
  edgeId: string,
  edge: PipelineEdge,
  layer: Konva.Layer
): void {
  clearSelection();

  if (selectedEdgeId && selectedEdgeId !== edgeId) {
    clearEdgeSelection(layer);
  }

  setSelectedEdgeId(edgeId);
  const group = edgeGroups[edgeId];
  if (!group) return;

  const highlightColor = "#ffffff";

  const edgeLine = group.findOne(".edge-line") as Konva.Line | undefined;
  if (edgeLine) {
    edgeLine.stroke(highlightColor);
    edgeLine.strokeWidth(4);
  }

  const arrowLine = group.findOne(".edge-arrow") as
    | Konva.RegularPolygon
    | undefined;
  if (arrowLine) {
    arrowLine.fill(highlightColor);
    arrowLine.stroke(highlightColor);
  }

  const texts = group.find("Text") as Konva.Text[];
  texts.forEach((text) => {
    text.fill(highlightColor);
  });

  // Add glow effect
  if (edgeLine) {
    const glowLine = edgeLine.clone({
      name: "edge-glow",
      stroke: highlightColor,
      strokeWidth: 10,
      opacity: 0.3,
      listening: false,
    });
    group.add(glowLine);
    glowLine.moveToBottom();
  }

  layer.batchDraw();

  showPropertiesPanel();
  renderEdgeProperties(edge);
}

/**
 * Setup edge hover effects
 */
function setupEdgeHover(
  edgeGroup: Konva.Group,
  edgeId: string,
  edge: PipelineEdge,
  layer: Konva.Layer
): void {
  edgeGroup.on("mouseenter", () => {
    document.body.style.cursor = "pointer";
    if (selectedEdgeId !== edgeId) {
      const group = edgeGroups[edgeId];
      const edgeLine = group?.findOne(".edge-line") as Konva.Line | undefined;
      if (edgeLine) {
        edgeLine.strokeWidth(4);
      }
      layer.batchDraw();
    }
  });

  edgeGroup.on("mouseleave", () => {
    document.body.style.cursor = "default";
    if (selectedEdgeId !== edgeId) {
      const group = edgeGroups[edgeId];
      const edgeLine = group?.findOne(".edge-line") as Konva.Line | undefined;
      if (edgeLine) {
        edgeLine.strokeWidth(2);
      }
      layer.batchDraw();
    }
  });

  edgeGroup.on("click tap", (e) => {
    e.cancelBubble = true;
    selectEdge(edgeId, edge, layer);
  });
}

/**
 * Create edge group with all visual elements
 */
function createEdgeGroup(
  layer: Konva.Layer,
  edgeId: string,
  edge: PipelineEdge,
  points: number[],
  edgeColor: string,
  arrowAngle: number,
  end: Point,
  start: Point,
  outSide: string
): void {
  const edgeGroup = new Konva.Group({
    name: "edge-group",
    perfectDrawEnabled: false,
  });
  edgeGroup.setAttr("edgeData", edge);
  edgeGroups[edgeId] = edgeGroup;

  // Hit area
  const hitLine = new Konva.Line({
    points: points,
    stroke: "transparent",
    strokeWidth: 20,
    lineCap: "round",
    lineJoin: "round",
    hitStrokeWidth: 20,
    perfectDrawEnabled: false,
  });
  edgeGroup.add(hitLine);

  // Visible line
  const visibleLine = new Konva.Line({
    name: "edge-line",
    points: points,
    stroke: edgeColor,
    strokeWidth: 2,
    lineCap: "round",
    lineJoin: "round",
    listening: false,
    perfectDrawEnabled: false,
  });
  edgeGroup.add(visibleLine);

  // Arrow head - manual triangle so orientation is always correct
  // Use the actual last point from the path, not the `end` parameter
  const actualEndX = points[points.length - 2];
  const actualEndY = points[points.length - 1];
  const arrowRadius = 8;
  const baseHalf = arrowRadius * 0.7;
  const dirX = Math.cos(arrowAngle);
  const dirY = Math.sin(arrowAngle);
  const tipX = actualEndX;
  const tipY = actualEndY;
  const baseCenterX = tipX - dirX * arrowRadius;
  const baseCenterY = tipY - dirY * arrowRadius;
  const perpX = -dirY;
  const perpY = dirX;
  const baseLeftX = baseCenterX + perpX * baseHalf;
  const baseLeftY = baseCenterY + perpY * baseHalf;
  const baseRightX = baseCenterX - perpX * baseHalf;
  const baseRightY = baseCenterY - perpY * baseHalf;

  const arrowHead = new Konva.Line({
    name: "edge-arrow",
    points: [
      tipX,
      tipY,
      baseLeftX,
      baseLeftY,
      baseRightX,
      baseRightY,
    ],
    closed: true,
    fill: edgeColor,
    stroke: edgeColor,
    strokeWidth: 1,
    listening: false,
    perfectDrawEnabled: false,
  });
  edgeGroup.add(arrowHead);

  // Label
  if (edge.label) {
    let labelX = (start.x + end.x) / 2;
    let labelY = (start.y + end.y) / 2;
    if (outSide === "right" || outSide === "left") {
      labelY -= 14;
    } else {
      labelX += 14;
      labelY -= 16;
    }

    const text = new Konva.Text({
      x: labelX,
      y: labelY,
      text: edge.label,
      fontSize: 11,
      fontFamily: "IBM Plex Sans, system-ui, sans-serif",
      fill: edgeColor,
      listening: false,
    });
    text.offsetX(text.width() / 2);
    edgeGroup.add(text);
  }

  setupEdgeHover(edgeGroup, edgeId, edge, layer);
  layer.add(edgeGroup);
}

/**
 * Draw edges between nodes
 */
export function drawEdges(
  layer: Konva.Layer,
  edges: PipelineEdge[],
  nodeMap: Record<string, PlacedNode>
): void {
  // First pass: plan routes
  interface PlannedEdge {
    i: number;
    edgeId: string;
    edge: PipelineEdge;
    fromNode: PlacedNode;
    toNode: PlacedNode;
    outSide: string;
    inSide: string;
    blockingNode: PlacedNode | null;
  }

  const planned: PlannedEdge[] = [];
  const outCounts: Record<string, number> = {};
  const inCounts: Record<string, number> = {};
  const occupiedSegments: Segment[] = [];

  function incCount(map: Record<string, number>, key: string): void {
    map[key] = (map[key] || 0) + 1;
  }

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const fromNode = nodeMap[edge.from];
    const toNode = nodeMap[edge.to];
    if (!fromNode || !toNode) continue;

    const edgeId = `edge-${i}-${edge.from}-${edge.to}`;
    const sides = determineSides(edge, fromNode, toNode, nodeMap);

    const outKey = `${edge.from}|${sides.outSide}`;
    const inKey = `${edge.to}|${sides.inSide}`;
    incCount(outCounts, outKey);
    incCount(inCounts, inKey);

    planned.push({
      i,
      edgeId,
      edge,
      fromNode,
      toNode,
      outSide: sides.outSide,
      inSide: sides.inSide,
      blockingNode: sides.blockingNode,
    });
  }

  // Second pass: draw
  const outIndex: Record<string, number> = {};
  const inIndex: Record<string, number> = {};

  function nextOffset(
    indexMap: Record<string, number>,
    countMap: Record<string, number>,
    key: string
  ): number {
    const idx = indexMap[key] || 0;
    indexMap[key] = idx + 1;
    const total = countMap[key] || 1;
    return (idx - (total - 1) / 2) * EDGE_SPACING;
  }

  for (const plan of planned) {
    const { edge, fromNode, toNode, edgeId, outSide, inSide, blockingNode } =
      plan;

    const edgeColor = getEdgeColor(edge.label);
    const isBackEdge = isLoopBackEdge(edge.label);

    const outKey = `${edge.from}|${outSide}`;
    const inKey = `${edge.to}|${inSide}`;
    const outOffset = nextOffset(outIndex, outCounts, outKey);
    const inOffset = nextOffset(inIndex, inCounts, inKey);

    let start = getAnchor(
      fromNode,
      outSide,
      outSide === "top" || outSide === "bottom" ? outOffset : outOffset
    );
    let end = getAnchor(
      toNode,
      inSide,
      inSide === "top" || inSide === "bottom" ? inOffset : inOffset
    );

    // Align for straight vertical connections
    const fromCenterX = fromNode.x + nodeWidth / 2;
    const toCenterX = toNode.x + nodeWidth / 2;
    const nodesAligned = Math.abs(fromCenterX - toCenterX) < 5;

    if (outSide === "bottom" && inSide === "top" && nodesAligned) {
      const alignedX = fromCenterX;
      const startY =
        fromNode.type === "join"
          ? fromNode.y + nodeHeight / 2 + 10
          : fromNode.y + nodeHeight;
      const endY =
        toNode.type === "join"
          ? toNode.y + nodeHeight / 2 - 10
          : toNode.y;
      start = { x: alignedX, y: startY };
      end = { x: alignedX, y: endY };
    }

    const isGoingUp = end.y < start.y - 5;

    let points: number[];
    let arrowAngle: number;

    // Get bendpoints from edge display data
    const bendPoints = edge.display?.bendPoints;
    const hasBendPoints = bendPoints && bendPoints.length > 0;

    // If we have bendpoints, use orthogonal routing even if going up
    // Bendpoints should take priority over the automatic back-edge detection
    if ((isBackEdge || isGoingUp) && !hasBendPoints) {
      const result = buildBackEdgePath(fromNode, toNode);
      points = result.points;
      end = result.end;
      // For back edges, arrow points up into top of target
      arrowAngle = -Math.PI / 2;
    } else {
      points = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        outSide,
        inSide,
        outOffset,
        inOffset,
        nodeMap,
        blockingNode,
        occupiedSegments
      );
      // Always use inSide to determine arrow direction
      // This is more reliable than computing from path (which may have routing artifacts)
      arrowAngle = getArrowAngleForSide(inSide);
    }

    createEdgeGroup(
      layer,
      edgeId,
      edge,
      points,
      edgeColor,
      arrowAngle,
      end,
      start,
      outSide
    );

    occupiedSegments.push(...pointsToSegments(points));
  }
}
