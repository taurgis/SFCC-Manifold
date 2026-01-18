/**
 * Direction-specific routing functions
 *
 * Provides fallback routing for specific entry/exit side combinations.
 * Used when A* pathfinding is unavailable or fails.
 */

import type { PlacedNode, Point } from "../types";
import { LAYOUT_CONFIG } from "../constants";
import { lineIntersectsNode } from "./collision";

const { nodeWidth, nodeHeight } = LAYOUT_CONFIG;

/**
 * Route from bottom exit to top entry with obstacle avoidance
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
        const blocker = (vertBlocker1 || vertBlocker2) as PlacedNode;
        const clearX = blocker.x + nodeWidth + 25;
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
 */
export function routeBottomToRight(
  points: number[],
  start: Point,
  end: Point
): void {
  points.push(start.x, end.y);
}

/**
 * Route from bottom exit to left entry - simple L-shape
 */
export function routeBottomToLeft(
  points: number[],
  start: Point,
  end: Point
): void {
  points.push(start.x, end.y);
}

/**
 * Route from right exit to bottom entry
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
