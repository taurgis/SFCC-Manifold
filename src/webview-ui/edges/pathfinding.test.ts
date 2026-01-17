import { describe, it, expect } from "vitest";
import {
  snapToGrid,
  aStarRoute,
  simplifyOrthogonalPath,
  flattenPoints,
} from "./pathfinding";
import type { Point } from "../types";
import type { ObstacleRect } from "./collision";
import { ROUTING_GRID_STEP } from "./collision";

describe("snapToGrid", () => {
  it("should snap value to nearest grid point", () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(ROUTING_GRID_STEP)).toBe(ROUTING_GRID_STEP);
    expect(snapToGrid(ROUTING_GRID_STEP * 2)).toBe(ROUTING_GRID_STEP * 2);
  });

  it("should round to nearest grid point", () => {
    const step = ROUTING_GRID_STEP;
    expect(snapToGrid(step / 2)).toBe(step);
    expect(snapToGrid(step / 2 - 1)).toBe(0);
  });

  it("should handle negative values", () => {
    const step = ROUTING_GRID_STEP;
    expect(snapToGrid(-step)).toBe(-step);
    // Math.round rounds -0.5 to -0, which is equivalent to 0 (== comparison)
    expect(snapToGrid(-step / 2) == 0).toBe(true);
    expect(snapToGrid(-step - 1)).toBe(-step);
  });
});

describe("aStarRoute", () => {
  const defaultBounds = {
    minX: -500,
    maxX: 500,
    minY: -500,
    maxY: 500,
  };

  it("should find a direct path with no obstacles", () => {
    const start: Point = { x: 0, y: 0 };
    const end: Point = { x: 100, y: 0 };

    const path = aStarRoute(start, end, [], defaultBounds);

    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(0);
    // Path should start near start and end near end
    expect(path![0].x).toBeCloseTo(snapToGrid(start.x), 0);
    expect(path![path!.length - 1].x).toBeCloseTo(snapToGrid(end.x), 0);
  });

  it("should find a path around obstacles", () => {
    const start: Point = { x: 0, y: 0 };
    const end: Point = { x: 100, y: 0 };
    const obstacles: ObstacleRect[] = [
      { left: 40, right: 60, top: -50, bottom: 50 },
    ];

    const path = aStarRoute(start, end, obstacles, defaultBounds);

    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(2); // Should have detour points
  });

  it("should return null when no path exists", () => {
    const start: Point = { x: 0, y: 0 };
    const end: Point = { x: 100, y: 0 };
    // Completely blocking obstacles
    const obstacles: ObstacleRect[] = [
      { left: -1000, right: 1000, top: -50, bottom: 50 },
    ];
    const tightBounds = { minX: -200, maxX: 200, minY: -100, maxY: 100 };

    const path = aStarRoute(start, end, obstacles, tightBounds);

    expect(path).toBeNull();
  });

  it("should respect bounds", () => {
    const start: Point = { x: 0, y: 0 };
    const end: Point = { x: 50, y: 0 };
    const bounds = { minX: -10, maxX: 60, minY: -10, maxY: 10 };

    const path = aStarRoute(start, end, [], bounds);

    if (path) {
      for (const point of path) {
        expect(point.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(point.x).toBeLessThanOrEqual(bounds.maxX);
        expect(point.y).toBeGreaterThanOrEqual(bounds.minY);
        expect(point.y).toBeLessThanOrEqual(bounds.maxY);
      }
    }
  });

  it("should handle start and end at same position", () => {
    const start: Point = { x: 0, y: 0 };
    const end: Point = { x: 0, y: 0 };

    const path = aStarRoute(start, end, [], defaultBounds);

    expect(path).not.toBeNull();
    expect(path!.length).toBe(1);
  });
});

describe("simplifyOrthogonalPath", () => {
  it("should return short paths unchanged", () => {
    const path: Point[] = [{ x: 0, y: 0 }];
    expect(simplifyOrthogonalPath(path)).toEqual(path);

    const path2: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    expect(simplifyOrthogonalPath(path2)).toEqual(path2);
  });

  it("should remove collinear vertical points", () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 0, y: 100 },
    ];

    const simplified = simplifyOrthogonalPath(path);

    expect(simplified).toHaveLength(2);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified[1]).toEqual({ x: 0, y: 100 });
  });

  it("should remove collinear horizontal points", () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ];

    const simplified = simplifyOrthogonalPath(path);

    expect(simplified).toHaveLength(2);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified[1]).toEqual({ x: 100, y: 0 });
  });

  it("should preserve corner points", () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];

    const simplified = simplifyOrthogonalPath(path);

    expect(simplified).toHaveLength(3);
    expect(simplified).toEqual(path);
  });

  it("should handle complex paths with multiple corners", () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 }, // collinear, should be removed
      { x: 100, y: 0 },
      { x: 100, y: 50 }, // collinear, should be removed
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ];

    const simplified = simplifyOrthogonalPath(path);

    expect(simplified).toHaveLength(4);
    expect(simplified).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
  });
});

describe("flattenPoints", () => {
  it("should flatten point array to coordinate array", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      { x: 200, y: 100 },
    ];

    const flattened = flattenPoints(points);

    expect(flattened).toEqual([0, 0, 100, 50, 200, 100]);
  });

  it("should return empty array for empty input", () => {
    expect(flattenPoints([])).toEqual([]);
  });

  it("should handle single point", () => {
    const points: Point[] = [{ x: 42, y: 84 }];

    const flattened = flattenPoints(points);

    expect(flattened).toEqual([42, 84]);
  });
});
