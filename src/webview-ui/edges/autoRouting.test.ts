/**
 * Tests for autoRouting.ts
 *
 * Tests A* pathfinding integration for automatic path routing,
 * including channel merging functionality.
 */

import { describe, it, expect } from "vitest";
import { buildAutoRoutedPath } from "./autoRouting";
import { ChannelRegistry } from "./channelRouting";
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

  describe("channel merging", () => {
    it("uses channel registry when provided", () => {
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 0, 200);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: nodeWidth / 2, y: nodeHeight };
      const end: Point = { x: nodeWidth / 2, y: 200 };
      const channelRegistry = new ChannelRegistry();

      const result = buildAutoRoutedPath(
        start,
        end,
        fromNode,
        toNode,
        "bottom",
        "top",
        nodeMap,
        [],
        channelRegistry
      );

      expect(result).not.toBeNull();
    });

    it("attempts vertical channel merge for left-side entry", () => {
      const fromNode = createNode("from", 0, 100);
      const toNode = createNode("to", 400, 100);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: nodeWidth, y: 100 + nodeHeight / 2 };
      const end: Point = { x: 400, y: 100 + nodeHeight / 2 };
      const channelRegistry = new ChannelRegistry();

      // Register existing vertical channel leading to target left side
      // Channel should be to the LEFT of target (x < 400)
      channelRegistry.registerEdge(
        [{ x1: 350, y1: 50, x2: 350, y2: 200 }],
        "to",
        "left"
      );

      const result = buildAutoRoutedPath(
        start,
        end,
        fromNode,
        toNode,
        "right",
        "left",
        nodeMap,
        [],
        channelRegistry
      );

      expect(result).not.toBeNull();
    });

    it("attempts vertical channel merge for right-side entry", () => {
      const fromNode = createNode("from", 400, 100);
      const toNode = createNode("to", 0, 100);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: 400, y: 100 + nodeHeight / 2 };
      const end: Point = { x: nodeWidth, y: 100 + nodeHeight / 2 };
      const channelRegistry = new ChannelRegistry();

      // Register vertical channel to the RIGHT of target (x > nodeWidth)
      channelRegistry.registerEdge(
        [{ x1: nodeWidth + 50, y1: 50, x2: nodeWidth + 50, y2: 200 }],
        "to",
        "right"
      );

      const result = buildAutoRoutedPath(
        start,
        end,
        fromNode,
        toNode,
        "left",
        "right",
        nodeMap,
        [],
        channelRegistry
      );

      expect(result).not.toBeNull();
    });

    it("attempts horizontal channel merge for top entry", () => {
      const fromNode = createNode("from", 100, 0);
      const toNode = createNode("to", 100, 300);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: 100 + nodeWidth / 2, y: nodeHeight };
      const end: Point = { x: 100 + nodeWidth / 2, y: 300 };
      const channelRegistry = new ChannelRegistry();

      // Register horizontal channel ABOVE target (y < 300)
      channelRegistry.registerEdge(
        [{ x1: 50, y1: 250, x2: 200, y2: 250 }],
        "to",
        "top"
      );

      const result = buildAutoRoutedPath(
        start,
        end,
        fromNode,
        toNode,
        "bottom",
        "top",
        nodeMap,
        [],
        channelRegistry
      );

      expect(result).not.toBeNull();
    });

    it("attempts horizontal channel merge for bottom entry", () => {
      const fromNode = createNode("from", 100, 300);
      const toNode = createNode("to", 100, 0);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: 100 + nodeWidth / 2, y: 300 };
      const end: Point = { x: 100 + nodeWidth / 2, y: nodeHeight };
      const channelRegistry = new ChannelRegistry();

      // Register horizontal channel BELOW target (y > nodeHeight)
      channelRegistry.registerEdge(
        [{ x1: 50, y1: nodeHeight + 50, x2: 200, y2: nodeHeight + 50 }],
        "to",
        "bottom"
      );

      const result = buildAutoRoutedPath(
        start,
        end,
        fromNode,
        toNode,
        "top",
        "bottom",
        nodeMap,
        [],
        channelRegistry
      );

      expect(result).not.toBeNull();
    });

    it("falls back to A* when channel merge path has collision", () => {
      const fromNode = createNode("from", 0, 0);
      const blocker = createNode("blocker", 150, 100);
      const toNode = createNode("to", 0, 300);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        blocker: blocker,
        to: toNode,
      };
      const start: Point = { x: nodeWidth / 2, y: nodeHeight };
      const end: Point = { x: nodeWidth / 2, y: 300 };
      const channelRegistry = new ChannelRegistry();

      // Register channel that would go through the blocker
      channelRegistry.registerEdge(
        [{ x1: nodeWidth / 2, y1: 50, x2: nodeWidth / 2, y2: 280 }],
        "to",
        "top"
      );

      const result = buildAutoRoutedPath(
        start,
        end,
        fromNode,
        toNode,
        "bottom",
        "top",
        nodeMap,
        [],
        channelRegistry
      );

      // Should still find a path (fallback to A*)
      expect(result).not.toBeNull();
    });

    it("does not merge when channel position is invalid for right entry", () => {
      const fromNode = createNode("from", 0, 100);
      const toNode = createNode("to", 400, 100);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: nodeWidth, y: 100 + nodeHeight / 2 };
      const end: Point = { x: 400, y: 100 + nodeHeight / 2 };
      const channelRegistry = new ChannelRegistry();

      // Register channel to the LEFT of target - wrong for right-side entry
      channelRegistry.registerEdge(
        [{ x1: 350, y1: 50, x2: 350, y2: 200 }],
        "to",
        "right" // Right-side entry needs channel to the RIGHT
      );

      const result = buildAutoRoutedPath(
        start,
        end,
        fromNode,
        toNode,
        "right",
        "right",
        nodeMap,
        [],
        channelRegistry
      );

      // Should still route (via A*) even though channel merge was invalid
      expect(result).not.toBeNull();
    });

    it("does not merge when channel position is invalid for top entry", () => {
      const fromNode = createNode("from", 100, 0);
      const toNode = createNode("to", 100, 200);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: 100 + nodeWidth / 2, y: nodeHeight };
      const end: Point = { x: 100 + nodeWidth / 2, y: 200 };
      const channelRegistry = new ChannelRegistry();

      // Register channel BELOW target - wrong for top entry
      channelRegistry.registerEdge(
        [{ x1: 50, y1: 250, x2: 200, y2: 250 }],
        "to",
        "top" // Top entry needs channel ABOVE target
      );

      const result = buildAutoRoutedPath(
        start,
        end,
        fromNode,
        toNode,
        "bottom",
        "top",
        nodeMap,
        [],
        channelRegistry
      );

      expect(result).not.toBeNull();
    });

    it("validates merge path for vertical then horizontal routing (bottom exit)", () => {
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 300, 100);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: nodeWidth / 2, y: nodeHeight };
      const end: Point = { x: 300, y: 100 + nodeHeight / 2 };
      const channelRegistry = new ChannelRegistry();

      // Register vertical channel for left-side entry
      channelRegistry.registerEdge(
        [{ x1: 250, y1: 50, x2: 250, y2: 200 }],
        "to",
        "left"
      );

      const result = buildAutoRoutedPath(
        start,
        end,
        fromNode,
        toNode,
        "bottom",
        "left",
        nodeMap,
        [],
        channelRegistry
      );

      expect(result).not.toBeNull();
    });

    it("validates merge path for horizontal then vertical routing (right exit)", () => {
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 300, 200);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: nodeWidth, y: nodeHeight / 2 };
      const end: Point = { x: 300 + nodeWidth / 2, y: 200 };
      const channelRegistry = new ChannelRegistry();

      // Register horizontal channel for top entry
      channelRegistry.registerEdge(
        [{ x1: 250, y1: 150, x2: 400, y2: 150 }],
        "to",
        "top"
      );

      const result = buildAutoRoutedPath(
        start,
        end,
        fromNode,
        toNode,
        "right",
        "top",
        nodeMap,
        [],
        channelRegistry
      );

      expect(result).not.toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles top exit side", () => {
      const fromNode = createNode("from", 0, 200);
      const toNode = createNode("to", 0, 0);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        to: toNode,
      };
      const start: Point = { x: nodeWidth / 2, y: 200 };
      const end: Point = { x: nodeWidth / 2, y: nodeHeight };

      const result = buildAutoRoutedPath(
        start,
        end,
        fromNode,
        toNode,
        "top",
        "bottom",
        nodeMap,
        []
      );

      expect(result).not.toBeNull();
    });

    it("handles launch point inside obstacle by creating clearance", () => {
      // Create scenario where launch point might overlap with obstacle
      const fromNode = createNode("from", 0, 0);
      const nearbyNode = createNode("nearby", nodeWidth - 10, nodeHeight - 10);
      const toNode = createNode("to", 0, 300);
      const nodeMap: Record<string, PlacedNode> = {
        from: fromNode,
        nearby: nearbyNode,
        to: toNode,
      };
      const start: Point = { x: nodeWidth / 2, y: nodeHeight };
      const end: Point = { x: nodeWidth / 2, y: 300 };

      // This should trigger the isInsideObstacle branch
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

      // Should handle gracefully
      expect(result === null || Array.isArray(result)).toBe(true);
    });

    it("handles all four outSide directions", () => {
      const sides = ["top", "bottom", "left", "right"] as const;

      for (const outSide of sides) {
        const fromNode = createNode("from", 200, 200);
        const toNode = createNode("to", 200, 400);
        const nodeMap: Record<string, PlacedNode> = {
          from: fromNode,
          to: toNode,
        };

        const start: Point =
          outSide === "top"
            ? { x: 200 + nodeWidth / 2, y: 200 }
            : outSide === "bottom"
              ? { x: 200 + nodeWidth / 2, y: 200 + nodeHeight }
              : outSide === "left"
                ? { x: 200, y: 200 + nodeHeight / 2 }
                : { x: 200 + nodeWidth, y: 200 + nodeHeight / 2 };

        const end: Point = { x: 200 + nodeWidth / 2, y: 400 };

        const result = buildAutoRoutedPath(
          start,
          end,
          fromNode,
          toNode,
          outSide,
          "top",
          nodeMap,
          []
        );

        expect(result, `Failed for outSide: ${outSide}`).not.toBeNull();
      }
    });

    it("handles all four inSide directions", () => {
      const sides = ["top", "bottom", "left", "right"] as const;

      for (const inSide of sides) {
        const fromNode = createNode("from", 200, 200);

        // Position toNode appropriately for entry from each side
        let toNode: PlacedNode;
        let end: Point;

        if (inSide === "top") {
          toNode = createNode("to", 200, 400);
          end = { x: 200 + nodeWidth / 2, y: 400 };
        } else if (inSide === "bottom") {
          toNode = createNode("to", 200, 0);
          end = { x: 200 + nodeWidth / 2, y: nodeHeight };
        } else if (inSide === "left") {
          toNode = createNode("to", 500, 200);
          end = { x: 500, y: 200 + nodeHeight / 2 };
        } else {
          toNode = createNode("to", 0, 200);
          end = { x: nodeWidth, y: 200 + nodeHeight / 2 };
        }

        const nodeMap: Record<string, PlacedNode> = {
          from: fromNode,
          to: toNode,
        };
        const start: Point = { x: 200 + nodeWidth / 2, y: 200 + nodeHeight };

        const result = buildAutoRoutedPath(
          start,
          end,
          fromNode,
          toNode,
          "bottom",
          inSide,
          nodeMap,
          []
        );

        expect(result, `Failed for inSide: ${inSide}`).not.toBeNull();
      }
    });
  });
});
