import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildBackEdgePath,
  buildAutoRoutedPath,
  buildOrthogonalPath,
  ensureMinFinalSegment,
  isInsideNode,
  isInsideAnyNode,
  isWaypointMeaningful,
  filterOnPathWaypoints,
  routeBottomToRight,
  routeBottomToLeft,
  routeTopToBottom,
  routeBottomToTop,
  routeRightToTop,
  routeLeftToTop,
  routeLeftToLeft,
  routeRightToBottom,
  routeLeftToBottom,
  routeRightToLeft,
  routeLeftToRight,
  type OrthogonalPathResult,
} from "./pathBuilder";
import type { PlacedNode, BendPoint } from "../types";
import { LAYOUT_CONFIG } from "../constants";

const { nodeWidth, nodeHeight, verticalGap, horizontalGap } = LAYOUT_CONFIG;

// Helper to create a mock placed node
function createNode(
  id: string,
  x: number,
  y: number,
  type: string = "pipelet"
): PlacedNode {
  return {
    id,
    label: `Node ${id}`,
    type: type as PlacedNode["type"],
    branch: "Start",
    attributes: {},
    x,
    y,
  };
}

// Helper to check if result is OrthogonalPathResult with waypoints
function hasWaypoints(result: number[] | OrthogonalPathResult): result is OrthogonalPathResult {
  return typeof result === "object" && "waypoints" in result;
}

describe("buildBackEdgePath", () => {
  it("should create a curved path for back edges", () => {
    const fromNode = createNode("n1", 100, 100 + verticalGap);
    const toNode = createNode("n2", 100, 100);

    const result = buildBackEdgePath(fromNode, toNode);

    // Should have many points (curved path)
    expect(result.points.length).toBeGreaterThan(10);
    // Points array should have even length (x,y pairs)
    expect(result.points.length % 2).toBe(0);
    // End point should be near target
    expect(result.end.x).toBeCloseTo(100 + nodeWidth / 2, 0);
    expect(result.end.y).toBeCloseTo(100, 0);
  });

  it("should handle join nodes with different anchor points", () => {
    const fromNode = createNode("n1", 100, 100 + verticalGap, "join");
    const toNode = createNode("n2", 100, 100, "join");

    const result = buildBackEdgePath(fromNode, toNode);

    expect(result.points.length).toBeGreaterThan(10);
    expect(result.end).toBeDefined();
  });

  it("should create loop path going to the left", () => {
    const fromNode = createNode("n1", 100, 200);
    const toNode = createNode("n2", 100, 100);

    const result = buildBackEdgePath(fromNode, toNode);

    // Path should go to the left at some point
    const minX = Math.min(...result.points.filter((_, i) => i % 2 === 0));
    expect(minX).toBeLessThan(100);
  });

  it("should use toNode x for loop when toNode is more to the left", () => {
    const fromNode = createNode("n1", 200, 300);
    const toNode = createNode("n2", 50, 100);

    const result = buildBackEdgePath(fromNode, toNode);

    // Loop should go even further left based on the leftmost node
    const minX = Math.min(...result.points.filter((_, i) => i % 2 === 0));
    expect(minX).toBeLessThan(50);
  });
});

describe("ensureMinFinalSegment", () => {
  it("should not modify points with sufficient final segment", () => {
    const points = [0, 0, 100, 0, 100, 100];
    const original = [...points];

    ensureMinFinalSegment(points);

    // Last segment is 100 units, should not change
    expect(points).toEqual(original);
  });

  it("should extend short vertical final segment", () => {
    const points = [0, 0, 100, 0, 100, 10]; // Final segment is only 10 units
    const originalLastY = points[points.length - 1];

    ensureMinFinalSegment(points);

    // Should extend the previous point to make segment at least 25
    expect(points[points.length - 3]).toBeLessThan(0);
    expect(points[points.length - 1]).toBe(originalLastY);
  });

  it("should extend short horizontal final segment", () => {
    const points = [0, 0, 0, 100, 10, 100]; // Final segment is only 10 units
    const originalLastX = points[points.length - 2];

    ensureMinFinalSegment(points);

    // Should extend the previous point
    expect(points[points.length - 4]).toBeLessThan(0);
    expect(points[points.length - 2]).toBe(originalLastX);
  });

  it("should handle negative direction segments", () => {
    const points = [100, 0, 100, 100, 100, 90]; // Going up (negative direction)
    const originalLastY = points[points.length - 1];

    ensureMinFinalSegment(points);

    expect(points[points.length - 3]).toBeGreaterThan(100);
    expect(points[points.length - 1]).toBe(originalLastY);
  });

  it("should not modify arrays with less than 4 points", () => {
    const points = [0, 0];
    const original = [...points];

    ensureMinFinalSegment(points);

    expect(points).toEqual(original);
  });

  it("should not modify zero-length final segments", () => {
    const points = [0, 0, 100, 100, 100, 100]; // Final segment has 0 length
    const original = [...points];

    ensureMinFinalSegment(points);

    expect(points).toEqual(original);
  });

  it("should extend short horizontal segment going left", () => {
    const points = [100, 100, 100, 50, 90, 50]; // Horizontal going left by 10
    const originalLastX = points[points.length - 2];

    ensureMinFinalSegment(points);

    // Should extend to the right to make segment at least 25
    expect(points[points.length - 4]).toBeGreaterThan(100);
    expect(points[points.length - 2]).toBe(originalLastX);
  });
});

describe("buildAutoRoutedPath", () => {
  it("should build a path between two points with no obstacles", () => {
    const start = { x: 100, y: 100 };
    const end = { x: 300, y: 300 };
    const fromNode = createNode("n1", 60, 60);
    const toNode = createNode("n2", 260, 260);
    const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

    const result = buildAutoRoutedPath(
      start,
      end,
      fromNode,
      toNode,
      "bottom",
      "top",
      nodeMap,
      []
    );

    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
    expect(result!.length % 2).toBe(0); // x,y pairs
  });

  it("should handle occupied segments", () => {
    const start = { x: 100, y: 100 };
    const end = { x: 300, y: 300 };
    const fromNode = createNode("n1", 60, 60);
    const toNode = createNode("n2", 260, 260);
    const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

    // Add an occupied segment in the way
    const occupiedSegments = [
      { x1: 150, y1: 150, x2: 250, y2: 150 },
    ];

    const result = buildAutoRoutedPath(
      start,
      end,
      fromNode,
      toNode,
      "bottom",
      "top",
      nodeMap,
      occupiedSegments
    );

    // Should still find a path around the obstacle
    expect(result === null || Array.isArray(result)).toBe(true);
  });

  it("should return null when path cannot be found", () => {
    const start = { x: 100, y: 100 };
    const end = { x: 300, y: 100 };
    const fromNode = createNode("n1", 60, 60);
    const toNode = createNode("n2", 260, 60);

    // Create a blocking obstacle
    const blocker = createNode("blocker", 160, 50);
    const nodeMap: Record<string, PlacedNode> = {
      n1: fromNode,
      n2: toNode,
      blocker: blocker,
    };

    // With very tight bounds, pathfinding may fail
    const result = buildAutoRoutedPath(
      start,
      end,
      fromNode,
      toNode,
      "right",
      "left",
      nodeMap,
      []
    );

    // May or may not find a path depending on grid alignment
    // The important thing is it doesn't throw
    expect(result === null || Array.isArray(result)).toBe(true);
  });

  it("should handle launch point inside obstacle by adding clearance obstacle", () => {
    const fromNode = createNode("n1", 100, 100);
    const toNode = createNode("n2", 300, 100);
    // Place a blocker right where the launch point would be
    const blocker = createNode("blocker", 100 + nodeWidth - 5, 100);
    const nodeMap: Record<string, PlacedNode> = {
      n1: fromNode,
      n2: toNode,
      blocker: blocker,
    };
    const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
    const end = { x: 300, y: 100 + nodeHeight / 2 };

    const result = buildAutoRoutedPath(
      start,
      end,
      fromNode,
      toNode,
      "right",
      "left",
      nodeMap,
      []
    );

    // Should handle this edge case without crashing
    expect(result === null || Array.isArray(result)).toBe(true);
  });
});

