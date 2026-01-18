/**
 * Tests for backEdge.ts
 *
 * Tests back edge (loop) path building.
 */

import { describe, it, expect } from "vitest";
import { buildBackEdgePath } from "./backEdge";
import type { PlacedNode } from "../types";
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

describe("backEdge", () => {
  describe("buildBackEdgePath", () => {
    it("creates a path with multiple points for a smooth curve", () => {
      const fromNode = createNode("from", 100, 200);
      const toNode = createNode("to", 100, 100);

      const result = buildBackEdgePath(fromNode, toNode);

      // Should have many points for smooth curve (30 steps + 1)
      expect(result.points.length).toBeGreaterThan(30);
      // Each point has x and y, so should be even number
      expect(result.points.length % 2).toBe(0);
    });

    it("starts from the bottom center of source node", () => {
      const fromNode = createNode("from", 100, 200);
      const toNode = createNode("to", 100, 100);

      const result = buildBackEdgePath(fromNode, toNode);

      // First point should be near bottom center of fromNode
      const startX = result.points[0];
      const startY = result.points[1];
      expect(startX).toBeCloseTo(fromNode.x + nodeWidth / 2, 0);
      expect(startY).toBeCloseTo(fromNode.y + nodeHeight, 0);
    });

    it("ends at the top center of target node", () => {
      const fromNode = createNode("from", 100, 200);
      const toNode = createNode("to", 100, 100);

      const result = buildBackEdgePath(fromNode, toNode);

      // End point should be near top center of toNode
      const expectedEndX = toNode.x + nodeWidth / 2;
      const expectedEndY = toNode.y;
      expect(result.end.x).toBe(expectedEndX);
      expect(result.end.y).toBe(expectedEndY);
    });

    it("returns correct end point in result object", () => {
      const fromNode = createNode("from", 100, 200);
      const toNode = createNode("to", 100, 100);

      const result = buildBackEdgePath(fromNode, toNode);

      expect(result.end).toHaveProperty("x");
      expect(result.end).toHaveProperty("y");
      expect(typeof result.end.x).toBe("number");
      expect(typeof result.end.y).toBe("number");
    });

    it("handles join node type for source (exits from center+10)", () => {
      const fromNode = createNode("from", 100, 200, "join");
      const toNode = createNode("to", 100, 100);

      const result = buildBackEdgePath(fromNode, toNode);

      // For join nodes, y1 = fromNode.y + nodeHeight/2 + 10
      const startY = result.points[1];
      expect(startY).toBeCloseTo(fromNode.y + nodeHeight / 2 + 10, 0);
    });

    it("handles join node type for target (enters at center-10)", () => {
      const fromNode = createNode("from", 100, 200);
      const toNode = createNode("to", 100, 100, "join");

      const result = buildBackEdgePath(fromNode, toNode);

      // For join target nodes, y2 = toNode.y + nodeHeight/2 - 10
      const expectedEndY = toNode.y + nodeHeight / 2 - 10;
      expect(result.end.y).toBe(expectedEndY);
    });

    it("creates path that goes to the left (loop offset)", () => {
      const fromNode = createNode("from", 200, 200);
      const toNode = createNode("to", 200, 100);

      const result = buildBackEdgePath(fromNode, toNode);

      // The path should go left of both nodes
      // Check that some middle points are to the left of the source
      const leftMostX = Math.min(...result.points.filter((_, i) => i % 2 === 0));
      expect(leftMostX).toBeLessThan(fromNode.x);
    });

    it("handles nodes at same x position", () => {
      const fromNode = createNode("from", 100, 300);
      const toNode = createNode("to", 100, 100);

      const result = buildBackEdgePath(fromNode, toNode);

      expect(result.points.length).toBeGreaterThan(0);
      expect(result.end).toBeDefined();
    });

    it("handles nodes at different x positions", () => {
      const fromNode = createNode("from", 200, 300);
      const toNode = createNode("to", 100, 100);

      const result = buildBackEdgePath(fromNode, toNode);

      expect(result.points.length).toBeGreaterThan(0);
      // Loop should go to the left of the leftmost node
      const leftMostX = Math.min(...result.points.filter((_, i) => i % 2 === 0));
      expect(leftMostX).toBeLessThan(Math.min(fromNode.x, toNode.x));
    });

    it("path contains no NaN values", () => {
      const fromNode = createNode("from", 100, 200);
      const toNode = createNode("to", 100, 100);

      const result = buildBackEdgePath(fromNode, toNode);

      result.points.forEach((value) => {
        expect(Number.isNaN(value)).toBe(false);
      });
      expect(Number.isNaN(result.end.x)).toBe(false);
      expect(Number.isNaN(result.end.y)).toBe(false);
    });

    it("generates approximately 31 points (30 steps)", () => {
      const fromNode = createNode("from", 100, 200);
      const toNode = createNode("to", 100, 100);

      const result = buildBackEdgePath(fromNode, toNode);

      // 31 points × 2 coordinates = 62 values
      const pointCount = result.points.length / 2;
      expect(pointCount).toBeGreaterThanOrEqual(30);
      expect(pointCount).toBeLessThanOrEqual(32);
    });
  });
});
