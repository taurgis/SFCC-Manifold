/**
 * Back edge (loop) path building
 *
 * Creates curved paths for edges that loop back from a node to a previous node.
 */

import type { PlacedNode, Point } from "../types";
import { LAYOUT_CONFIG } from "../constants";

const { nodeWidth, nodeHeight } = LAYOUT_CONFIG;

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