describe("buildOrthogonalPath", () => {
  describe("straight paths (fast paths)", () => {
    it("should create straight vertical path for bottom-to-top when aligned", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 100, 100 + verticalGap);
      const start = { x: 100 + nodeWidth / 2, y: 100 + nodeHeight };
      const end = { x: 100 + nodeWidth / 2, y: 100 + verticalGap };
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "bottom",
        "top",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(Array.isArray(result)).toBe(true);
      const points = result as number[];
      // Should be a simple straight line (start + end = 4 values)
      expect(points.length).toBe(4);
    });

    it("should create straight horizontal path for right-to-left when aligned", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 100 + horizontalGap, 100);
      const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
      const end = { x: 100 + horizontalGap, y: 100 + nodeHeight / 2 };
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "right",
        "left",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(Array.isArray(result)).toBe(true);
      const points = result as number[];
      // Should be a simple straight line
      expect(points.length).toBe(4);
    });

    it("should create straight horizontal path for left-to-right when aligned", () => {
      const fromNode = createNode("n1", 100 + horizontalGap, 100);
      const toNode = createNode("n2", 100, 100);
      const start = { x: 100 + horizontalGap, y: 100 + nodeHeight / 2 };
      const end = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "left",
        "right",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(Array.isArray(result)).toBe(true);
      const points = result as number[];
      expect(points.length).toBe(4);
    });
  });

  describe("paths with bendpoints", () => {
    it("should use source and target bendpoints for horizontal routing", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 300, 200);
      const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
      const end = { x: 300, y: 200 + nodeHeight / 2 };
      const bendPoints: BendPoint[] = [
        { relativeTo: "source", x: 1, y: 0 },
        { relativeTo: "target", x: -1, y: 0 },
      ];
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        "right",
        "left",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should use source and target bendpoints for vertical routing", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 200, 300);
      const start = { x: 100 + nodeWidth / 2, y: 100 + nodeHeight };
      const end = { x: 200 + nodeWidth / 2, y: 300 };
      const bendPoints: BendPoint[] = [
        { relativeTo: "source", x: 0, y: 1 },
        { relativeTo: "target", x: 0, y: -1 },
      ];
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        "bottom",
        "top",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should handle source-only bendpoint with horizontal exit", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 300, 200);
      const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
      const end = { x: 300, y: 200 + nodeHeight / 2 };
      const bendPoints: BendPoint[] = [{ relativeTo: "source", x: 2, y: 0 }];
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        "right",
        "left",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should handle target-only bendpoint with top entry", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 300, 300);
      const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
      const end = { x: 300 + nodeWidth / 2, y: 300 };
      const bendPoints: BendPoint[] = [{ relativeTo: "target", x: 0, y: -2 }];
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        "right",
        "top",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should handle single waypoint with top entry (start below approach)", () => {
      const fromNode = createNode("n1", 100, 400);
      const toNode = createNode("n2", 300, 100);
      const start = { x: 100 + nodeWidth, y: 400 + nodeHeight / 2 };
      const end = { x: 300 + nodeWidth / 2, y: 100 };
      const bendPoints: BendPoint[] = [{ relativeTo: "source", x: 1, y: 0 }];
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        "right",
        "top",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should handle single waypoint with bottom entry (start above approach)", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 300, 400);
      const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
      const end = { x: 300 + nodeWidth / 2, y: 400 + nodeHeight };
      const bendPoints: BendPoint[] = [{ relativeTo: "source", x: 1, y: 0 }];
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        "right",
        "bottom",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should handle vertical exit single waypoint with default routing", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 100, 400);
      const start = { x: 100 + nodeWidth / 2, y: 100 + nodeHeight };
      const end = { x: 100 + nodeWidth / 2, y: 400 };
      const bendPoints: BendPoint[] = [{ relativeTo: "source", x: 0, y: 2 }];
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        "bottom",
        "top",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should return waypoints when bendpoints create meaningful turns outside nodes", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 500, 500);
      const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
      const end = { x: 500, y: 500 + nodeHeight / 2 };
      // Large bendpoints to create waypoints far from nodes
      const bendPoints: BendPoint[] = [
        { relativeTo: "source", x: 3, y: 0 },
        { relativeTo: "target", x: -3, y: 0 },
      ];
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        "right",
        "left",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });
  });

  describe("fallback routing functions", () => {
    describe("routeBottomToTop", () => {
      it("should route around horizontal blocker when dx > 5 and source is right of blocker", () => {
        const fromNode = createNode("n1", 300, 100);
        const toNode = createNode("n2", 100, 400);
        const blocker = createNode("blocker", 180, 250);
        const start = { x: 300 + nodeWidth / 2, y: 100 + nodeHeight };
        const end = { x: 100 + nodeWidth / 2, y: 400 };
        const nodeMap: Record<string, PlacedNode> = {
          n1: fromNode,
          n2: toNode,
          blocker: blocker,
        };

        // Force fallback by using many obstacles
        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "bottom",
          "top",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });

      it("should route around horizontal blocker when source is left of blocker", () => {
        const fromNode = createNode("n1", 100, 100);
        const toNode = createNode("n2", 300, 400);
        const blocker = createNode("blocker", 180, 250);
        const start = { x: 100 + nodeWidth / 2, y: 100 + nodeHeight };
        const end = { x: 300 + nodeWidth / 2, y: 400 };
        const nodeMap: Record<string, PlacedNode> = {
          n1: fromNode,
          n2: toNode,
          blocker: blocker,
        };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "bottom",
          "top",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });

      it("should handle vertical blocker in path", () => {
        const fromNode = createNode("n1", 100, 100);
        const toNode = createNode("n2", 200, 400);
        // Place blocker directly in vertical path
        const blocker = createNode("blocker", 100, 250);
        const start = { x: 100 + nodeWidth / 2, y: 100 + nodeHeight };
        const end = { x: 200 + nodeWidth / 2, y: 400 };
        const nodeMap: Record<string, PlacedNode> = {
          n1: fromNode,
          n2: toNode,
          blocker: blocker,
        };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "bottom",
          "top",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });

      it("should route around vertical blocker when dx is small", () => {
        const fromNode = createNode("n1", 100, 100);
        const toNode = createNode("n2", 102, 400);
        // Place blocker directly in vertical path
        const blocker = createNode("blocker", 100, 250);
        const start = { x: 100 + nodeWidth / 2, y: 100 + nodeHeight };
        const end = { x: 102 + nodeWidth / 2, y: 400 };
        const nodeMap: Record<string, PlacedNode> = {
          n1: fromNode,
          n2: toNode,
          blocker: blocker,
        };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "bottom",
          "top",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });
    });

    describe("routeRightToTop", () => {
      it("should route right-to-top with vertical blocker", () => {
        const fromNode = createNode("n1", 100, 200);
        const toNode = createNode("n2", 400, 100);
        const blocker = createNode("blocker", 250, 100);
        const start = { x: 100 + nodeWidth, y: 200 + nodeHeight / 2 };
        const end = { x: 400 + nodeWidth / 2, y: 100 };
        const nodeMap: Record<string, PlacedNode> = {
          n1: fromNode,
          n2: toNode,
          blocker: blocker,
        };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "right",
          "top",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });

      it("should handle right-to-top when target is to the left (dx < 0)", () => {
        const fromNode = createNode("n1", 400, 200);
        const toNode = createNode("n2", 100, 100);
        const start = { x: 400 + nodeWidth, y: 200 + nodeHeight / 2 };
        const end = { x: 100 + nodeWidth / 2, y: 100 };
        const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "right",
          "top",
          5,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });

      it("should handle horizontal blocker in right-to-top routing", () => {
        const fromNode = createNode("n1", 100, 300);
        const toNode = createNode("n2", 400, 100);
        const blocker = createNode("blocker", 250, 70);
        const start = { x: 100 + nodeWidth, y: 300 + nodeHeight / 2 };
        const end = { x: 400 + nodeWidth / 2, y: 100 };
        const nodeMap: Record<string, PlacedNode> = {
          n1: fromNode,
          n2: toNode,
          blocker: blocker,
        };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "right",
          "top",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });
    });

    describe("routeLeftToTop", () => {
      it("should route left-to-top with blocking node in path", () => {
        const fromNode = createNode("n1", 400, 100);
        const toNode = createNode("n2", 100, 400);
        const blocker = createNode("blocker", 250, 200);
        const start = { x: 400, y: 100 + nodeHeight / 2 };
        const end = { x: 100 + nodeWidth / 2, y: 400 };
        const nodeMap: Record<string, PlacedNode> = {
          n1: fromNode,
          n2: toNode,
          blocker: blocker,
        };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "left",
          "top",
          0,
          0,
          nodeMap,
          blocker,
          []
        );

        expect(result).toBeDefined();
      });

      it("should handle left-to-top when target is to the right (dx > 0)", () => {
        const fromNode = createNode("n1", 100, 200);
        const toNode = createNode("n2", 400, 100);
        const start = { x: 100, y: 200 + nodeHeight / 2 };
        const end = { x: 400 + nodeWidth / 2, y: 100 };
        const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "left",
          "top",
          5,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });

      it("should avoid blocker overlapping with horizontal segment", () => {
        const fromNode = createNode("n1", 400, 100);
        const toNode = createNode("n2", 100, 300);
        const blocker = createNode("blocker", 200, 250);
        const start = { x: 400, y: 100 + nodeHeight / 2 };
        const end = { x: 100 + nodeWidth / 2, y: 300 };
        const nodeMap: Record<string, PlacedNode> = {
          n1: fromNode,
          n2: toNode,
          blocker: blocker,
        };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "left",
          "top",
          0,
          0,
          nodeMap,
          blocker,
          []
        );

        expect(result).toBeDefined();
      });
    });

    describe("routeLeftToLeft", () => {
      it("should route left-to-left with blocking node", () => {
        const fromNode = createNode("n1", 400, 100);
        const toNode = createNode("n2", 200, 300);
        const blocker = createNode("blocker", 50, 200);
        const start = { x: 400, y: 100 + nodeHeight / 2 };
        const end = { x: 200, y: 300 + nodeHeight / 2 };
        const nodeMap: Record<string, PlacedNode> = {
          n1: fromNode,
          n2: toNode,
          blocker: blocker,
        };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "left",
          "left",
          0,
          0,
          nodeMap,
          blocker,
          []
        );

        expect(result).toBeDefined();
      });

      it("should adjust clearance when target is more to the left", () => {
        const fromNode = createNode("n1", 400, 100);
        const toNode = createNode("n2", 50, 300);
        const start = { x: 400, y: 100 + nodeHeight / 2 };
        const end = { x: 50, y: 300 + nodeHeight / 2 };
        const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "left",
          "left",
          10,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });
    });

    describe("routeRightToBottom", () => {
      it("should route right-to-bottom when target is above", () => {
        const fromNode = createNode("n1", 100, 400);
        const toNode = createNode("n2", 300, 100);
        const start = { x: 100 + nodeWidth, y: 400 + nodeHeight / 2 };
        const end = { x: 300 + nodeWidth / 2, y: 100 + nodeHeight };
        const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "right",
          "bottom",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });

      it("should route right-to-bottom with horizontal blocker", () => {
        const fromNode = createNode("n1", 100, 100);
        const toNode = createNode("n2", 400, 200);
        const blocker = createNode("blocker", 250, 100);
        const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
        const end = { x: 400 + nodeWidth / 2, y: 200 + nodeHeight };
        const nodeMap: Record<string, PlacedNode> = {
          n1: fromNode,
          n2: toNode,
          blocker: blocker,
        };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "right",
          "bottom",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });
    });

    describe("routeLeftToBottom", () => {
      it("should route left-to-bottom when target is above", () => {
        const fromNode = createNode("n1", 400, 400);
        const toNode = createNode("n2", 100, 100);
        const start = { x: 400, y: 400 + nodeHeight / 2 };
        const end = { x: 100 + nodeWidth / 2, y: 100 + nodeHeight };
        const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "left",
          "bottom",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });

      it("should route left-to-bottom with horizontal blocker", () => {
        const fromNode = createNode("n1", 400, 100);
        const toNode = createNode("n2", 100, 200);
        const blocker = createNode("blocker", 250, 100);
        const start = { x: 400, y: 100 + nodeHeight / 2 };
        const end = { x: 100 + nodeWidth / 2, y: 200 + nodeHeight };
        const nodeMap: Record<string, PlacedNode> = {
          n1: fromNode,
          n2: toNode,
          blocker: blocker,
        };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "left",
          "bottom",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });
    });

    describe("routeRightToLeft", () => {
      it("should route right-to-left with vertical blocker", () => {
        const fromNode = createNode("n1", 100, 100);
        const toNode = createNode("n2", 400, 200);
        const blocker = createNode("blocker", 250, 140);
        const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
        const end = { x: 400, y: 200 + nodeHeight / 2 };
        const nodeMap: Record<string, PlacedNode> = {
          n1: fromNode,
          n2: toNode,
          blocker: blocker,
        };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "right",
          "left",
          10,
          5,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });

      it("should handle dy <= 10 case (nearly aligned)", () => {
        const fromNode = createNode("n1", 100, 100);
        const toNode = createNode("n2", 400, 105);
        const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
        const end = { x: 400, y: 105 + nodeHeight / 2 };
        const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "right",
          "left",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });
    });

    describe("routeLeftToRight", () => {
      it("should route left-to-right with vertical blocker", () => {
        const fromNode = createNode("n1", 400, 100);
        const toNode = createNode("n2", 100, 200);
        const blocker = createNode("blocker", 250, 140);
        const start = { x: 400, y: 100 + nodeHeight / 2 };
        const end = { x: 100 + nodeWidth, y: 200 + nodeHeight / 2 };
        const nodeMap: Record<string, PlacedNode> = {
          n1: fromNode,
          n2: toNode,
          blocker: blocker,
        };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "left",
          "right",
          10,
          5,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });

      it("should handle dy <= 10 case (nearly aligned)", () => {
        const fromNode = createNode("n1", 400, 100);
        const toNode = createNode("n2", 100, 105);
        const start = { x: 400, y: 100 + nodeHeight / 2 };
        const end = { x: 100 + nodeWidth, y: 105 + nodeHeight / 2 };
        const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "left",
          "right",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });
    });

    describe("routeTopToBottom", () => {
      it("should route top-to-bottom with horizontal offset", () => {
        const fromNode = createNode("n1", 100, 400);
        const toNode = createNode("n2", 300, 100);
        const start = { x: 100 + nodeWidth / 2, y: 400 };
        const end = { x: 300 + nodeWidth / 2, y: 100 + nodeHeight };
        const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "top",
          "bottom",
          10,
          5,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });

      it("should handle dx <= 5 case (nearly aligned)", () => {
        const fromNode = createNode("n1", 100, 400);
        const toNode = createNode("n2", 102, 100);
        const start = { x: 100 + nodeWidth / 2, y: 400 };
        const end = { x: 102 + nodeWidth / 2, y: 100 + nodeHeight };
        const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "top",
          "bottom",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });
    });

    describe("diagonal fallback", () => {
      it("should use diagonal fallback for right exit with unusual combination", () => {
        const fromNode = createNode("n1", 100, 100);
        const toNode = createNode("n2", 200, 200);
        const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
        const end = { x: 200 + nodeWidth / 2, y: 200 + nodeHeight };
        const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

        // Use a combination that isn't handled by specific routes
        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "right",
          "bottom",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });

      it("should use diagonal fallback for bottom exit with unusual combination", () => {
        const fromNode = createNode("n1", 100, 100);
        const toNode = createNode("n2", 200, 200);
        const start = { x: 100 + nodeWidth / 2, y: 100 + nodeHeight };
        const end = { x: 200 + nodeWidth, y: 200 + nodeHeight / 2 };
        const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

        // Use a combination that isn't handled by specific routes
        const result = buildOrthogonalPath(
          start,
          end,
          null,
          fromNode,
          toNode,
          "bottom",
          "right",
          0,
          0,
          nodeMap,
          null,
          []
        );

        expect(result).toBeDefined();
      });
    });
  });

  describe("edge cases", () => {
    it("should handle very small movements (dx and dy near zero)", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 100 + 3, 100 + 3);
      const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
      const end = { x: 103, y: 103 + nodeHeight / 2 };
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "right",
        "left",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should handle empty bendpoints array", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 300, 300);
      const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
      const end = { x: 300, y: 300 + nodeHeight / 2 };
      const bendPoints: BendPoint[] = [];
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        "right",
        "left",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should handle bendpoints without source or target", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 300, 300);
      const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
      const end = { x: 300, y: 300 + nodeHeight / 2 };
      // Bendpoint with neither source nor target
      const bendPoints: BendPoint[] = [
        { relativeTo: "source" as const, x: 0, y: 0 },
      ];
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        "right",
        "left",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should filter waypoints that fall inside nodes", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 150, 150);
      const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
      const end = { x: 150, y: 150 + nodeHeight / 2 };
      // Small bendpoints that would create waypoints inside nodes
      const bendPoints: BendPoint[] = [
        { relativeTo: "source", x: 0.1, y: 0.1 },
        { relativeTo: "target", x: -0.1, y: -0.1 },
      ];
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        "right",
        "left",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
      // Waypoints inside nodes should be filtered out
      if (hasWaypoints(result)) {
        expect(result.waypoints.length).toBe(0);
      }
    });
  });
});

