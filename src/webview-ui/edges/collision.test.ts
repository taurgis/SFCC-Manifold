import { describe, it, expect } from "vitest";
import {
  lineIntersectsNode,
  buildNodeObstacles,
  segmentsToObstacles,
  computeRoutingBounds,
  isInsideObstacle,
  pointsToSegments,
  type ObstacleRect,
  type Segment,
} from "./collision";
import type { PlacedNode } from "../types";
import { LAYOUT_CONFIG } from "../constants";

const { nodeWidth, nodeHeight } = LAYOUT_CONFIG;

// Helper to create a mock placed node
function createNode(id: string, x: number, y: number): PlacedNode {
  return {
    id,
    label: `Node ${id}`,
    type: "pipelet",
    branch: "Start",
    attributes: {},
    x,
    y,
  };
}

describe("lineIntersectsNode", () => {
  it("should return null when nodeMap is empty", () => {
    const result = lineIntersectsNode(0, 0, 100, 100, {}, "n1", "n2");
    expect(result).toBeNull();
  });

  it("should return null when line does not intersect any node", () => {
    const nodeMap: Record<string, PlacedNode> = {
      n1: createNode("n1", 0, 0),
      n2: createNode("n2", 500, 500),
    };

    const result = lineIntersectsNode(200, 200, 250, 200, nodeMap, "n1", "n2");
    expect(result).toBeNull();
  });

  it("should detect horizontal line intersection", () => {
    const nodeMap: Record<string, PlacedNode> = {
      n1: createNode("n1", 0, 0),
      blocker: createNode("blocker", 100, 30),
      n2: createNode("n2", 300, 0),
    };

    const result = lineIntersectsNode(0, 50, 300, 50, nodeMap, "n1", "n2");
    expect(result).toBeDefined();
    expect(result!.id).toBe("blocker");
  });

  it("should detect vertical line intersection", () => {
    const nodeMap: Record<string, PlacedNode> = {
      n1: createNode("n1", 0, 0),
      blocker: createNode("blocker", 30, 100),
      n2: createNode("n2", 0, 300),
    };

    const result = lineIntersectsNode(50, 0, 50, 300, nodeMap, "n1", "n2");
    expect(result).toBeDefined();
    expect(result!.id).toBe("blocker");
  });

  it("should exclude source and target nodes from collision", () => {
    const nodeMap: Record<string, PlacedNode> = {
      n1: createNode("n1", 0, 0),
      n2: createNode("n2", 0, 100),
    };

    // Line goes directly through n2, but n2 is the target
    const result = lineIntersectsNode(
      50,
      0,
      50,
      200,
      nodeMap,
      "n1",
      "n2"
    );
    expect(result).toBeNull();
  });

  it("should return null for null nodeMap", () => {
    const result = lineIntersectsNode(0, 0, 100, 100, null as any, "n1", "n2");
    expect(result).toBeNull();
  });
});

describe("buildNodeObstacles", () => {
  it("should build obstacle rectangles from nodes", () => {
    const nodeMap: Record<string, PlacedNode> = {
      n1: createNode("n1", 100, 100),
      n2: createNode("n2", 300, 300),
    };

    const obstacles = buildNodeObstacles(nodeMap, "", "");

    expect(obstacles).toHaveLength(2);
    // Check first obstacle bounds
    expect(obstacles[0].left).toBeLessThan(100);
    expect(obstacles[0].right).toBeGreaterThan(100 + nodeWidth);
    expect(obstacles[0].top).toBeLessThan(100);
    expect(obstacles[0].bottom).toBeGreaterThan(100 + nodeHeight);
  });

  it("should exclude source and target nodes", () => {
    const nodeMap: Record<string, PlacedNode> = {
      n1: createNode("n1", 100, 100),
      n2: createNode("n2", 300, 300),
      n3: createNode("n3", 500, 500),
    };

    const obstacles = buildNodeObstacles(nodeMap, "n1", "n2");

    expect(obstacles).toHaveLength(1);
  });

  it("should return empty array for empty nodeMap", () => {
    const obstacles = buildNodeObstacles({}, "n1", "n2");
    expect(obstacles).toHaveLength(0);
  });
});

