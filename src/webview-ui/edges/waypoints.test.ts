/**
 * Tests for waypoints.ts
 *
 * Tests waypoint filtering and validation functions.
 */

import { describe, it, expect } from "vitest";
import { isWaypointMeaningful, filterOnPathWaypoints } from "./waypoints";
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

describe("waypoints", () => {
  describe("isWaypointMeaningful", () => {
    const nodeMap: Record<string, PlacedNode> = {
      source: createNode("source", 0, 0),
      target: createNode("target", 400, 200),
    };

    // Path with a corner at (200, 0) and (200, 200)
    // Start: (100, 32.5), Corner1: (200, 32.5), Corner2: (200, 200), End: (400, 200)
    const pathWithCorners = [100, 32.5, 200, 32.5, 200, 200, 400, 200];

    it("returns true for waypoint near a corner", () => {
      // Waypoint near the first corner (200, 32.5)
      const waypoint: Point = { x: 200, y: 32.5 };
      expect(isWaypointMeaningful(waypoint, pathWithCorners, nodeMap)).toBe(
        true
      );
    });

    it("returns true for waypoint within tolerance of corner", () => {
      // Waypoint within 20px tolerance
      const waypoint: Point = { x: 210, y: 40 };
      expect(isWaypointMeaningful(waypoint, pathWithCorners, nodeMap)).toBe(
        true
      );
    });

    it("returns false for waypoint far from corners", () => {
      // Waypoint not near any corner
      const waypoint: Point = { x: 300, y: 100 };
      expect(isWaypointMeaningful(waypoint, pathWithCorners, nodeMap)).toBe(
        false
      );
    });

    it("returns false for waypoint inside a node", () => {
      // Waypoint inside source node
      const waypoint: Point = { x: 100, y: 32.5 }; // Inside source node
      expect(isWaypointMeaningful(waypoint, pathWithCorners, nodeMap)).toBe(
        false
      );
    });

    it("returns false for waypoint near start point (excluded)", () => {
      // Start point is not a corner - only interior points are
      const straightPath = [0, 0, 100, 0]; // No corners
      const waypoint: Point = { x: 5, y: 0 };
      expect(isWaypointMeaningful(waypoint, straightPath, nodeMap)).toBe(false);
    });

    it("returns false for waypoint near end point (excluded)", () => {
      const waypoint: Point = { x: 395, y: 200 };
      expect(isWaypointMeaningful(waypoint, pathWithCorners, nodeMap)).toBe(
        false
      );
    });

    it("returns false for path with fewer than 3 points", () => {
      // Path with only 2 points (4 values)
      const shortPath = [0, 0, 100, 100];
      const waypoint: Point = { x: 50, y: 50 };
      expect(isWaypointMeaningful(waypoint, shortPath, nodeMap)).toBe(false);
    });

    it("respects custom tolerance", () => {
      const waypoint: Point = { x: 230, y: 32.5 }; // 30px from corner
      expect(
        isWaypointMeaningful(waypoint, pathWithCorners, nodeMap, 20)
      ).toBe(false);
      expect(
        isWaypointMeaningful(waypoint, pathWithCorners, nodeMap, 35)
      ).toBe(true);
    });

    it("handles path with multiple corners", () => {
      // Path: Start → Corner1 → Corner2 → Corner3 → End
      const multiCornerPath = [0, 0, 100, 0, 100, 100, 200, 100, 200, 200];
      const emptyNodeMap: Record<string, PlacedNode> = {};

      // Near first corner (100, 0)
      expect(
        isWaypointMeaningful({ x: 100, y: 5 }, multiCornerPath, emptyNodeMap)
      ).toBe(true);
      // Near second corner (100, 100)
      expect(
        isWaypointMeaningful({ x: 105, y: 100 }, multiCornerPath, emptyNodeMap)
      ).toBe(true);
      // Near third corner (200, 100)
      expect(
        isWaypointMeaningful({ x: 200, y: 95 }, multiCornerPath, emptyNodeMap)
      ).toBe(true);
    });
  });

  describe("filterOnPathWaypoints", () => {
    const nodeMap: Record<string, PlacedNode> = {
      source: createNode("source", 0, 0),
      target: createNode("target", 400, 200),
    };

    const pathWithCorners = [100, 32.5, 200, 32.5, 200, 200, 400, 200];

    it("filters out waypoints inside nodes", () => {
      const waypoints: Point[] = [
        { x: 50, y: 32.5 }, // Inside source node
        { x: 200, y: 32.5 }, // Near corner (valid)
      ];
      const result = filterOnPathWaypoints(waypoints, pathWithCorners, nodeMap);
      expect(result.length).toBe(1);
      expect(result[0]).toEqual({ x: 200, y: 32.5 });
    });

    it("filters out waypoints far from corners", () => {
      const waypoints: Point[] = [
        { x: 150, y: 32.5 }, // Along straight segment, not at corner
        { x: 200, y: 32.5 }, // Near corner (valid)
        { x: 300, y: 200 }, // Along straight segment, not at corner
      ];
      const result = filterOnPathWaypoints(waypoints, pathWithCorners, nodeMap);
      expect(result.length).toBe(1);
    });

    it("returns empty array when all waypoints are invalid", () => {
      const waypoints: Point[] = [
        { x: 50, y: 32.5 }, // Inside node
        { x: 150, y: 32.5 }, // Not near corner
      ];
      const result = filterOnPathWaypoints(waypoints, pathWithCorners, nodeMap);
      expect(result.length).toBe(0);
    });

    it("returns all waypoints when all are valid", () => {
      const emptyNodeMap: Record<string, PlacedNode> = {};
      const waypoints: Point[] = [
        { x: 200, y: 32.5 }, // Near first corner
        { x: 200, y: 200 }, // Near second corner
      ];
      const result = filterOnPathWaypoints(
        waypoints,
        pathWithCorners,
        emptyNodeMap
      );
      expect(result.length).toBe(2);
    });

    it("handles empty waypoints array", () => {
      const result = filterOnPathWaypoints([], pathWithCorners, nodeMap);
      expect(result).toEqual([]);
    });

    it("handles empty path points", () => {
      const waypoints: Point[] = [{ x: 100, y: 100 }];
      const result = filterOnPathWaypoints(waypoints, [], nodeMap);
      expect(result).toEqual([]);
    });

    it("preserves order of valid waypoints", () => {
      const emptyNodeMap: Record<string, PlacedNode> = {};
      const waypoints: Point[] = [
        { x: 200, y: 200 }, // Near second corner
        { x: 200, y: 32.5 }, // Near first corner
      ];
      const result = filterOnPathWaypoints(
        waypoints,
        pathWithCorners,
        emptyNodeMap
      );
      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ x: 200, y: 200 });
      expect(result[1]).toEqual({ x: 200, y: 32.5 });
    });
  });
});