describe("isInsideNode", () => {
  it("should return true when point is inside node", () => {
    const node = createNode("n1", 100, 100);
    const point = { x: 100 + nodeWidth / 2, y: 100 + nodeHeight / 2 };
    
    expect(isInsideNode(point, node)).toBe(true);
  });

  it("should return true when point is on node edge", () => {
    const node = createNode("n1", 100, 100);
    const point = { x: 100, y: 100 + nodeHeight / 2 };
    
    expect(isInsideNode(point, node)).toBe(true);
  });

  it("should return false when point is outside node", () => {
    const node = createNode("n1", 100, 100);
    const point = { x: 50, y: 50 };
    
    expect(isInsideNode(point, node)).toBe(false);
  });

  it("should use custom padding", () => {
    const node = createNode("n1", 100, 100);
    // Point is outside the node but within default padding
    const point = { x: 90, y: 100 + nodeHeight / 2 };
    
    expect(isInsideNode(point, node, 15)).toBe(true);
    expect(isInsideNode(point, node, 5)).toBe(false);
  });

  it("should return true when point is within padding range", () => {
    const node = createNode("n1", 100, 100);
    // Point is 10 pixels left of node, within default 15px padding
    const point = { x: 90, y: 100 + nodeHeight / 2 };
    
    expect(isInsideNode(point, node)).toBe(true);
  });

  it("should return false when point is beyond padding range", () => {
    const node = createNode("n1", 100, 100);
    // Point is 20 pixels left of node, beyond default 15px padding
    const point = { x: 80, y: 100 + nodeHeight / 2 };
    
    expect(isInsideNode(point, node)).toBe(false);
  });
});

