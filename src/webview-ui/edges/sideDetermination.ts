/**
 * Side determination for edge routing
 * 
 * Determines which sides of source/target nodes edges should exit/enter from.
 * This is the core algorithm for intelligent edge routing.
 */

import type { PlacedNode, PipelineEdge, SideDetermination } from "../types";
import { LAYOUT_CONFIG } from "../constants";
import { isErrorEdge, inferExitSideFromBendpoints, inferEntrySideFromBendpoints } from "./edgeUtils";

const { nodeWidth, nodeHeight } = LAYOUT_CONFIG;

// Enable/disable debug logging
let debugLogging = false;

/**
 * Enable or disable debug logging for side determination
 */
export function setDebugLogging(enabled: boolean): void {
  debugLogging = enabled;
}

/**
 * Debug log helper - only logs if debug mode is enabled
 */
function debugLog(message: string): void {
  if (debugLogging) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}

/**
 * Determine exit and entry sides for an edge
 * Priority: 1) XML bendpoints, 2) Smart routing based on positions, 3) Connector hints
 * 
 * This is a pure function that works with any node map type (Map or Record)
 * 
 * @param edge - The edge to route
 * @param fromNode - Source node
 * @param toNode - Target node
 * @param getNode - Function to get a node by ID (for checking blocking nodes)
 * @param nodeIds - Array of all node IDs to check for blocking
 * @returns Side determination result
 */
export function determineSides(
  edge: PipelineEdge,
  fromNode: PlacedNode,
  toNode: PlacedNode,
  getNode: (id: string) => PlacedNode | undefined,
  nodeIds: string[]
): SideDetermination {
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

  debugLog(`[EdgeRouting] Edge "${label}" from "${fromNode.label}" to "${toNode.label}" (type: ${toNode.type})`);
  debugLog(`[EdgeRouting]   dx=${dx.toFixed(0)}, dy=${dy.toFixed(0)}`);
  debugLog(`[EdgeRouting]   sourceConn="${sourceConn}", targetConn="${targetConn}"`);
  debugLog(`[EdgeRouting]   bendExitSide=${bendExitSide}, bendEntrySide=${bendEntrySide}`);

  let cellBelowEmpty = true;
  let blockingNode: PlacedNode | null = null;

  // Check for blocking nodes
  const sourceBottomY = fromNode.y + nodeHeight;
  const targetTopY = toNode.y;
  const sourceCenterX = fromNode.x + nodeWidth / 2;

  if (dy > 0) {
    for (const nodeId of nodeIds) {
      if (nodeId === fromNode.id || nodeId === toNode.id) {continue;}
      const otherNode = getNode(nodeId);
      if (!otherNode) {continue;}
      
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
    const horizontalDistance = Math.abs(dx);
    const verticalDistance = Math.abs(dy);
    const targetPrimarilyToSide =
      horizontalDistance > verticalDistance * 0.8 && horizontalDistance > nodeWidth * 0.5;

    // For join nodes, prefer entry from the direction of approach
    const isJoinTarget = toNode.type === "join";

    debugLog(`[EdgeRouting]   isJoinTarget=${isJoinTarget}, outSide=${outSide}`);
    debugLog(`[EdgeRouting]   horizontalDist=${horizontalDistance.toFixed(0)}, verticalDist=${verticalDistance.toFixed(0)}`);
    debugLog(`[EdgeRouting]   targetToRight=${targetToRight}, targetToLeft=${targetToLeft}`);

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

      debugLog(`[EdgeRouting]   Join: verticalDominant=${verticalDominant}, horizontalDominant=${horizontalDominant}`);
      debugLog(`[EdgeRouting]   Join: exitingVertically=${exitingVertically}, sigHOffset=${significantHorizontalOffset}, preferHDueToExit=${preferHorizontalDueToExit}`);

      if (horizontalDominant || (targetOnSameRow && targetPrimarilyToSide) || preferHorizontalDueToExit) {
        // Approaching more from the side - use horizontal entry
        if (targetToRight || dx > 0) {
          inSide = "left";
          // Only change exit side if horizontal is naturally dominant, not if we're forcing it due to exit direction
          if (outSide === "bottom" && horizontalDominant && !preferHorizontalDueToExit) {outSide = "right";}
          debugLog(`[EdgeRouting]   Join MATCH: horizontal from left -> inSide=left`);
        } else if (targetToLeft || dx < 0) {
          inSide = "right";
          // Only change exit side if horizontal is naturally dominant, not if we're forcing it due to exit direction
          if (outSide === "bottom" && horizontalDominant && !preferHorizontalDueToExit) {outSide = "left";}
          debugLog(`[EdgeRouting]   Join MATCH: horizontal from right -> inSide=right`);
        } else {
          inSide = "top";
          debugLog(`[EdgeRouting]   Join MATCH: horizontal centered -> inSide=top`);
        }
      } else if (verticalDominant || targetBelow) {
        // Vertical is dominant - enter from top (if target below) or bottom (if target above)
        if (targetBelow || dy > 0) {
          inSide = "top";
          debugLog(`[EdgeRouting]   Join MATCH: vertical from above -> inSide=top`);
        } else {
          inSide = "bottom";
          debugLog(`[EdgeRouting]   Join MATCH: vertical from below -> inSide=bottom`);
        }
      } else if (Math.abs(dx) < nodeWidth * 0.3) {
        // Target is nearly aligned - enter from top/bottom
        inSide = dy > 0 ? "top" : "bottom";
        debugLog(`[EdgeRouting]   Join MATCH: aligned -> inSide=${inSide}`);
      } else {
        // Mixed case - use side based on dx
        if (dx > 0) {
          inSide = "left";
          debugLog(`[EdgeRouting]   Join MATCH: mixed dx>0 -> inSide=left`);
        } else {
          inSide = "right";
          debugLog(`[EdgeRouting]   Join MATCH: mixed dx<0 -> inSide=right`);
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
    if (outSide === "bottom") {outSide = "top";}
    if ((outSide === "right" || outSide === "left") && inSide === "top") {
      inSide = "bottom";
    }
  }

  return {
    outSide: outSide as SideDetermination["outSide"],
    inSide: inSide as SideDetermination["inSide"],
    blockingNode,
  };
}

/**
 * Convenience wrapper for determineSides when using a Record<string, PlacedNode>
 * This is the typical usage in the webview
 */
export function determineSidesFromNodeMap(
  edge: PipelineEdge,
  fromNode: PlacedNode,
  toNode: PlacedNode,
  nodeMap: Record<string, PlacedNode>
): SideDetermination {
  return determineSides(
    edge,
    fromNode,
    toNode,
    (id) => nodeMap[id],
    Object.keys(nodeMap)
  );
}

/**
 * Convenience wrapper for determineSides when using a Map<string, PlacedNode>
 * This is the typical usage in the dump-layout script
 */
export function determineSidesFromMap(
  edge: PipelineEdge,
  fromNode: PlacedNode,
  toNode: PlacedNode,
  nodeMap: Map<string, PlacedNode>
): SideDetermination {
  return determineSides(
    edge,
    fromNode,
    toNode,
    (id) => nodeMap.get(id),
    Array.from(nodeMap.keys())
  );
}
