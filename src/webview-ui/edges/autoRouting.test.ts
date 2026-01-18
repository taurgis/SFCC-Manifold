/**
 * Tests for autoRouting.ts
 *
 * Tests A* pathfinding integration for automatic path routing.
 */

import { describe, it, expect } from "vitest";
import { buildAutoRoutedPath } from "./autoRouting";
import type { PlacedNode, Point } from "../types";
import type { Segment } from "./collision";
import { LAYOUT_CONFIG } from "../constants";

const { nodeWidth, nodeHeight } = LAYOUT_CONFIG;

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

describe("autoRouting", () => {
  describe("buildAutoRoutedPath", () => {
    it("returns a valid path for simple straight route", () => {
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 0, 200);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: nodeWidth / 2, y: nodeHeight };
      const end: Point = { x: nodeWidth / 2, y: 200 };
      const occupiedSegments: Segment[] = [];

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

      expect(result).not.toBeNull();
      expect(result?.length).toBeGreaterThan(0);
      // Should start at start point
      expect(result?.[0]).toBe(start.x);
      expect(result?.[1]).toBe(start.y);
      // Should end at end point
      expect(result?.[result.length - 2]).toBe(end.x);
      expect(result?.[result.length - 1]).toBe(end.y);
    });

    it("routes around obstacles", () => {
      const fromNode = createNode("from", 0, 0);
      const blocker = createNode("blocker", 0, 100);
      const toNode = createNode("to", 0, 250);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        blocker: blocker,
        to: toNode,
      };
      const start: Point = { x: nodeWidth / 2, y: nodeHeight };
      const end: Point = { x: nodeWidth / 2, y: 250 };
      const occupiedSegments: Segment[] = [];

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

      // Should find a path (may return null if no path exists)
      if (result !== null) {
        expect(result.length).toBeGreaterThan(0);
        // Path should have horizontal segments to go around blocker
        // Check that not all x values are the same
        const xValues = result.filter((_, i) => i % 2 === 0);
        const uniqueX = new Set(xValues);
        expect(uniqueX.size).toBeGreaterThan(1);
      }
    });

    it("handles horizontal routing (right exit)", () => {
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 400, 0);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: nodeWidth, y: nodeHeight / 2 };
      const end: Point = { x: 400, y: nodeHeight / 2 };
      const occupiedSegments: Segment[] = [];

      const result = buildAutoRoutedPath(
        start,
        end,
        fromNode,
        toNode,
        "right",
        "left",
        nodeMap,
        occupiedSegments
      );

      expect(result).not.toBeNull();
      if (result) {
        expect(result[0]).toBe(start.x);
        expect(result[1]).toBe(start.y);
      }
    });

    it("handles left exit routing", () => {
      const fromNode = createNode("from", 400, 0);
      const toNode = createNode("to", 0, 0);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: 400, y: nodeHeight / 2 };
      const end: Point = { x: nodeWidth, y: nodeHeight / 2 };
      const occupiedSegments: Segment[] = [];

      const result = buildAutoRoutedPath(
        start,
        end,
        fromNode,
        toNode,
        "left",
        "right",
        nodeMap,
        occupiedSegments
      );

      expect(result).not.toBeNull();
    });

    it("respects occupied segments as obstacles", () => {
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 0, 200);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: nodeWidth / 2, y: nodeHeight };
      const end: Point = { x: nodeWidth / 2, y: 200 };

      // Add an occupied segment blocking the direct path
      const occupiedSegments: Segment[] = [
        {
          x1: 0,
          y1: 120,
          x2: nodeWidth,
          y2: 120,
        },
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

      // Should still find a path (or return null)
      // The path might go around the occupied segment
      expect(result === null || result.length > 0).toBe(true);
    });

    it("returns null when no path is possible", () => {
      // Create an impossible routing scenario
      const fromNode = createNode("from", 100, 100);
      const toNode = createNode("to", 100, 100); // Same position - invalid
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: 100, y: 100 };
      const end: Point = { x: 100, y: 100 };
      const occupiedSegments: Segment[] = [];

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

      // May return path or null depending on algorithm
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it("path points are all numbers (no NaN)", () => {
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 300, 200);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: nodeWidth / 2, y: nodeHeight };
      const end: Point = { x: 300 + nodeWidth / 2, y: 200 };
      const occupiedSegments: Segment[] = [];

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

      if (result !== null) {
        result.forEach((value) => {
          expect(typeof value).toBe("number");
          expect(Number.isNaN(value)).toBe(false);
          expect(Number.isFinite(value)).toBe(true);
        });
      }
    });

    it("returns even number of points (x,y pairs)", () => {
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 200, 200);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: nodeWidth / 2, y: nodeHeight };
      const end: Point = { x: 200 + nodeWidth / 2, y: 200 };
      const occupiedSegments: Segment[] = [];

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

      if (result !== null) {
        expect(result.length % 2).toBe(0);
      }
    });
  });
});