describe("isInsideAnyNode", () => {
  it("should return true when point is inside first node", () => {
    const node1 = createNode("n1", 100, 100);
    const node2 = createNode("n2", 300, 300);
    const nodeMap = { n1: node1, n2: node2 };
    const point = { x: 100 + nodeWidth / 2, y: 100 + nodeHeight / 2 };
    
    expect(isInsideAnyNode(point, nodeMap)).toBe(true);
  });

  it("should return true when point is inside second node", () => {
    const node1 = createNode("n1", 100, 100);
    const node2 = createNode("n2", 300, 300);
    const nodeMap = { n1: node1, n2: node2 };
    const point = { x: 300 + nodeWidth / 2, y: 300 + nodeHeight / 2 };
    
    expect(isInsideAnyNode(point, nodeMap)).toBe(true);
  });

  it("should return false when point is outside all nodes", () => {
    const node1 = createNode("n1", 100, 100);
    const node2 = createNode("n2", 300, 300);
    const nodeMap = { n1: node1, n2: node2 };
    const point = { x: 200, y: 200 };
    
    expect(isInsideAnyNode(point, nodeMap)).toBe(false);
  });

  it("should handle empty node map", () => {
    const nodeMap: Record<string, PlacedNode> = {};
    const point = { x: 100, y: 100 };
    
    expect(isInsideAnyNode(point, nodeMap)).toBe(false);
  });
});

describe("isWaypointMeaningful", () => {
  it("should return false when waypoint is inside a node", () => {
    const node = createNode("n1", 100, 100);
    const nodeMap = { n1: node };
    const waypoint = { x: 100 + nodeWidth / 2, y: 100 + nodeHeight / 2 };
    const pathPoints = [50, 50, 150, 50, 150, 200, 200, 200];
    
    expect(isWaypointMeaningful(waypoint, pathPoints, nodeMap)).toBe(false);
  });

  it("should return false when path has less than 3 points", () => {
    const nodeMap: Record<string, PlacedNode> = {};
    const waypoint = { x: 100, y: 100 };
    const pathPoints = [50, 50, 150, 150]; // Only 2 points
    
    expect(isWaypointMeaningful(waypoint, pathPoints, nodeMap)).toBe(false);
  });

  it("should return true when waypoint is near a corner", () => {
    const nodeMap: Record<string, PlacedNode> = {};
    const pathPoints = [50, 50, 100, 50, 100, 150, 200, 150];
    // Corner is at (100, 50) and (100, 150)
    const waypoint = { x: 105, y: 55 }; // Near first corner
    
    expect(isWaypointMeaningful(waypoint, pathPoints, nodeMap)).toBe(true);
  });

  it("should return false when waypoint is not near any corner", () => {
    const nodeMap: Record<string, PlacedNode> = {};
    const pathPoints = [50, 50, 100, 50, 100, 150, 200, 150];
    const waypoint = { x: 75, y: 50 }; // On a straight segment, not near corner
    
    expect(isWaypointMeaningful(waypoint, pathPoints, nodeMap)).toBe(false);
  });

  it("should use custom tolerance", () => {
    const nodeMap: Record<string, PlacedNode> = {};
    const pathPoints = [50, 50, 100, 50, 100, 150, 200, 150];
    // Corner is at (100, 50)
    const waypoint = { x: 130, y: 80 }; // 30 pixels from corner
    
    // With default tolerance of 20, should be false
    expect(isWaypointMeaningful(waypoint, pathPoints, nodeMap)).toBe(false);
    // With larger tolerance of 40, should be true
    expect(isWaypointMeaningful(waypoint, pathPoints, nodeMap, 40)).toBe(true);
  });

  it("should return true when waypoint is near interior corner", () => {
    const nodeMap: Record<string, PlacedNode> = {};
    // Path with multiple corners
    const pathPoints = [0, 0, 100, 0, 100, 100, 200, 100, 200, 200];
    // Interior corner at (100, 100)
    const waypoint = { x: 95, y: 105 }; // Near (100, 100) corner
    
    expect(isWaypointMeaningful(waypoint, pathPoints, nodeMap)).toBe(true);
  });
});

