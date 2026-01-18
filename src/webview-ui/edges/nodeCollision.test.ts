/**
 * Tests for nodeCollision.ts
 *
 * Tests collision detection functions for path building.
 */

import { describe, it, expect } from "vitest";
import {
  isInsideNode,
  isInsideAnyNode,
  pathSegmentHitsNode,
  bendpointPathHasCollision,
} from "./nodeCollision";
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
    name: id,
    type,
    x,
    y,
    col: 0,
    row: 0,
  };
}

describe("nodeCollision", () => {
  describe("isInsideNode", () => {
    const node = createNode("test", 100, 100);

    it("returns true for point clearly inside node", () => {
      const point = { x: 150, y: 130 }; // Center of node
      expect(isInsideNode(point, node)).toBe(true);
    });

    it("returns true for point at node corner", () => {
      const point = { x: 100, y: 100 }; // Top-left corner
      expect(isInsideNode(point, node)).toBe(true);
    });

    it("returns true for point at node bottom-right corner", () => {
      const point = { x: 100 + nodeWidth, y: 100 + nodeHeight };
      expect(isInsideNode(point, node)).toBe(true);
    });

    it("returns true for point within default padding", () => {
      // Default padding is 15
      const point = { x: 100 - 10, y: 100 - 10 };
      expect(isInsideNode(point, node)).toBe(true);
    });

    it("returns false for point outside padding", () => {
      const point = { x: 100 - 20, y: 100 - 20 };
      expect(isInsideNode(point, node)).toBe(false);
    });

    it("returns false for point far from node", () => {
      const point = { x: 500, y: 500 };
      expect(isInsideNode(point, node)).toBe(false);
    });

    it("respects custom padding parameter", () => {
      const point = { x: 100 - 25, y: 100 };
      expect(isInsideNode(point, node, 30)).toBe(true);
      expect(isInsideNode(point, node, 20)).toBe(false);
    });

    it("handles zero padding", () => {
      const point = { x: 100 - 1, y: 100 };
      expect(isInsideNode(point, node, 0)).toBe(false);
      const insidePoint = { x: 100, y: 100 };
      expect(isInsideNode(insidePoint, node, 0)).toBe(true);
    });
  });

  describe("isInsideAnyNode", () => {
    const nodeMap: Record<string, PlacedNode> = {
      node1: createNode("node1", 100, 100),
      node2: createNode("node2", 400, 100),
      node3: createNode("node3", 100, 300),
    };

    it("returns true when point is inside first node", () => {
      const point = { x: 150, y: 130 };
      expect(isInsideAnyNode(point, nodeMap)).toBe(true);
    });

    it("returns true when point is inside second node", () => {
      const point = { x: 450, y: 130 };
      expect(isInsideAnyNode(point, nodeMap)).toBe(true);
    });

    it("returns true when point is inside third node", () => {
      const point = { x: 150, y: 330 };
      expect(isInsideAnyNode(point, nodeMap)).toBe(true);
    });

    it("returns false when point is outside all nodes", () => {
      const point = { x: 250, y: 200 };
      expect(isInsideAnyNode(point, nodeMap)).toBe(false);
    });

    it("returns false for empty node map", () => {
      const point = { x: 150, y: 130 };
      expect(isInsideAnyNode(point, {})).toBe(false);
    });

    it("handles single node in map", () => {
      const singleNodeMap = { only: createNode("only", 0, 0) };
      expect(isInsideAnyNode({ x: 50, y: 30 }, singleNodeMap)).toBe(true);
      expect(isInsideAnyNode({ x: 500, y: 500 }, singleNodeMap)).toBe(false);
    });
  });

  describe("pathSegmentHitsNode", () => {
    const nodeMap: Record<string, PlacedNode> = {
      blocker: createNode("blocker", 200, 100),
      source: createNode("source", 0, 100),
      target: createNode("target", 500, 100),
    };

    it("returns blocking node when horizontal segment crosses node", () => {
      // Horizontal line through blocker
      const result = pathSegmentHitsNode(
        50,
        130,
        450,
        130,
        nodeMap,
        ["source", "target"]
      );
      expect(result).not.toBeNull();
      expect(result?.id).toBe("blocker");
    });

    it("returns blocking node when vertical segment crosses node", () => {
      const nodeMapVertical: Record<string, PlacedNode> = {
        blocker: createNode("blocker", 100, 200),
        source: createNode("source", 100, 0),
        target: createNode("target", 100, 400),
      };
      const result = pathSegmentHitsNode(
        150,
        50,
        150,
        350,
        nodeMapVertical,
        ["source", "target"]
      );
      expect(result).not.toBeNull();
      expect(result?.id).toBe("blocker");
    });

    it("returns null when segment does not cross any node", () => {
      // Line that goes around the blocker
      const result = pathSegmentHitsNode(
        50,
        50,
        450,
        50, // Above all nodes
        nodeMap,
        ["source", "target"]
      );
      expect(result).toBeNull();
    });

    it("excludes specified node IDs from collision detection", () => {
      // Line through blocker, but blocker is excluded
      const result = pathSegmentHitsNode(
        50,
        130,
        450,
        130,
        nodeMap,
        ["source", "target", "blocker"]
      );
      expect(result).toBeNull();
    });

    it("handles diagonal segment (bounding box intersection)", () => {
      // Diagonal line through blocker area
      const result = pathSegmentHitsNode(
        150,
        80,
        350,
        180,
        nodeMap,
        ["source", "target"]
      );
      expect(result).not.toBeNull();
    });

    it("returns null for empty node map", () => {
      const result = pathSegmentHitsNode(50, 130, 450, 130, {}, []);
      expect(result).toBeNull();
    });

    it("handles segment that touches node edge", () => {
      // Line at node edge - should detect due to padding
      const result = pathSegmentHitsNode(
        200,
        90,
        200,
        200,
        nodeMap,
        ["source", "target"]
      );
      expect(result).not.toBeNull();
    });
  });

  describe("bendpointPathHasCollision", () => {
    const nodeMap: Record<string, PlacedNode> = {
      from: createNode("from", 0, 100),
      blocker: createNode("blocker", 200, 100),
      to: createNode("to", 400, 100),
    };

    it("returns true when path crosses blocking node", () => {
      // Straight horizontal path through blocker
      const points = [50, 130, 350, 130, 450, 130];
      const result = bendpointPathHasCollision(points, nodeMap, "from", "to");
      expect(result).toBe(true);
    });

    it("returns false when path avoids all nodes", () => {
      // Path that goes above blocker
      const points = [50, 130, 50, 50, 450, 50, 450, 130];
      const result = bendpointPathHasCollision(points, nodeMap, "from", "to");
      expect(result).toBe(false);
    });

    it("excludes source and target nodes from collision check", () => {
      // Path through source and target (which should be ignored)
      const points = [50, 130, 450, 130]; // Through source and target only
      const nodeMapNoBlocker: Record<string, PlacedNode> = {
        from: createNode("from", 0, 100),
        to: createNode("to", 400, 100),
      };
      const result = bendpointPathHasCollision(
        points,
        nodeMapNoBlocker,
        "from",
        "to"
      );
      expect(result).toBe(false);
    });

    it("handles path with multiple segments", () => {
      // Multi-segment path with one segment through blocker
      const points = [50, 130, 50, 50, 250, 50, 250, 130, 450, 130];
      const result = bendpointPathHasCollision(points, nodeMap, "from", "to");
      expect(result).toBe(true);
    });

    it("returns false for path with only start and end points", () => {
      // Single segment (not enough for collision check loop)
      const points = [50, 130, 450, 130];
      const nodeMapNoBlocker: Record<string, PlacedNode> = {
        from: createNode("from", 0, 100),
        to: createNode("to", 400, 100),
      };
      const result = bendpointPathHasCollision(
        points,
        nodeMapNoBlocker,
        "from",
        "to"
      );
      expect(result).toBe(false);
    });

    it("handles empty points array", () => {
      const result = bendpointPathHasCollision([], nodeMap, "from", "to");
      expect(result).toBe(false);
    });
  });
});