describe("segmentsToObstacles", () => {
  it("should convert segments to obstacle rectangles", () => {
    const segments: Segment[] = [
      { x1: 0, y1: 0, x2: 100, y2: 0 },
      { x1: 100, y1: 0, x2: 100, y2: 100 },
    ];

    const obstacles = segmentsToObstacles(segments);

    expect(obstacles).toHaveLength(2);
    // First segment (horizontal)
    expect(obstacles[0].left).toBeLessThan(0);
    expect(obstacles[0].right).toBeGreaterThan(100);
    // Second segment (vertical)
    expect(obstacles[1].top).toBeLessThan(0);
    expect(obstacles[1].bottom).toBeGreaterThan(100);
  });

  it("should return empty array for empty segments", () => {
    const obstacles = segmentsToObstacles([]);
    expect(obstacles).toHaveLength(0);
  });

  it("should handle reversed segment coordinates", () => {
    const segments: Segment[] = [{ x1: 100, y1: 100, x2: 0, y2: 0 }];

    const obstacles = segmentsToObstacles(segments);

    expect(obstacles[0].left).toBeLessThan(0);
    expect(obstacles[0].top).toBeLessThan(0);
    expect(obstacles[0].right).toBeGreaterThan(100);
    expect(obstacles[0].bottom).toBeGreaterThan(100);
  });
});

describe("computeRoutingBounds", () => {
  it("should compute bounds including start and end points", () => {
    const nodeMap: Record<string, PlacedNode> = {};
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 100 };

    const bounds = computeRoutingBounds(nodeMap, start, end);

    expect(bounds.minX).toBeLessThan(0);
    expect(bounds.minY).toBeLessThan(0);
    expect(bounds.maxX).toBeGreaterThan(100);
    expect(bounds.maxY).toBeGreaterThan(100);
  });

  it("should include all nodes in bounds", () => {
    const nodeMap: Record<string, PlacedNode> = {
      n1: createNode("n1", -100, -100),
      n2: createNode("n2", 500, 500),
    };
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 100 };

    const bounds = computeRoutingBounds(nodeMap, start, end);

    expect(bounds.minX).toBeLessThan(-100);
    expect(bounds.minY).toBeLessThan(-100);
    expect(bounds.maxX).toBeGreaterThan(500 + nodeWidth);
    expect(bounds.maxY).toBeGreaterThan(500 + nodeHeight);
  });

  it("should add routing margin", () => {
    const nodeMap: Record<string, PlacedNode> = {};
    const start = { x: 0, y: 0 };
    const end = { x: 0, y: 0 };

    const bounds = computeRoutingBounds(nodeMap, start, end);

    // Should have at least 200px margin (ROUTING_MARGIN)
    expect(bounds.minX).toBeLessThan(-100);
    expect(bounds.maxX).toBeGreaterThan(100);
  });
});

describe("isInsideObstacle", () => {
  it("should return true when point is inside an obstacle", () => {
    const obstacles: ObstacleRect[] = [
      { left: 0, right: 100, top: 0, bottom: 100 },
    ];

    expect(isInsideObstacle(50, 50, obstacles)).toBe(true);
    expect(isInsideObstacle(0, 0, obstacles)).toBe(true);
    expect(isInsideObstacle(100, 100, obstacles)).toBe(true);
  });

  it("should return false when point is outside all obstacles", () => {
    const obstacles: ObstacleRect[] = [
      { left: 0, right: 100, top: 0, bottom: 100 },
    ];

    expect(isInsideObstacle(-10, 50, obstacles)).toBe(false);
    expect(isInsideObstacle(110, 50, obstacles)).toBe(false);
    expect(isInsideObstacle(50, -10, obstacles)).toBe(false);
    expect(isInsideObstacle(50, 110, obstacles)).toBe(false);
  });

  it("should check all obstacles", () => {
    const obstacles: ObstacleRect[] = [
      { left: 0, right: 100, top: 0, bottom: 100 },
      { left: 200, right: 300, top: 200, bottom: 300 },
    ];

    expect(isInsideObstacle(50, 50, obstacles)).toBe(true);
    expect(isInsideObstacle(250, 250, obstacles)).toBe(true);
    expect(isInsideObstacle(150, 150, obstacles)).toBe(false);
  });

  it("should return false for empty obstacles array", () => {
    expect(isInsideObstacle(50, 50, [])).toBe(false);
  });
});

describe("pointsToSegments", () => {
  it("should convert points to segments", () => {
    const points = [0, 0, 100, 0, 100, 100, 200, 100];

    const segments = pointsToSegments(points);

    expect(segments).toHaveLength(3);
    expect(segments[0]).toEqual({ x1: 0, y1: 0, x2: 100, y2: 0 });
    expect(segments[1]).toEqual({ x1: 100, y1: 0, x2: 100, y2: 100 });
    expect(segments[2]).toEqual({ x1: 100, y1: 100, x2: 200, y2: 100 });
  });

  it("should return empty array for insufficient points", () => {
    expect(pointsToSegments([])).toHaveLength(0);
    expect(pointsToSegments([0, 0])).toHaveLength(0);
  });

  it("should handle minimum valid input", () => {
    const points = [0, 0, 100, 100];
    const segments = pointsToSegments(points);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual({ x1: 0, y1: 0, x2: 100, y2: 100 });
  });
});