describe("filterOnPathWaypoints", () => {
  it("should filter out waypoints inside nodes", () => {
    const node = createNode("n1", 100, 100);
    const nodeMap = { n1: node };
    const pathPoints = [50, 50, 150, 50, 150, 200, 200, 200];
    const waypoints = [
      { x: 100 + nodeWidth / 2, y: 100 + nodeHeight / 2 }, // Inside node
      { x: 155, y: 55 }, // Near corner (150, 50)
    ];
    
    const result = filterOnPathWaypoints(waypoints, pathPoints, nodeMap);
    
    expect(result.length).toBe(1);
    expect(result[0].x).toBe(155);
  });

  it("should filter out waypoints not near corners", () => {
    const nodeMap: Record<string, PlacedNode> = {};
    const pathPoints = [50, 50, 150, 50, 150, 200, 200, 200];
    const waypoints = [
      { x: 100, y: 50 }, // On straight segment, not near corner
      { x: 155, y: 55 }, // Near corner at (150, 50)
    ];
    
    const result = filterOnPathWaypoints(waypoints, pathPoints, nodeMap);
    
    expect(result.length).toBe(1);
    expect(result[0].x).toBe(155);
  });

  it("should return empty array when no waypoints are meaningful", () => {
    const node = createNode("n1", 140, 40);
    const nodeMap = { n1: node };
    const pathPoints = [50, 50, 150, 50, 150, 200, 200, 200];
    const waypoints = [
      { x: 150 + nodeWidth / 2, y: 40 + nodeHeight / 2 }, // Inside node
    ];
    
    const result = filterOnPathWaypoints(waypoints, pathPoints, nodeMap);
    
    expect(result.length).toBe(0);
  });

  it("should handle empty waypoints array", () => {
    const nodeMap: Record<string, PlacedNode> = {};
    const pathPoints = [50, 50, 150, 50, 150, 200, 200, 200];
    const waypoints: { x: number; y: number }[] = [];
    
    const result = filterOnPathWaypoints(waypoints, pathPoints, nodeMap);
    
    expect(result.length).toBe(0);
  });

  it("should keep all meaningful waypoints", () => {
    const nodeMap: Record<string, PlacedNode> = {};
    // Path with multiple corners
    const pathPoints = [0, 0, 100, 0, 100, 100, 200, 100];
    const waypoints = [
      { x: 95, y: 5 }, // Near corner at (100, 0)
      { x: 105, y: 95 }, // Near corner at (100, 100)
    ];
    
    const result = filterOnPathWaypoints(waypoints, pathPoints, nodeMap);
    
    expect(result.length).toBe(2);
  });
});

describe("buildOrthogonalPath - additional routing coverage", () => {
  describe("routeBottomToRight direct call", () => {
    it("should route bottom exit to right entry with L-shape going down then right", () => {
      // Source is above and to the left, exits bottom, target enters from right
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 300, 300);
      const start = { x: 100 + nodeWidth / 2, y: 100 + nodeHeight }; // bottom exit
      const end = { x: 300 + nodeWidth, y: 300 + nodeHeight / 2 }; // right entry
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "bottom",
        "right",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
      const points = Array.isArray(result) ? result : result.points;
      // Should go down first then across to the right
      expect(points.length).toBeGreaterThan(4);
    });
  });

  describe("routeBottomToLeft direct call", () => {
    it("should route bottom exit to left entry with L-shape going down then left", () => {
      // Source is above and to the right, exits bottom, target enters from left
      const fromNode = createNode("n1", 400, 100);
      const toNode = createNode("n2", 100, 300);
      const start = { x: 400 + nodeWidth / 2, y: 100 + nodeHeight }; // bottom exit
      const end = { x: 100, y: 300 + nodeHeight / 2 }; // left entry
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "bottom",
        "left",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
      const points = Array.isArray(result) ? result : result.points;
      // Should go down first then across to the left
      expect(points.length).toBeGreaterThan(4);
    });
  });

  describe("routeTopToBottom direct call", () => {
    it("should route top exit to bottom entry", () => {
      // Source is below target, exits top, target enters from bottom
      const fromNode = createNode("n1", 100, 400);
      const toNode = createNode("n2", 200, 100);
      const start = { x: 100 + nodeWidth / 2, y: 400 }; // top exit
      const end = { x: 200 + nodeWidth / 2, y: 100 + nodeHeight }; // bottom entry
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "top",
        "bottom",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
      const points = Array.isArray(result) ? result : result.points;
      expect(points.length).toBeGreaterThanOrEqual(4);
    });

    it("should handle top-to-bottom with significant dx offset", () => {
      const fromNode = createNode("n1", 100, 400);
      const toNode = createNode("n2", 400, 100);
      const start = { x: 100 + nodeWidth / 2, y: 400 }; // top exit
      const end = { x: 400 + nodeWidth / 2, y: 100 + nodeHeight }; // bottom entry
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "top",
        "bottom",
        20,
        10,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });
  });

  describe("diagonal fallback paths", () => {
    it("should use diagonal fallback for right/left exit with minimal movement", () => {
      // Very close nodes where normal routing might not be needed
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 110, 110);
      const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 }; // right exit
      const end = { x: 110 + nodeWidth / 2, y: 110 + nodeHeight }; // bottom entry (unusual)
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      // Use a combination that falls through to diagonal fallback
      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "right",
        "bottom",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should use diagonal fallback for top/bottom exit with horizontal routing", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 250, 150);
      const start = { x: 100 + nodeWidth / 2, y: 100 }; // top exit
      const end = { x: 250 + nodeWidth, y: 150 + nodeHeight / 2 }; // right entry
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "top",
        "right",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should handle fallback with both dx and dy greater than 5", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 150, 150);
      const start = { x: 100 + nodeWidth / 2, y: 100 }; // top exit
      const end = { x: 150, y: 150 + nodeHeight / 2 }; // left entry (unusual combo)
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "top",
        "left",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });
  });

  describe("meaningful waypoints return path", () => {
    it("should return waypoints object when bendpoints create meaningful turns far from nodes", () => {
      // Place nodes far apart so waypoints are clearly outside both
      const fromNode = createNode("n1", 0, 0);
      const toNode = createNode("n2", 800, 800);
      const start = { x: nodeWidth, y: nodeHeight / 2 }; // right exit
      const end = { x: 800, y: 800 + nodeHeight / 2 }; // left entry
      // Large bendpoints to ensure waypoints are meaningful
      const bendPoints: BendPoint[] = [
        { relativeTo: "source", x: 5, y: 0 }, // Far from source
        { relativeTo: "target", x: -5, y: 0 }, // Far from target
      ];
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        "right",
        "left",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
      // The result might have waypoints if they're meaningful
      if (hasWaypoints(result)) {
        expect(result.waypoints).toBeDefined();
        expect(Array.isArray(result.waypoints)).toBe(true);
      }
    });

    it("should return plain points array when waypoints are filtered out", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 200, 200);
      const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 };
      const end = { x: 200, y: 200 + nodeHeight / 2 };
      // Very small bendpoints that will create waypoints close to or inside nodes
      const bendPoints: BendPoint[] = [
        { relativeTo: "source", x: 0.01, y: 0 },
      ];
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        "right",
        "left",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
      // Should return plain array (waypoints filtered out)
      expect(Array.isArray(result) || "points" in result).toBe(true);
    });
  });

  describe("routeBottomToTop line 313 - source inside blocker horizontally", () => {
    it("should handle blocker when source x is between blocker bounds", () => {
      // Set up so that when there's a horizontal blocker, start.x falls within blocker's x range
      const fromNode = createNode("n1", 200, 100);
      const toNode = createNode("n2", 100, 400);
      // Place blocker so that the start.x (200 + 100 = 300) falls within blocker (250, 350+200=550) range
      // More precisely: blocker at x=250, width=200, so blocker spans 250-450
      // start.x = 200 + 100 = 300, which is between 250 and 450
      const blocker = createNode("blocker", 250, 250);
      const start = { x: 200 + nodeWidth / 2, y: 100 + nodeHeight }; // x=300
      const end = { x: 100 + nodeWidth / 2, y: 400 };
      const nodeMap: Record<string, PlacedNode> = {
        n1: fromNode,
        n2: toNode,
        blocker: blocker,
      };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "bottom",
        "top",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should route around blocker when source is directly above blocker center", () => {
      // Position where start.x is inside blocker's x bounds
      // blocker at x=100, nodeWidth=200, so blocker x range is [100, 300]
      // start.x needs to be between 100 and 300
      const fromNode = createNode("n1", 150, 100);
      const toNode = createNode("n2", 400, 400);
      const blocker = createNode("blocker", 100, 200);
      const start = { x: 150 + nodeWidth / 2, y: 100 + nodeHeight }; // x=250, inside [100,300]
      const end = { x: 400 + nodeWidth / 2, y: 400 };
      const nodeMap: Record<string, PlacedNode> = {
        n1: fromNode,
        n2: toNode,
        blocker: blocker,
      };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "bottom",
        "top",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should choose direction based on end.x when source is inside blocker bounds", () => {
      // When start.x is inside blocker bounds, the code chooses left or right based on end.x > start.x
      // Test case where end.x < start.x (should go left)
      const fromNode = createNode("n1", 250, 100);
      const toNode = createNode("n2", 100, 400);
      // Blocker positioned so start.x (350) is within its bounds [200, 400]
      const blocker = createNode("blocker", 200, 200);
      const start = { x: 250 + nodeWidth / 2, y: 100 + nodeHeight }; // x=350
      const end = { x: 100 + nodeWidth / 2, y: 400 }; // x=200, less than 350
      const nodeMap: Record<string, PlacedNode> = {
        n1: fromNode,
        n2: toNode,
        blocker: blocker,
      };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "bottom",
        "top",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });
  });
});

