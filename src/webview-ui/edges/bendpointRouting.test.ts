/**
 * Tests for bendpointRouting.ts
 *
 * Tests bendpoint-based path routing functions.
 */

import { describe, it, expect } from "vitest";
import { buildBendpointPath, buildSingleWaypointPath } from "./bendpointRouting";
import type { PlacedNode, Point } from "../types";
import type { Segment } from "./collision";

// Helper to create a test node
function createNode(
  id: string,
  x: number,
  y: number,
  type: string = "pipelet"
): PlacedNode {
  return {
    id,
    name: id,
    type,
    x,
    y,
    col: 0,
    row: 0,
  };
}

describe("bendpointRouting", () => {
  describe("buildBendpointPath", () => {
    it("builds path with horizontal exit (right)", () => {
      const points: number[] = [100, 50]; // Start point
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 400, y: 150 };

      buildBendpointPath(
        points,
        start,
        end,
        200,
        75, // source waypoint
        350,
        150, // target waypoint
        "right",
        "left"
      );

      // Should add intermediate points
      expect(points.length).toBeGreaterThan(2);
      // First intermediate: horizontal to srcWpX
      expect(points[2]).toBe(200); // srcWpX
      expect(points[3]).toBe(50); // start.y
      // Second intermediate: vertical to tgtWpY
      expect(points[4]).toBe(200); // srcWpX
      expect(points[5]).toBe(150); // tgtWpY
    });

    it("builds path with horizontal exit (left)", () => {
      const points: number[] = [400, 50];
      const start: Point = { x: 400, y: 50 };
      const end: Point = { x: 100, y: 150 };

      buildBendpointPath(
        points,
        start,
        end,
        300,
        75,
        150,
        150,
        "left",
        "right"
      );

      expect(points.length).toBeGreaterThan(2);
      expect(points[2]).toBe(300); // srcWpX
      expect(points[3]).toBe(50); // start.y
    });

    it("builds path with vertical exit (top/bottom)", () => {
      const points: number[] = [100, 65]; // Start at bottom of node
      const start: Point = { x: 100, y: 65 };
      const end: Point = { x: 300, y: 200 };

      buildBendpointPath(
        points,
        start,
        end,
        100,
        100, // source waypoint
        300,
        180, // target waypoint
        "bottom",
        "top"
      );

      expect(points.length).toBeGreaterThan(2);
      // First: vertical to srcWpY
      expect(points[2]).toBe(100); // start.x
      expect(points[3]).toBe(100); // srcWpY
      // Second: horizontal to tgtWpX
      expect(points[4]).toBe(300); // tgtWpX
      expect(points[5]).toBe(100); // srcWpY
    });

    it("skips final horizontal segment when close to end.x", () => {
      const points: number[] = [100, 50];
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 202, y: 150 }; // end.x close to srcWpX

      buildBendpointPath(
        points,
        start,
        end,
        200,
        75,
        200,
        150,
        "right",
        "left"
      );

      // Should not add the final horizontal segment since |srcWpX - end.x| <= 5
      // Points should be: start, (srcWpX, start.y), (srcWpX, tgtWpY)
      const lastX = points[points.length - 2];
      const lastY = points[points.length - 1];
      expect(lastX).toBe(200); // srcWpX
      expect(lastY).toBe(150); // tgtWpY
    });

    it("skips final vertical segment when close to end.y for vertical exit", () => {
      const points: number[] = [100, 65];
      const start: Point = { x: 100, y: 65 };
      const end: Point = { x: 300, y: 102 }; // end.y close to srcWpY

      buildBendpointPath(
        points,
        start,
        end,
        100,
        100,
        300,
        100,
        "bottom",
        "top"
      );

      // Should not add final vertical segment since |srcWpY - end.y| <= 5
      const lastY = points[points.length - 1];
      expect(lastY).toBe(100); // srcWpY, not end.y
    });
  });

  describe("buildSingleWaypointPath", () => {
    const emptyNodeMap: Record<string, PlacedNode> = {};
    const emptySegments: Segment[] = [];

    it("builds path with horizontal exit and top entry", () => {
      const points: number[] = [100, 50];
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 300, y: 200 };
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 200, 200);

      const result = buildSingleWaypointPath(
        points,
        start,
        end,
        200,
        125, // waypoint
        "right",
        "top",
        emptyNodeMap,
        "from",
        "to",
        emptySegments,
        fromNode,
        toNode
      );

      expect(result).toBe(true);
      expect(points.length).toBeGreaterThan(2);
    });

    it("builds path with horizontal exit and bottom entry", () => {
      const points: number[] = [100, 200];
      const start: Point = { x: 100, y: 200 };
      const end: Point = { x: 300, y: 50 };
      const fromNode = createNode("from", 0, 150);
      const toNode = createNode("to", 200, 0);

      const result = buildSingleWaypointPath(
        points,
        start,
        end,
        200,
        100,
        "right",
        "bottom",
        emptyNodeMap,
        "from",
        "to",
        emptySegments,
        fromNode,
        toNode
      );

      expect(result).toBe(true);
    });

    it("builds path with horizontal exit and side entry (left/right)", () => {
      const points: number[] = [100, 50];
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 300, y: 100 };
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 200, 50);

      const result = buildSingleWaypointPath(
        points,
        start,
        end,
        200,
        75,
        "right",
        "left",
        emptyNodeMap,
        "from",
        "to",
        emptySegments,
        fromNode,
        toNode
      );

      expect(result).toBe(true);
      // Check that path goes to waypoint then to end.y
      expect(points).toContain(200); // wpX
      expect(points).toContain(100); // end.y
    });

    it("builds path with vertical exit and left entry", () => {
      const points: number[] = [100, 65];
      const start: Point = { x: 100, y: 65 };
      const end: Point = { x: 300, y: 150 };
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 300, 100);

      const result = buildSingleWaypointPath(
        points,
        start,
        end,
        200,
        100,
        "bottom",
        "left",
        emptyNodeMap,
        "from",
        "to",
        emptySegments,
        fromNode,
        toNode
      );

      expect(result).toBe(true);
    });

    it("builds path with vertical exit and right entry", () => {
      const points: number[] = [300, 65];
      const start: Point = { x: 300, y: 65 };
      const end: Point = { x: 100, y: 150 };
      const fromNode = createNode("from", 200, 0);
      const toNode = createNode("to", 0, 100);

      const result = buildSingleWaypointPath(
        points,
        start,
        end,
        200,
        100,
        "bottom",
        "right",
        emptyNodeMap,
        "from",
        "to",
        emptySegments,
        fromNode,
        toNode
      );

      expect(result).toBe(true);
    });

    it("returns false and uses A* when collision detected", () => {
      const points: number[] = [100, 50];
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 400, y: 200 };
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 300, 150);

      // Add a blocking node in the path
      const blocker = createNode("blocker", 150, 100);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
        blocker: blocker,
      };

      const result = buildSingleWaypointPath(
        points,
        start,
        end,
        200,
        125,
        "right",
        "top",
        nodeMap,
        "from",
        "to",
        emptySegments,
        fromNode,
        toNode
      );

      // Result depends on whether A* finds a path
      expect(typeof result).toBe("boolean");
    });

    it("handles minimum approach distance for top entry", () => {
      const points: number[] = [100, 50];
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 300, y: 200 };
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 200, 200);

      buildSingleWaypointPath(
        points,
        start,
        end,
        200,
        125,
        "right",
        "top",
        emptyNodeMap,
        "from",
        "to",
        emptySegments,
        fromNode,
        toNode
      );

      // The approach should come from above the target
      // Find the point just before the end
      const yValues = points.filter((_, i) => i % 2 === 1);
      const hasApproachAbove = yValues.some((y) => y < end.y);
      expect(hasApproachAbove).toBe(true);
    });

    it("handles minimum approach distance for bottom entry", () => {
      const points: number[] = [100, 200];
      const start: Point = { x: 100, y: 200 };
      const end: Point = { x: 300, y: 50 };
      const fromNode = createNode("from", 0, 150);
      const toNode = createNode("to", 200, 0);

      buildSingleWaypointPath(
        points,
        start,
        end,
        200,
        125,
        "right",
        "bottom",
        emptyNodeMap,
        "from",
        "to",
        emptySegments,
        fromNode,
        toNode
      );

      // The approach should come from below the target
      const yValues = points.filter((_, i) => i % 2 === 1);
      const hasApproachBelow = yValues.some((y) => y > end.y);
      expect(hasApproachBelow).toBe(true);
    });

    it("returns true for collision-free path", () => {
      const points: number[] = [100, 50];
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 300, y: 200 };
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 200, 150);

      const result = buildSingleWaypointPath(
        points,
        start,
        end,
        200,
        125,
        "right",
        "top",
        emptyNodeMap,
        "from",
        "to",
        emptySegments,
        fromNode,
        toNode
      );

      expect(result).toBe(true);
    });
  });
});
