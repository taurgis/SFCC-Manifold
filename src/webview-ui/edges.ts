/**
 * Edge drawing, routing, and selection module
 */

import Konva from "konva";
import {
  LAYOUT_CONFIG,
  EDGE_SPACING,
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
import type { PlacedNode, PipelineEdge, Point } from "./types";

const { nodeWidth, nodeHeight } = LAYOUT_CONFIG;

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
 * Get arrow angle for a given side
 */
function getArrowAngleForSide(side: string): number {
  if (side === "top") return -Math.PI / 2;
  if (side === "bottom") return Math.PI / 2;
  if (side === "left") return Math.PI;
  return 0;
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

/**
 * Determine exit and entry sides for an edge
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

  let outSide = "bottom";
  let inSide = "top";

  const targetToRight = dx > nodeWidth * 0.3;
  const targetToLeft = dx < -nodeWidth * 0.3;
  const targetDirectlyBelow = Math.abs(dx) < nodeWidth * 0.5 && dy > 0;

  let cellBelowEmpty = true;
  let blockingNode: PlacedNode | null = null;
  const sourceToRightOfTarget = dx < -nodeWidth * 0.8;
  const sourceToLeftOfTarget = dx > nodeWidth * 0.8;

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

  // Source connector determines exit side
  if (sourceConn === "error" || sourceConn === "pipelet_error" || isError) {
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
  } else {
    if (!cellBelowEmpty) {
      if (targetToLeft) {
        outSide = "left";
        inSide = "right";
      } else if (targetToRight) {
        outSide = "right";
        inSide = "left";
      } else {
        outSide = "left";
        inSide = "left";
      }
    }
  }

  // Target connector determines entry side
  const targetOnSameRow = Math.abs(dy) < nodeHeight * 0.5;
  const targetDirectlyToRight = targetToRight && targetOnSameRow;
  const targetDirectlyToLeft = targetToLeft && targetOnSameRow;

  if (outSide === "right" && targetDirectlyToRight) {
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
  } else if (outSide === "bottom" && sourceToRightOfTarget) {
    inSide = "right";
  } else if (outSide === "bottom" && sourceToLeftOfTarget) {
    inSide = "left";
  } else if (blockingNode) {
    // Keep the inSide we set during blocker detection
  } else if (
    targetConn === "in" ||
    targetConn === "in1" ||
    targetConn === "in2"
  ) {
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
  } else {
    if (outSide === "right") {
      if (targetToRight) {
        inSide = "left";
      } else {
        inSide = "top";
      }
    } else if (outSide === "left") {
      if (targetToLeft) {
        inSide = "right";
      } else {
        inSide = "top";
      }
    }
  }

  // Handle back edges (target above source)
  const targetAbove = dy < -nodeHeight * 0.3;
  if (targetAbove) {
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

/**
 * Build orthogonal path between points
 */
function buildOrthogonalPath(
  start: Point,
  end: Point,
  _bendPoints: unknown[] | null,
  fromNode: PlacedNode,
  toNode: PlacedNode,
  outSide: string,
  inSide: string,
  startOffset: number,
  endOffset: number,
  nodeMap: Record<string, PlacedNode>,
  blockingNode: PlacedNode | null
): number[] {
  const points = [start.x, start.y];
  const dx = end.x - start.x;
  const dy = end.y - start.y;

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

  points.push(end.x, end.y);
  ensureMinFinalSegment(points);
  return points;
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

function routeLeftToBottom(
  points: number[],
  start: Point,
  end: Point,
  fromNode: PlacedNode,
  toNode: PlacedNode,
  nodeMap: Record<string, PlacedNode>
): void {
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

  // Arrow head
  const arrowOffset = 12;
  const arrowX = end.x + arrowOffset * Math.cos(arrowAngle);
  const arrowY = end.y + arrowOffset * Math.sin(arrowAngle);
  const rotationDegrees = (arrowAngle * 180) / Math.PI - 90;

  const arrowHead = new Konva.RegularPolygon({
    name: "edge-arrow",
    x: arrowX,
    y: arrowY,
    sides: 3,
    radius: 5,
    fill: edgeColor,
    stroke: edgeColor,
    strokeWidth: 1,
    rotation: rotationDegrees,
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

    if (isBackEdge || isGoingUp) {
      const result = buildBackEdgePath(fromNode, toNode);
      points = result.points;
      end = result.end;
      arrowAngle = -Math.PI / 2;
    } else {
      points = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        outSide,
        inSide,
        outOffset,
        inOffset,
        nodeMap,
        blockingNode
      );
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
  }
}