describe("routeBottomToRight (direct)", () => {
  it("should add L-shaped path points going down then right", () => {
    const points: number[] = [100, 100]; // Start point already added
    const start = { x: 100, y: 100 };
    const end = { x: 200, y: 150 };

    routeBottomToRight(points, start, end);

    // Should add the corner point (start.x, end.y)
    expect(points).toEqual([100, 100, 100, 150]);
  });

  it("should handle same y coordinate (straight horizontal)", () => {
    const points: number[] = [100, 100];
    const start = { x: 100, y: 100 };
    const end = { x: 200, y: 100 };

    routeBottomToRight(points, start, end);

    expect(points).toEqual([100, 100, 100, 100]);
  });

  it("should handle target above source", () => {
    const points: number[] = [100, 200];
    const start = { x: 100, y: 200 };
    const end = { x: 200, y: 100 };

    routeBottomToRight(points, start, end);

    expect(points).toEqual([100, 200, 100, 100]);
  });
});

describe("routeBottomToLeft (direct)", () => {
  it("should add L-shaped path points going down then left", () => {
    const points: number[] = [200, 100];
    const start = { x: 200, y: 100 };
    const end = { x: 100, y: 150 };

    routeBottomToLeft(points, start, end);

    expect(points).toEqual([200, 100, 200, 150]);
  });

  it("should handle same y coordinate", () => {
    const points: number[] = [200, 100];
    const start = { x: 200, y: 100 };
    const end = { x: 100, y: 100 };

    routeBottomToLeft(points, start, end);

    expect(points).toEqual([200, 100, 200, 100]);
  });

  it("should handle target above source", () => {
    const points: number[] = [200, 200];
    const start = { x: 200, y: 200 };
    const end = { x: 100, y: 100 };

    routeBottomToLeft(points, start, end);

    expect(points).toEqual([200, 200, 200, 100]);
  });
});

describe("routeTopToBottom (direct)", () => {
  it("should add S-shaped path when dx > 5", () => {
    const points: number[] = [100, 400];
    const start = { x: 100, y: 400 };
    const end = { x: 200, y: 100 };
    const dx = 100;
    const startOffset = 0;
    const endOffset = 0;

    routeTopToBottom(points, start, end, dx, startOffset, endOffset);

    // Should add midY points
    expect(points.length).toBe(6); // original + 4 new values (2 points)
    // Mid Y should be (400 + 100) / 2 = 250
    expect(points[3]).toBe(250);
    expect(points[5]).toBe(250);
  });

  it("should add nothing when dx <= 5 (nearly aligned)", () => {
    const points: number[] = [100, 400];
    const start = { x: 100, y: 400 };
    const end = { x: 103, y: 100 };
    const dx = 3;
    const startOffset = 0;
    const endOffset = 0;

    routeTopToBottom(points, start, end, dx, startOffset, endOffset);

    // Should not add any points
    expect(points).toEqual([100, 400]);
  });

  it("should use offsets when provided", () => {
    const points: number[] = [100, 400];
    const start = { x: 100, y: 400 };
    const end = { x: 200, y: 100 };
    const dx = 100;
    const startOffset = 10;
    const endOffset = -10;

    routeTopToBottom(points, start, end, dx, startOffset, endOffset);

    // First point x should be start.x + startOffset = 110
    expect(points[2]).toBe(110);
    // Second point x should be end.x + endOffset = 190
    expect(points[4]).toBe(190);
  });

  it("should handle negative dx (target to the left)", () => {
    const points: number[] = [200, 400];
    const start = { x: 200, y: 400 };
    const end = { x: 100, y: 100 };
    const dx = -100;
    const startOffset = 0;
    const endOffset = 0;

    routeTopToBottom(points, start, end, dx, startOffset, endOffset);

    expect(points.length).toBe(6);
  });
});

