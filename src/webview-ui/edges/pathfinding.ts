/**
 * A* pathfinding for edge routing
 * 
 * Implements grid-based A* pathfinding to route edges around obstacles.
 * Uses a binary min-heap for efficient priority queue operations.
 */

import type { Point } from "../types";
import { ROUTING_GRID_STEP, type ObstacleRect, isInsideObstacle } from "./collision";

/**
 * Snap a coordinate to the routing grid
 */
export function snapToGrid(value: number): number {
  return Math.round(value / ROUTING_GRID_STEP) * ROUTING_GRID_STEP;
}

/**
 * Create a unique key for a grid point
 */
function pointKey(x: number, y: number): string {
  return `${x}|${y}`;
}

/**
 * Binary min-heap implementation for efficient A* open set
 * Provides O(log n) insert and extract-min operations
 */
class MinHeap {
  private heap: string[] = [];
  private fScore: Record<string, number>;

  constructor(fScore: Record<string, number>) {
    this.fScore = fScore;
  }

  private getScore(key: string): number {
    return this.fScore[key] ?? Infinity;
  }

  private parent(i: number): number {
    return Math.floor((i - 1) / 2);
  }

  private leftChild(i: number): number {
    return 2 * i + 1;
  }

  private rightChild(i: number): number {
    return 2 * i + 2;
  }

  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  private bubbleUp(i: number): void {
    while (i > 0 && this.getScore(this.heap[i]) < this.getScore(this.heap[this.parent(i)])) {
      this.swap(i, this.parent(i));
      i = this.parent(i);
    }
  }

  private bubbleDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = this.leftChild(i);
      const right = this.rightChild(i);

      if (left < n && this.getScore(this.heap[left]) < this.getScore(this.heap[smallest])) {
        smallest = left;
      }
      if (right < n && this.getScore(this.heap[right]) < this.getScore(this.heap[smallest])) {
        smallest = right;
      }

      if (smallest === i) {break;}
      this.swap(i, smallest);
      i = smallest;
    }
  }

  push(key: string): void {
    this.heap.push(key);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): string | undefined {
    if (this.heap.length === 0) {return undefined;}
    if (this.heap.length === 1) {return this.heap.pop();}

    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return min;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  get size(): number {
    return this.heap.length;
  }
}

/**
 * Reconstruct path from A* search results
 */
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

/**
 * A* pathfinding algorithm for orthogonal routes
 * Uses binary min-heap for O(log n) operations instead of O(n log n) sorting
 * 
 * @param start - Start point
 * @param end - End point
 * @param obstacles - Array of obstacle rectangles to avoid
 * @param bounds - Bounding box for the search area
 * @returns Array of waypoints or null if no path found
 */
export function aStarRoute(
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

  const cameFrom: Record<string, string> = {};
  const gScore: Record<string, number> = { [startKey]: 0 };
  const fScore: Record<string, number> = {
    [startKey]: Math.abs(startX - endX) + Math.abs(startY - endY),
  };

  // Use min-heap for efficient priority queue operations
  const openSet = new MinHeap(fScore);
  const inOpenSet = new Set<string>([startKey]);
  openSet.push(startKey);

  const nodeLookup: Record<string, Point> = {
    [startKey]: { x: startX, y: startY },
  };

  const maxIterations = 12000;
  let iterations = 0;

  while (!openSet.isEmpty() && iterations < maxIterations) {
    iterations += 1;
    const current = openSet.pop();
    
    if (!current) {break;}
    inOpenSet.delete(current);
    
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

      if (isInsideObstacle(nb.x, nb.y, obstacles)) {continue;}

      const nbKey = pointKey(nb.x, nb.y);
      const tentativeG = (gScore[current] ?? Infinity) + ROUTING_GRID_STEP;

      if (tentativeG >= (gScore[nbKey] ?? Infinity)) {continue;}

      cameFrom[nbKey] = current;
      gScore[nbKey] = tentativeG;
      const heuristic = Math.abs(nb.x - endX) + Math.abs(nb.y - endY);
      fScore[nbKey] = tentativeG + heuristic * 1.1; // light bias toward directness
      nodeLookup[nbKey] = nb;

      if (!inOpenSet.has(nbKey)) {
        openSet.push(nbKey);
        inOpenSet.add(nbKey);
      }
    }
  }

  return null;
}

/**
 * Simplify an orthogonal path by removing collinear points
 * 
 * @param path - Array of waypoints
 * @returns Simplified path with only turn points
 */
export function simplifyOrthogonalPath(path: Point[]): Point[] {
  if (path.length < 3) {return path;}
  
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

/**
 * Flatten array of points to flat coordinate array
 * 
 * @param points - Array of Point objects
 * @returns Flat array [x1, y1, x2, y2, ...]
 */
export function flattenPoints(points: Point[]): number[] {
  const result: number[] = [];
  
  for (const p of points) {
    result.push(p.x, p.y);
  }
  
  return result;
}
