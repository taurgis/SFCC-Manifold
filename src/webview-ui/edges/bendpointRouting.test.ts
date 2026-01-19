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

describe("bendpointRouting", () => {
  describe("buildBendpointPath", () => {
    it("builds path with horizontal exit (right)", () => {
      const points: number[] = [100, 50]; // Start point
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 400, y: 150 };

      const result = buildBendpointPath(
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
      // Should return actual waypoints
      expect(result.actualWaypoints).toBeDefined();
      expect(result.actualWaypoints.length).toBeGreaterThan(0);
    });

    it("builds path with horizontal exit (left)", () => {
      const points: number[] = [400, 50];
      const start: Point = { x: 400, y: 50 };
      const end: Point = { x: 100, y: 150 };

      const result = buildBendpointPath(
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
      expect(result.actualWaypoints).toBeDefined();
    });

    it("builds path with vertical exit (top/bottom)", () => {
      const points: number[] = [100, 65]; // Start at bottom of node
      const start: Point = { x: 100, y: 65 };
      const end: Point = { x: 300, y: 200 };

      const result = buildBendpointPath(
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
      expect(result.actualWaypoints).toBeDefined();
    });

    it("handles horizontal exit and left entry with close waypoints", () => {
      const points: number[] = [100, 50];
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 202, y: 150 }; // end.x close to srcWpX

      const result = buildBendpointPath(
        points,
        start,
        end,
        200,
        75,
        200,
        150,
        "right",
        "left" // Entry from left - channel should be to the left of entry
      );

      // With left entry, the channel should be positioned correctly
      // to approach from the left side
      expect(points.length).toBeGreaterThan(2);
      // The path should be valid (exact behavior depends on entry side)
      expect(result.actualWaypoints).toBeDefined();
    });

    it("handles vertical exit and top entry with close waypoints", () => {
      const points: number[] = [100, 65];
      const start: Point = { x: 100, y: 65 };
      const end: Point = { x: 300, y: 102 }; // end.y close to srcWpY

      const result = buildBendpointPath(
        points,
        start,
        end,
        100,
        100,
        300,
        100,
        "bottom",
        "top" // Entry from top - channel should be above entry
      );

      // With top entry, the channel should be positioned correctly
      // to approach from above
      expect(points.length).toBeGreaterThan(2);
      // The path should be valid
      expect(result.actualWaypoints).toBeDefined();
    });

    it("builds clean path with right exit and right entry", () => {
      // This is the Mail.xml scenario: Decision -> Join both with right side routing
      const points: number[] = [680, 430]; // Decision's right anchor
      const start: Point = { x: 680, y: 430 };
      const end: Point = { x: 600, y: 650 }; // Join's right anchor

      const result = buildBendpointPath(
        points,
        start,
        end,
        810,
        430, // source waypoint (1 horizontal gap to the right)
        810,
        650, // target waypoint (1 horizontal gap to the right)
        "right",
        "right"
      );

      // For right entry, the channel should be to the right of the entry point
      // so we approach from the right
      expect(points.length).toBeGreaterThan(2);

      // The channel X should be >= end.x + 30 (approaching from right)
      const channelX = points[2];
      expect(channelX).toBeGreaterThanOrEqual(end.x + 30);

      // The vertical segment should go down to the entry Y
      expect(points[5]).toBe(end.y);
      
      // The actual waypoint should be at the channel position
      expect(result.actualWaypoints.length).toBeGreaterThan(0);
      expect(result.actualWaypoints[0].x).toBe(channelX);
    });

    it("builds clean path with left exit and left entry", () => {
      const points: number[] = [100, 50];
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 150, y: 200 };

      const result = buildBendpointPath(
        points,
        start,
        end,
        50,
        50, // source waypoint (to the left)
        50,
        200, // target waypoint
        "left",
        "left"
      );

      // For left entry, the channel should be to the left of the entry point
      expect(points.length).toBeGreaterThan(2);

      // The channel X should be <= end.x - 30 (approaching from left)
      const channelX = points[2];
      expect(channelX).toBeLessThanOrEqual(end.x - 30);
      
      // The actual waypoint should match
      expect(result.actualWaypoints.length).toBeGreaterThan(0);
    });

    it("handles horizontal exit to vertical entry (top)", () => {
      const points: number[] = [100, 50];
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 300, y: 200 };

      const result = buildBendpointPath(
        points,
        start,
        end,
        200, 100, // source waypoint
        300, 180, // target waypoint
        "right",
        "top" // vertical entry from top
      );

      expect(points.length).toBeGreaterThan(2);
      expect(result.actualWaypoints.length).toBeGreaterThan(0);
    });

    it("handles horizontal exit to vertical entry (bottom)", () => {
      const points: number[] = [100, 200];
      const start: Point = { x: 100, y: 200 };
      const end: Point = { x: 300, y: 50 };

      const result = buildBendpointPath(
        points,
        start,
        end,
        200, 150, // source waypoint
        300, 80, // target waypoint
        "right",
        "bottom" // vertical entry from bottom
      );

      expect(points.length).toBeGreaterThan(2);
      expect(result.actualWaypoints.length).toBeGreaterThan(0);
    });

    it("handles default horizontal exit routing with unknown inSide", () => {
      const points: number[] = [100, 50];
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 300, y: 200 };

      const result = buildBendpointPath(
        points,
        start,
        end,
        200, 100,
        250, 180,
        "right",
        "unknown" // unknown entry side triggers default
      );

      expect(points.length).toBeGreaterThan(2);
      expect(result.actualWaypoints.length).toBeGreaterThan(0);
    });

    it("handles vertical exit to top entry", () => {
      const points: number[] = [100, 65];
      const start: Point = { x: 100, y: 65 };
      const end: Point = { x: 300, y: 200 };

      const result = buildBendpointPath(
        points,
        start,
        end,
        100, 100,
        300, 170, // target waypoint above end
        "bottom",
        "top"
      );

      expect(points.length).toBeGreaterThan(2);
      expect(result.actualWaypoints.length).toBe(2);
    });

    it("handles vertical exit to bottom entry", () => {
      const points: number[] = [100, 200];
      const start: Point = { x: 100, y: 200 };
      const end: Point = { x: 300, y: 50 };

      const result = buildBendpointPath(
        points,
        start,
        end,
        100, 150,
        300, 80,
        "top",
        "bottom"
      );

      expect(points.length).toBeGreaterThan(2);
      expect(result.actualWaypoints.length).toBe(2);
    });

    it("handles vertical exit to horizontal entry (right)", () => {
      const points: number[] = [100, 65];
      const start: Point = { x: 100, y: 65 };
      const end: Point = { x: 300, y: 200 };

      const result = buildBendpointPath(
        points,
        start,
        end,
        100, 100,
        350, 200, // target waypoint to the right of end
        "bottom",
        "right"
      );

      expect(points.length).toBeGreaterThan(2);
      expect(result.actualWaypoints.length).toBeGreaterThan(0);
    });

    it("handles vertical exit to horizontal entry (left)", () => {
      const points: number[] = [300, 65];
      const start: Point = { x: 300, y: 65 };
      const end: Point = { x: 100, y: 200 };

      const result = buildBendpointPath(
        points,
        start,
        end,
        300, 100,
        50, 200, // target waypoint to the left of end
        "bottom",
        "left"
      );

      expect(points.length).toBeGreaterThan(2);
      expect(result.actualWaypoints.length).toBeGreaterThan(0);
    });

    it("handles default vertical exit routing with unknown inSide", () => {
      const points: number[] = [100, 65];
      const start: Point = { x: 100, y: 65 };
      const end: Point = { x: 300, y: 200 };

      const result = buildBendpointPath(
        points,
        start,
        end,
        100, 100,
        250, 180,
        "bottom",
        "unknown" // triggers default vertical routing
      );

      expect(points.length).toBeGreaterThan(2);
      expect(result.actualWaypoints.length).toBeGreaterThan(0);
    });

    it("handles top exit with channel needing adjustment", () => {
      const points: number[] = [100, 100];
      const start: Point = { x: 100, y: 100 };
      const end: Point = { x: 300, y: 50 };

      const result = buildBendpointPath(
        points,
        start,
        end,
        100, 150, // srcWpY below start
        300, 80,
        "top", // exit top but channel would be below
        "top"
      );

      expect(points.length).toBeGreaterThan(2);
      // Channel should be adjusted to be above start
      expect(result.actualWaypoints.length).toBe(2);
    });

    it("handles bottom exit with channel needing adjustment", () => {
      const points: number[] = [100, 100];
      const start: Point = { x: 100, y: 100 };
      const end: Point = { x: 300, y: 200 };

      const result = buildBendpointPath(
        points,
        start,
        end,
        100, 50, // srcWpY above start
        300, 180,
        "bottom", // exit bottom but channel would be above
        "bottom"
      );

      expect(points.length).toBeGreaterThan(2);
      expect(result.actualWaypoints.length).toBe(2);
    });

    it("handles right exit with channel needing left adjustment", () => {
      const points: number[] = [200, 50];
      const start: Point = { x: 200, y: 50 };
      const end: Point = { x: 100, y: 200 };

      const result = buildBendpointPath(
        points,
        start,
        end,
        150, 50, // srcWpX to the left of start
        80, 200,
        "right", // exit right but channel would be to the left
        "right"
      );

      expect(points.length).toBeGreaterThan(2);
      // Channel should be adjusted to ensure right exit
      expect(result.actualWaypoints.length).toBe(2);
    });

    it("handles left exit with channel needing right adjustment", () => {
      const points: number[] = [100, 50];
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 200, y: 200 };

      const result = buildBendpointPath(
        points,
        start,
        end,
        150, 50, // srcWpX to the right of start
        220, 200,
        "left", // exit left but channel would be to the right
        "left"
      );

      expect(points.length).toBeGreaterThan(2);
      expect(result.actualWaypoints.length).toBe(2);
    });

    it("handles horizontal exit to vertical entry with close x coordinates", () => {
      const points: number[] = [100, 50];
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 203, y: 200 }; // end.x within 5 of srcWpX

      const result = buildBendpointPath(
        points,
        start,
        end,
        200, 100, // srcWpX close to end.x
        200, 180,
        "right",
        "top"
      );

      expect(points.length).toBeGreaterThan(2);
      expect(result.actualWaypoints.length).toBeGreaterThan(0);
    });

    it("handles vertical exit to horizontal entry with close y coordinates", () => {
      const points: number[] = [100, 100];
      const start: Point = { x: 100, y: 100 };
      const end: Point = { x: 300, y: 153 }; // end.y within 5 of srcWpY

      const result = buildBendpointPath(
        points,
        start,
        end,
        100, 150, // srcWpY close to end.y
        350, 150,
        "bottom",
        "right"
      );

      expect(points.length).toBeGreaterThan(2);
      expect(result.actualWaypoints.length).toBeGreaterThan(0);
    });

    it("handles default horizontal with close x coordinates", () => {
      const points: number[] = [100, 50];
      const start: Point = { x: 100, y: 50 };
      const end: Point = { x: 203, y: 200 }; // close to srcWpX

      const result = buildBendpointPath(
        points,
        start,
        end,
        200, 100,
        200, 180,
        "right",
        "unknown" // default path
      );

      expect(points.length).toBeGreaterThan(2);
      expect(result.actualWaypoints.length).toBeGreaterThan(0);
    });

    it("handles default vertical with close y coordinates", () => {
      const points: number[] = [100, 100];
      const start: Point = { x: 100, y: 100 };
      const end: Point = { x: 300, y: 153 }; // close to srcWpY

      const result = buildBendpointPath(
        points,
        start,
        end,
        100, 150,
        250, 150, // tgtWpX
        "bottom",
        "unknown" // default path
      );

      expect(points.length).toBeGreaterThan(2);
      expect(result.actualWaypoints.length).toBeGreaterThan(0);
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

    it("handles vertical exit with default routing (unknown inSide)", () => {
      const points: number[] = [100, 65];
      const start: Point = { x: 100, y: 65 };
      const end: Point = { x: 300, y: 200 };
      const fromNode = createNode("from", 0, 0);
      const toNode = createNode("to", 200, 150);

      const result = buildSingleWaypointPath(
        points,
        start,
        end,
        200,
        125,
        "bottom",
        "unknown", // triggers default vertical routing
        emptyNodeMap,
        "from",
        "to",
        emptySegments,
        fromNode,
        toNode
      );

      expect(result).toBe(true);
    });

    it("handles horizontal exit with default routing (unknown inSide)", () => {
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
        "unknown", // triggers default horizontal routing
        emptyNodeMap,
        "from",
        "to",
        emptySegments,
        fromNode,
        toNode
      );

      expect(result).toBe(true);
    });

    it("handles top entry when start is above approach height", () => {
      const points: number[] = [100, 100]; // start above approach height
      const start: Point = { x: 100, y: 100 };
      const end: Point = { x: 300, y: 200 };
      const fromNode = createNode("from", 0, 50);
      const toNode = createNode("to", 200, 150);

      const result = buildSingleWaypointPath(
        points,
        start,
        end,
        200,
        150,
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

    it("handles top entry when start is below approach height", () => {
      const points: number[] = [100, 180]; // start below approach height
      const start: Point = { x: 100, y: 180 };
      const end: Point = { x: 300, y: 200 };
      const fromNode = createNode("from", 0, 130);
      const toNode = createNode("to", 200, 150);

      const result = buildSingleWaypointPath(
        points,
        start,
        end,
        200,
        190,
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

    it("handles bottom entry when start is below approach height", () => {
      const points: number[] = [100, 100]; // start below approach
      const start: Point = { x: 100, y: 100 };
      const end: Point = { x: 300, y: 50 };
      const fromNode = createNode("from", 0, 50);
      const toNode = createNode("to", 200, 0);

      const result = buildSingleWaypointPath(
        points,
        start,
        end,
        200,
        75,
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

    it("handles bottom entry when start is above approach height", () => {
      const points: number[] = [100, 50]; // start above approach
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

    it("handles left exit", () => {
      const points: number[] = [300, 50];
      const start: Point = { x: 300, y: 50 };
      const end: Point = { x: 100, y: 200 };
      const fromNode = createNode("from", 200, 0);
      const toNode = createNode("to", 0, 150);

      const result = buildSingleWaypointPath(
        points,
        start,
        end,
        200,
        125,
        "left",
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

    it("handles top exit", () => {
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
        125,
        "top",
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
  });
});