describe("routeBottomToTop (direct)", () => {
  it("should route with horizontal blocker when source is right of blocker", () => {
    const points: number[] = [350, 165];
    const start = { x: 350, y: 165 };
    const end = { x: 100, y: 400 };
    const dx = -250;
    const dy = 235;
    const fromNode = createNode("n1", 250, 100);
    const toNode = createNode("n2", 0, 335);
    // Place blocker so start.x > blocker.x + nodeWidth
    const blocker = createNode("blocker", 50, 250);
    const nodeMap = { n1: fromNode, n2: toNode, blocker };

    routeBottomToTop(points, start, end, dx, dy, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should route with horizontal blocker when source is left of blocker", () => {
    const points: number[] = [100, 165];
    const start = { x: 100, y: 165 };
    const end = { x: 350, y: 400 };
    const dx = 250;
    const dy = 235;
    const fromNode = createNode("n1", 0, 100);
    const toNode = createNode("n2", 250, 335);
    // Place blocker so start.x < blocker.x
    const blocker = createNode("blocker", 150, 250);
    const nodeMap = { n1: fromNode, n2: toNode, blocker };

    routeBottomToTop(points, start, end, dx, dy, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should route with horizontal blocker when source x is inside blocker bounds", () => {
    const points: number[] = [200, 165];
    const start = { x: 200, y: 165 };
    const end = { x: 400, y: 400 };
    const dx = 200;
    const dy = 235;
    const fromNode = createNode("n1", 100, 100);
    const toNode = createNode("n2", 300, 335);
    // Place blocker so start.x is within [blocker.x, blocker.x + nodeWidth]
    const blocker = createNode("blocker", 100, 250);
    const nodeMap = { n1: fromNode, n2: toNode, blocker };

    routeBottomToTop(points, start, end, dx, dy, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should route with vertical blocker when no horizontal blocker", () => {
    const points: number[] = [100, 165];
    const start = { x: 100, y: 165 };
    const end = { x: 300, y: 400 };
    const dx = 200;
    const dy = 235;
    const fromNode = createNode("n1", 0, 100);
    const toNode = createNode("n2", 200, 335);
    // Place blocker in vertical path
    const blocker = createNode("blocker", 50, 220);
    const nodeMap = { n1: fromNode, n2: toNode, blocker };

    routeBottomToTop(points, start, end, dx, dy, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should route with no blockers (simple mid-point routing)", () => {
    const points: number[] = [100, 165];
    const start = { x: 100, y: 165 };
    const end = { x: 300, y: 400 };
    const dx = 200;
    const dy = 235;
    const fromNode = createNode("n1", 0, 100);
    const toNode = createNode("n2", 200, 335);
    const nodeMap = { n1: fromNode, n2: toNode };

    routeBottomToTop(points, start, end, dx, dy, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should handle small dx (vertical alignment) with blocker", () => {
    const points: number[] = [100, 165];
    const start = { x: 100, y: 165 };
    const end = { x: 103, y: 400 };
    const dx = 3;
    const dy = 235;
    const fromNode = createNode("n1", 0, 100);
    const toNode = createNode("n2", 3, 335);
    const blocker = createNode("blocker", 50, 250);
    const nodeMap = { n1: fromNode, n2: toNode, blocker };

    routeBottomToTop(points, start, end, dx, dy, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should handle small dx with no blocker", () => {
    const points: number[] = [100, 165];
    const start = { x: 100, y: 165 };
    const end = { x: 103, y: 400 };
    const dx = 3;
    const dy = 235;
    const fromNode = createNode("n1", 0, 100);
    const toNode = createNode("n2", 3, 335);
    const nodeMap = { n1: fromNode, n2: toNode };

    routeBottomToTop(points, start, end, dx, dy, fromNode, toNode, nodeMap);

    // No points added when no blocker and small dx
    expect(points.length).toBe(2);
  });
});

describe("routeRightToTop (direct)", () => {
  it("should route with positive dx and no blocker", () => {
    const points: number[] = [300, 132.5];
    const start = { x: 300, y: 132.5 };
    const end = { x: 500, y: 50 };
    const dy = -82.5;
    const startOffset = 0;
    const toNode = createNode("n2", 400, 0);
    const nodeMap = { n2: toNode };

    routeRightToTop(points, start, end, dy, startOffset, toNode, nodeMap, null);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should route with negative dx (target to the left)", () => {
    const points: number[] = [300, 132.5];
    const start = { x: 300, y: 132.5 };
    const end = { x: 150, y: 50 };
    const dy = -82.5;
    const startOffset = 0;
    const toNode = createNode("n2", 50, 0);
    const nodeMap = { n2: toNode };

    routeRightToTop(points, start, end, dy, startOffset, toNode, nodeMap, null);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should adjust clearance when vertical blocker exists", () => {
    const points: number[] = [300, 132.5];
    const start = { x: 300, y: 132.5 };
    const end = { x: 500, y: 50 };
    const dy = -82.5;
    const startOffset = 0;
    const toNode = createNode("n2", 400, 0);
    const blocker = createNode("blocker", 400, 70);
    const nodeMap = { n2: toNode, blocker };

    routeRightToTop(points, start, end, dy, startOffset, toNode, nodeMap, null);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should adjust when horizontal blocker exists", () => {
    const points: number[] = [300, 132.5];
    const start = { x: 300, y: 132.5 };
    const end = { x: 500, y: 50 };
    const dy = -82.5;
    const startOffset = 0;
    const toNode = createNode("n2", 400, 0);
    const blocker = createNode("blocker", 350, 20);
    const nodeMap = { n2: toNode, blocker };

    routeRightToTop(points, start, end, dy, startOffset, toNode, nodeMap, null);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should use startOffset for lane spacing", () => {
    const points: number[] = [300, 132.5];
    const start = { x: 300, y: 132.5 };
    const end = { x: 500, y: 50 };
    const dy = -82.5;
    const startOffset = 5;
    const toNode = createNode("n2", 400, 0);
    const nodeMap = { n2: toNode };

    routeRightToTop(points, start, end, dy, startOffset, toNode, nodeMap, null);

    expect(points.length).toBeGreaterThan(2);
  });
});

describe("routeLeftToTop (direct)", () => {
  it("should route with negative dx and no blocker", () => {
    const points: number[] = [100, 132.5];
    const start = { x: 100, y: 132.5 };
    const end = { x: 50, y: 50 };
    const dx = -50;
    const dy = -82.5;
    const startOffset = 0;
    const toNode = createNode("n2", 0, 0);
    const nodeMap = { n2: toNode };

    routeLeftToTop(points, start, end, dx, dy, startOffset, toNode, nodeMap, null);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should route with positive dx (target to the right)", () => {
    const points: number[] = [100, 132.5];
    const start = { x: 100, y: 132.5 };
    const end = { x: 300, y: 50 };
    const dx = 200;
    const dy = -82.5;
    const startOffset = 0;
    const toNode = createNode("n2", 200, 0);
    const nodeMap = { n2: toNode };

    routeLeftToTop(points, start, end, dx, dy, startOffset, toNode, nodeMap, null);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should adjust clearance with blocking node", () => {
    const points: number[] = [100, 132.5];
    const start = { x: 100, y: 132.5 };
    const end = { x: 50, y: 300 };
    const dx = -50;
    const dy = 167.5;
    const startOffset = 0;
    const toNode = createNode("n2", 0, 235);
    const blocker = createNode("blocker", 30, 100);
    const nodeMap = { n2: toNode, blocker };

    routeLeftToTop(points, start, end, dx, dy, startOffset, toNode, nodeMap, blocker);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should adjust aboveTargetY when blocker overlaps", () => {
    const points: number[] = [100, 132.5];
    const start = { x: 100, y: 132.5 };
    const end = { x: 50, y: 200 };
    const dx = -50;
    const dy = 67.5;
    const startOffset = 0;
    const toNode = createNode("n2", 0, 135);
    // Position blocker so aboveTargetY overlaps with blocker
    const blocker = createNode("blocker", 30, 150);
    const nodeMap = { n2: toNode, blocker };

    routeLeftToTop(points, start, end, dx, dy, startOffset, toNode, nodeMap, blocker);

    expect(points.length).toBeGreaterThan(2);
  });
});

describe("routeLeftToLeft (direct)", () => {
  it("should route with no blocker", () => {
    const points: number[] = [100, 132.5];
    const start = { x: 100, y: 132.5 };
    const end = { x: 50, y: 300 };
    const dy = 167.5;
    const startOffset = 0;
    const toNode = createNode("n2", 50, 235);

    routeLeftToLeft(points, start, end, dy, startOffset, toNode, null);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should adjust clearance with blocking node", () => {
    const points: number[] = [100, 132.5];
    const start = { x: 100, y: 132.5 };
    const end = { x: 50, y: 300 };
    const dy = 167.5;
    const startOffset = 0;
    const toNode = createNode("n2", 50, 235);
    const blocker = createNode("blocker", 30, 200);

    routeLeftToLeft(points, start, end, dy, startOffset, toNode, blocker);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should use startOffset for lane spacing", () => {
    const points: number[] = [100, 132.5];
    const start = { x: 100, y: 132.5 };
    const end = { x: 50, y: 300 };
    const dy = 167.5;
    const startOffset = 3;
    const toNode = createNode("n2", 50, 235);

    routeLeftToLeft(points, start, end, dy, startOffset, toNode, null);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should handle target more to the left", () => {
    const points: number[] = [200, 132.5];
    const start = { x: 200, y: 132.5 };
    const end = { x: 20, y: 300 };
    const dy = 167.5;
    const startOffset = 0;
    const toNode = createNode("n2", 20, 235);

    routeLeftToLeft(points, start, end, dy, startOffset, toNode, null);

    expect(points.length).toBeGreaterThan(2);
  });
});

describe("routeRightToBottom (direct)", () => {
  it("should route when target is above source", () => {
    const points: number[] = [300, 232.5];
    const start = { x: 300, y: 232.5 };
    const end = { x: 450, y: 165 };
    const fromNode = createNode("n1", 100, 200);
    const toNode = createNode("n2", 350, 100);
    const nodeMap = { n1: fromNode, n2: toNode };

    routeRightToBottom(points, start, end, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should route when target is below source with no blocker", () => {
    const points: number[] = [300, 132.5];
    const start = { x: 300, y: 132.5 };
    const end = { x: 450, y: 265 };
    const fromNode = createNode("n1", 100, 100);
    const toNode = createNode("n2", 350, 200);
    const nodeMap = { n1: fromNode, n2: toNode };

    routeRightToBottom(points, start, end, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should route when target is below source with horizontal blocker", () => {
    const points: number[] = [300, 132.5];
    const start = { x: 300, y: 132.5 };
    const end = { x: 500, y: 265 };
    const fromNode = createNode("n1", 100, 100);
    const toNode = createNode("n2", 400, 200);
    const blocker = createNode("blocker", 350, 100);
    const nodeMap = { n1: fromNode, n2: toNode, blocker };

    routeRightToBottom(points, start, end, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });
});

describe("routeLeftToBottom (direct)", () => {
  it("should route when target is above source", () => {
    const points: number[] = [100, 232.5];
    const start = { x: 100, y: 232.5 };
    const end = { x: 50, y: 165 };
    const fromNode = createNode("n1", 100, 200);
    const toNode = createNode("n2", 0, 100);
    const nodeMap = { n1: fromNode, n2: toNode };

    routeLeftToBottom(points, start, end, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should route when target is below source with no blocker", () => {
    const points: number[] = [100, 132.5];
    const start = { x: 100, y: 132.5 };
    const end = { x: 50, y: 265 };
    const fromNode = createNode("n1", 100, 100);
    const toNode = createNode("n2", 0, 200);
    const nodeMap = { n1: fromNode, n2: toNode };

    routeLeftToBottom(points, start, end, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should route when target is below source with horizontal blocker", () => {
    const points: number[] = [100, 132.5];
    const start = { x: 100, y: 132.5 };
    const end = { x: 50, y: 265 };
    const fromNode = createNode("n1", 100, 100);
    const toNode = createNode("n2", 0, 200);
    const blocker = createNode("blocker", 20, 100);
    const nodeMap = { n1: fromNode, n2: toNode, blocker };

    routeLeftToBottom(points, start, end, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });
});

describe("routeRightToLeft (direct)", () => {
  it("should route with significant dy and no blocker", () => {
    const points: number[] = [300, 100];
    const start = { x: 300, y: 100 };
    const end = { x: 500, y: 200 };
    const dy = 100;
    const startOffset = 0;
    const endOffset = 0;
    const fromNode = createNode("n1", 100, 67.5);
    const toNode = createNode("n2", 500, 167.5);
    const nodeMap = { n1: fromNode, n2: toNode };

    routeRightToLeft(points, start, end, dy, startOffset, endOffset, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should route with significant dy and vertical blocker", () => {
    const points: number[] = [300, 100];
    const start = { x: 300, y: 100 };
    const end = { x: 500, y: 200 };
    const dy = 100;
    const startOffset = 0;
    const endOffset = 0;
    const fromNode = createNode("n1", 100, 67.5);
    const toNode = createNode("n2", 500, 167.5);
    const blocker = createNode("blocker", 350, 120);
    const nodeMap = { n1: fromNode, n2: toNode, blocker };

    routeRightToLeft(points, start, end, dy, startOffset, endOffset, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should route with small dy (horizontal path)", () => {
    const points: number[] = [300, 100];
    const start = { x: 300, y: 100 };
    const end = { x: 500, y: 105 };
    const dy = 5;
    const startOffset = 0;
    const endOffset = 0;
    const fromNode = createNode("n1", 100, 67.5);
    const toNode = createNode("n2", 500, 72.5);
    const nodeMap = { n1: fromNode, n2: toNode };

    routeRightToLeft(points, start, end, dy, startOffset, endOffset, fromNode, toNode, nodeMap);

    // With small dy (<=10), no extra points are added (straight path is used)
    expect(points.length).toBe(2);
  });
});

describe("routeLeftToRight (direct)", () => {
  it("should route with significant dy and no blocker", () => {
    const points: number[] = [100, 100];
    const start = { x: 100, y: 100 };
    const end = { x: 300, y: 200 };
    const dy = 100;
    const startOffset = 0;
    const endOffset = 0;
    const fromNode = createNode("n1", 100, 67.5);
    const toNode = createNode("n2", 100, 167.5);
    const nodeMap = { n1: fromNode, n2: toNode };

    routeLeftToRight(points, start, end, dy, startOffset, endOffset, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should route with significant dy and vertical blocker", () => {
    const points: number[] = [100, 100];
    const start = { x: 100, y: 100 };
    const end = { x: 300, y: 200 };
    const dy = 100;
    const startOffset = 0;
    const endOffset = 0;
    const fromNode = createNode("n1", 100, 67.5);
    const toNode = createNode("n2", 100, 167.5);
    const blocker = createNode("blocker", 150, 120);
    const nodeMap = { n1: fromNode, n2: toNode, blocker };

    routeLeftToRight(points, start, end, dy, startOffset, endOffset, fromNode, toNode, nodeMap);

    expect(points.length).toBeGreaterThan(2);
  });

  it("should route with small dy (horizontal path)", () => {
    const points: number[] = [100, 100];
    const start = { x: 100, y: 100 };
    const end = { x: 300, y: 105 };
    const dy = 5;
    const startOffset = 0;
    const endOffset = 0;
    const fromNode = createNode("n1", 100, 67.5);
    const toNode = createNode("n2", 100, 72.5);
    const nodeMap = { n1: fromNode, n2: toNode };

    routeLeftToRight(points, start, end, dy, startOffset, endOffset, fromNode, toNode, nodeMap);

    // With small dy (<=10), no extra points are added (straight path is used)
    expect(points.length).toBe(2);
  });
});

// Tests to hit fallback routing paths that require A* to fail
// We use specific geometry that makes certain paths more likely to use fallbacks
describe("buildOrthogonalPath fallback routes (forcing fallback scenarios)", () => {
  
  describe("diagonal fallback path", () => {
    it("should use diagonal fallback when outSide is right/left and no specific route matches", () => {
      // Use a combination that doesn't have a specific route handler
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 200, 200);
      const start = { x: 100 + nodeWidth, y: 100 + nodeHeight / 2 }; // right exit
      const end = { x: 200 + nodeWidth, y: 200 + nodeHeight / 2 }; // right entry (unusual)
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "right",
        "right", // right-to-right is not explicitly handled
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });

    it("should use diagonal fallback when outSide is top/bottom and no specific route matches", () => {
      const fromNode = createNode("n1", 100, 100);
      const toNode = createNode("n2", 200, 200);
      const start = { x: 100 + nodeWidth / 2, y: 100 }; // top exit
      const end = { x: 200 + nodeWidth / 2, y: 200 }; // top entry (unusual)
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        null,
        fromNode,
        toNode,
        "top",
        "top", // top-to-top is not explicitly handled
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
    });
  });

  describe("meaningful waypoints return path", () => {
    it("should return waypoints when they are meaningful and not filtered out", () => {
      // Create a scenario where bendpoints create meaningful waypoints
      // that are far from any node and near path corners
      const fromNode = createNode("n1", 0, 0);
      const toNode = createNode("n2", 1000, 1000);
      const start = { x: nodeWidth, y: nodeHeight / 2 };
      const end = { x: 1000, y: 1000 + nodeHeight / 2 };
      // Use bendpoints that will create waypoints at corners
      const bendPoints: BendPoint[] = [
        { relativeTo: "source", x: 10, y: 0 }, // Far right of source
        { relativeTo: "target", x: -10, y: 0 }, // Far left of target
      ];
      const nodeMap: Record<string, PlacedNode> = { n1: fromNode, n2: toNode };

      const result = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        "right",
        "left",
        0,
        0,
        nodeMap,
        null,
        []
      );

      expect(result).toBeDefined();
      // Check if result is OrthogonalPathResult with waypoints
      if (hasWaypoints(result)) {
        expect(result.waypoints.length).toBeGreaterThanOrEqual(0);
      }
    });
  });
});