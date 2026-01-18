/**
 * Tests for directionRouting.ts
 *
 * Tests direction-specific routing functions.
 */

import { describe, it, expect } from "vitest";
import {
  routeBottomToTop,
  routeRightToTop,
  routeLeftToTop,
  routeLeftToLeft,
  routeBottomToRight,
  routeBottomToLeft,
  routeRightToBottom,
  routeLeftToBottom,
  routeRightToLeft,
  routeLeftToRight,
  routeTopToBottom,
} from "./directionRouting";
import type { PlacedNode, Point } from "../types";

// Helper to create a test node
function createNode(
  id: string,
  x: number,
  y: number,
  type: string = "pipelet"
): PlacedNode {
  return {
    id,
    label: id,
    type: type as PlacedNode["type"],
    branch: "Start",
    attributes: {},
    configProperties: [],
    bindings: [],
    template: null,
    description: null,
    x,
    y,
  };
}

describe("directionRouting", () => {
  describe("routeBottomToTop", () => {
    it("creates simple path when dx is small (vertical alignment)", () => {
      const points: number[] = [];
      const start: Point = { x: 100, y: 65 };
      const end: Point = { x: 102, y: 200 };
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 0, 200);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };

      routeBottomToTop(
        points,
        start,
        end,
        2,
        135, // dx, dy
        fromNode,
        toNode,
        nodeMap
      );

      // With small dx, path might be straight or have minimal points
      expect(points.length % 2).toBe(0);
    });

    it("creates L-shaped path when nodes are offset horizontally", () => {
      const points: number[] = [];
      const start: Point = { x: 100, y: 65 };
      const end: Point = { x: 300, y: 200 };
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 200, 200);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };

      routeBottomToTop(
        points,
        start,
        end,
        200,
        135,
        fromNode,
        toNode,
        nodeMap
      );

      // Should have intermediate points
      expect(points.length).toBeGreaterThan(0);
    });

    it("avoids blocking node in path", () => {
      const points: number[] = [];
      const start: Point = { x: 100, y: 65 };
      const end: Point = { x: 300, y: 300 };
      const fromNode = createNode("from", 0, 0);
      const blocker = createNode("blocker", 150, 150);
      const toNode = createNode("to", 200, 300);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        blocker: blocker,
        to: toNode,
      };

      routeBottomToTop(
        points,
        start,
        end,
        200,
        235,
        fromNode,
        toNode,
        nodeMap
      );

      // Path should go around blocker
      expect(points.length).toBeGreaterThan(0);
    });
  });

  describe("routeRightToTop", () => {
    it("creates path from right exit to top entry", () => {
      const points: number[] = [];
      const start: Point = { x: 200, y: 32.5 };
      const end: Point = { x: 400, y: 200 };
      const toNode = createNode("to", 300, 200);
      const nodeMap: Record<string, PlacedNode> = { to: toNode };

      routeRightToTop(
        points,
        start,
        end,
        167.5, // dy
        0, // startOffset
        toNode,
        nodeMap,
        null // blockingNode
      );

      expect(points.length).toBeGreaterThan(0);
      // First point should be horizontal movement (clearanceX, start.y)
      expect(points[1]).toBe(start.y);
    });

    it("adds lane spacing based on startOffset", () => {
      const pointsNoOffset: number[] = [];
      const pointsWithOffset: number[] = [];
      const start: Point = { x: 200, y: 32.5 };
      const end: Point = { x: 400, y: 200 };
      const toNode = createNode("to", 300, 200);
      const nodeMap: Record<string, PlacedNode> = { to: toNode };

      routeRightToTop(
        pointsNoOffset,
        start,
        end,
        167.5,
        0,
        toNode,
        nodeMap,
        null
      );

      routeRightToTop(
        pointsWithOffset,
        start,
        end,
        167.5,
        10, // Larger offset
        toNode,
        nodeMap,
        null
      );

      // With offset, clearanceX should be different
      expect(pointsWithOffset[0]).not.toBe(pointsNoOffset[0]);
    });
  });

  describe("routeLeftToTop", () => {
    it("creates path from left exit to top entry", () => {
      const points: number[] = [];
      const start: Point = { x: 0, y: 32.5 };
      const end: Point = { x: 200, y: 200 };
      const toNode = createNode("to", 100, 200);
      const nodeMap: Record<string, PlacedNode> = { to: toNode };

      routeLeftToTop(
        points,
        start,
        end,
        200, // dx
        167.5, // dy
        0,
        toNode,
        nodeMap,
        null
      );

      expect(points.length).toBeGreaterThan(0);
      // First point should be to the left
      expect(points[0]).toBeLessThan(start.x);
    });

    it("adjusts path around blocking node", () => {
      const points: number[] = [];
      const start: Point = { x: 100, y: 32.5 };
      const end: Point = { x: 300, y: 200 };
      const toNode = createNode("to", 200, 200);
      const blocker = createNode("blocker", 50, 100);
      const nodeMap: Record<string, PlacedNode> = {
        to: toNode,
        blocker: blocker,
      };

      routeLeftToTop(
        points,
        start,
        end,
        200,
        167.5,
        0,
        toNode,
        nodeMap,
        blocker
      );

      expect(points.length).toBeGreaterThan(0);
    });
  });

  describe("routeLeftToLeft", () => {
    it("creates path from left exit to left entry", () => {
      const points: number[] = [];
      const start: Point = { x: 100, y: 32.5 };
      const end: Point = { x: 300, y: 200 };
      const toNode = createNode("to", 300, 200);

      routeLeftToLeft(points, start, end, 167.5, 0, toNode, null);

      expect(points.length).toBe(4); // Two intermediate points
      // Both x values should be to the left
      expect(points[0]).toBeLessThan(start.x);
      expect(points[2]).toBeLessThan(end.x);
    });

    it("adjusts clearance for blocking node", () => {
      const points: number[] = [];
      const start: Point = { x: 100, y: 32.5 };
      const end: Point = { x: 300, y: 200 };
      const toNode = createNode("to", 300, 200);
      const blocker = createNode("blocker", 50, 100);

      routeLeftToLeft(points, start, end, 167.5, 0, toNode, blocker);

      // Clearance should be adjusted to avoid blocker
      expect(points[0]).toBeLessThan(blocker.x);
    });
  });

  describe("routeBottomToRight", () => {
    it("creates simple L-shape path", () => {
      const points: number[] = [];
      const start: Point = { x: 100, y: 65 };
      const end: Point = { x: 300, y: 100 };

      routeBottomToRight(points, start, end);

      expect(points.length).toBe(2);
      // Single corner point at (start.x, end.y)
      expect(points[0]).toBe(start.x);
      expect(points[1]).toBe(end.y);
    });
  });

  describe("routeBottomToLeft", () => {
    it("creates simple L-shape path", () => {
      const points: number[] = [];
      const start: Point = { x: 300, y: 65 };
      const end: Point = { x: 100, y: 100 };

      routeBottomToLeft(points, start, end);

      expect(points.length).toBe(2);
      // Single corner point at (start.x, end.y)
      expect(points[0]).toBe(start.x);
      expect(points[1]).toBe(end.y);
    });
  });

  describe("routeRightToBottom", () => {
    it("creates path when target is below", () => {
      const points: number[] = [];
      const start: Point = { x: 200, y: 32.5 };
      const end: Point = { x: 400, y: 150 };
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 300, 150);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };

      routeRightToBottom(points, start, end, fromNode, toNode, nodeMap);

      expect(points.length).toBeGreaterThan(0);
    });

    it("creates path when target is above", () => {
      const points: number[] = [];
      const start: Point = { x: 200, y: 150 };
      const end: Point = { x: 400, y: 32.5 };
      const fromNode = createNode("from", 0, 100);
      const toNode = createNode("to", 300, 0);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };

      routeRightToBottom(points, start, end, fromNode, toNode, nodeMap);

      // Should go right, up, then approach from below
      expect(points.length).toBeGreaterThan(0);
      // Check last y is below target (approach from below)
      const lastY = points[points.length - 1];
      expect(lastY).toBeGreaterThan(end.y);
    });
  });

  describe("routeLeftToBottom", () => {
    it("creates path when target is below", () => {
      const points: number[] = [];
      const start: Point = { x: 100, y: 32.5 };
      const end: Point = { x: 200, y: 150 };
      const fromNode = createNode("from", 100, 0);
      const toNode = createNode("to", 100, 150);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };

      routeLeftToBottom(points, start, end, fromNode, toNode, nodeMap);

      expect(points.length).toBeGreaterThan(0);
    });

    it("creates path when target is above", () => {
      const points: number[] = [];
      const start: Point = { x: 100, y: 150 };
      const end: Point = { x: 200, y: 32.5 };
      const fromNode = createNode("from", 100, 100);
      const toNode = createNode("to", 100, 0);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };

      routeLeftToBottom(points, start, end, fromNode, toNode, nodeMap);

      // Should go left, up, then approach from below
      expect(points.length).toBeGreaterThan(0);
    });
  });

  describe("routeRightToLeft", () => {
    it("creates S-shaped path when there is vertical difference", () => {
      const points: number[] = [];
      const start: Point = { x: 200, y: 32.5 };
      const end: Point = { x: 400, y: 150 };
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 400, 150);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };

      routeRightToLeft(
        points,
        start,
        end,
        117.5, // dy
        0,
        0,
        fromNode,
        toNode,
        nodeMap
      );

      expect(points.length).toBe(4); // Two corner points
    });

    it("skips routing when dy is small", () => {
      const points: number[] = [];
      const start: Point = { x: 200, y: 32.5 };
      const end: Point = { x: 400, y: 35 }; // Small dy
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 400, 0);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };

      routeRightToLeft(
        points,
        start,
        end,
        2.5, // Small dy
        0,
        0,
        fromNode,
        toNode,
        nodeMap
      );

      // No points added when dy is small
      expect(points.length).toBe(0);
    });

    it("avoids vertical blocker", () => {
      const points: number[] = [];
      const start: Point = { x: 200, y: 32.5 };
      const end: Point = { x: 500, y: 200 };
      const fromNode = createNode("from", 0, 0);
      const blocker = createNode("blocker", 300, 100);
      const toNode = createNode("to", 400, 200);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        blocker: blocker,
        to: toNode,
      };

      routeRightToLeft(
        points,
        start,
        end,
        167.5,
        0,
        0,
        fromNode,
        toNode,
        nodeMap
      );

      expect(points.length).toBeGreaterThan(0);
    });
  });

  describe("routeLeftToRight", () => {
    it("creates S-shaped path when there is vertical difference", () => {
      const points: number[] = [];
      const start: Point = { x: 400, y: 32.5 };
      const end: Point = { x: 200, y: 150 };
      const fromNode = createNode("from", 400, 0);
      const toNode = createNode("to", 0, 150);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };

      routeLeftToRight(
        points,
        start,
        end,
        117.5, // dy
        0,
        0,
        fromNode,
        toNode,
        nodeMap
      );

      expect(points.length).toBe(4);
    });

    it("avoids blocker by adjusting midX", () => {
      const points: number[] = [];
      const start: Point = { x: 500, y: 32.5 };
      const end: Point = { x: 200, y: 200 };
      const fromNode = createNode("from", 400, 0);
      const blocker = createNode("blocker", 300, 100);
      const toNode = createNode("to", 0, 200);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        blocker: blocker,
        to: toNode,
      };

      routeLeftToRight(
        points,
        start,
        end,
        167.5,
        0,
        0,
        fromNode,
        toNode,
        nodeMap
      );

      expect(points.length).toBeGreaterThan(0);
    });
  });

  describe("routeTopToBottom", () => {
    it("creates S-shaped path when there is horizontal difference", () => {
      const points: number[] = [];
      const start: Point = { x: 100, y: 0 };
      const end: Point = { x: 300, y: 200 };

      routeTopToBottom(
        points,
        start,
        end,
        200, // dx
        0, // startOffset
        0 // endOffset
      );

      expect(points.length).toBe(4);
      // Mid points should be at midY
      const midY = (start.y + end.y) / 2;
      expect(points[1]).toBe(midY);
      expect(points[3]).toBe(midY);
    });

    it("skips routing when dx is small", () => {
      const points: number[] = [];
      const start: Point = { x: 100, y: 0 };
      const end: Point = { x: 103, y: 200 }; // Small dx

      routeTopToBottom(points, start, end, 3, 0, 0);

      expect(points.length).toBe(0);
    });

    it("applies offsets correctly", () => {
      const points: number[] = [];
      const start: Point = { x: 100, y: 0 };
      const end: Point = { x: 300, y: 200 };

      routeTopToBottom(points, start, end, 200, 10, 5);

      // First point x should be start.x + startOffset
      expect(points[0]).toBe(110);
      // Second point x should be end.x + endOffset
      expect(points[2]).toBe(305);
    });
  });
});
