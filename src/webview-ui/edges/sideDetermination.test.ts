import { describe, it, expect, beforeEach } from "vitest";
import {
  determineSides,
  determineSidesFromNodeMap,
  determineSidesFromMap,
  setDebugLogging,
} from "./sideDetermination";
import type { PlacedNode, PipelineEdge } from "../types";
import { LAYOUT_CONFIG } from "../constants";

const { nodeWidth, nodeHeight, horizontalGap, verticalGap } = LAYOUT_CONFIG;

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

// Helper to create a mock edge
function createEdge(
  from: string,
  to: string,
  options: Partial<PipelineEdge> = {}
): PipelineEdge {
  return {
    from,
    to,
    ...options,
  };
}

describe("determineSides", () => {
  beforeEach(() => {
    setDebugLogging(false);
  });

  describe("basic vertical routing (bottom to top)", () => {
    it("should route bottom-to-top for target directly below", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100, 100 + verticalGap);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("bottom");
      expect(result.inSide).toBe("top");
    });
  });

  describe("horizontal routing", () => {
    it("should route right-to-left for target to the right", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100 + horizontalGap, 100);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("right");
      expect(result.inSide).toBe("left");
    });

    it("should route left-to-right for target to the left", () => {
      const from = createNode("n1", 100 + horizontalGap, 100);
      const to = createNode("n2", 100, 100);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("left");
      expect(result.inSide).toBe("right");
    });
  });

  describe("error edge routing", () => {
    it("should exit from right for error edges", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100 + horizontalGap, 100 + verticalGap);
      const edge = createEdge("n1", "n2", { label: "error" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("right");
    });

    it("should exit from right for pipelet_error connector", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100 + horizontalGap, 100 + verticalGap);
      const edge = createEdge("n1", "n2", { sourceConnector: "pipelet_error" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("right");
    });
  });

  describe("decision node routing (yes/no)", () => {
    it("should exit right for 'yes' connector when target not directly below", () => {
      const from = createNode("n1", 100, 100, "decision");
      const to = createNode("n2", 100 + horizontalGap, 100 + verticalGap);
      const edge = createEdge("n1", "n2", { sourceConnector: "yes" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("right");
    });

    it("should exit left for 'no' connector when target not directly below", () => {
      const from = createNode("n1", 100, 100, "decision");
      const to = createNode("n2", 100 - horizontalGap, 100 + verticalGap);
      const edge = createEdge("n1", "n2", { sourceConnector: "no" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("left");
    });

    it("should exit bottom for 'yes' when target directly below with no blockers", () => {
      const from = createNode("n1", 100, 100, "decision");
      const to = createNode("n2", 100, 100 + verticalGap);
      const edge = createEdge("n1", "n2", { sourceConnector: "yes" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("bottom");
    });
  });

  describe("join node entry routing", () => {
    it("should enter join from left when approaching from the left", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100 + horizontalGap * 2, 100 + verticalGap, "join");
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("left");
    });

    it("should enter join from right when approaching from the right", () => {
      const from = createNode("n1", 100 + horizontalGap * 2, 100);
      const to = createNode("n2", 100, 100 + verticalGap, "join");
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("right");
    });

    it("should enter join from top when approaching from directly above", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100, 100 + verticalGap * 2, "join");
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("top");
    });
  });

  describe("bendpoint-based routing", () => {
    it("should use bendpoint hints for exit side", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100, 100 + verticalGap);
      const edge = createEdge("n1", "n2", {
        display: {
          bendPoints: [{ relativeTo: "source", x: 2, y: 0 }],
        },
      });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("right");
    });

    it("should use bendpoint hints for entry side", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100, 100 + verticalGap);
      const edge = createEdge("n1", "n2", {
        display: {
          bendPoints: [{ relativeTo: "target", x: -2, y: 0 }],
        },
      });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("left");
    });
  });

  describe("blocking node detection", () => {
    it("should detect blocking nodes and adjust routing", () => {
      const from = createNode("n1", 100, 100);
      const blocker = createNode("blocker", 100, 100 + verticalGap);
      const to = createNode("n2", 100, 100 + verticalGap * 2);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = {
        n1: from,
        blocker: blocker,
        n2: to,
      };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.blockingNode).toBeDefined();
    });
  });

  describe("back edge routing (target above source)", () => {
    it("should adjust for target above source", () => {
      const from = createNode("n1", 100, 100 + verticalGap);
      const to = createNode("n2", 100, 100);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      // Should not exit from bottom when target is above
      expect(result.outSide).toBe("top");
    });
  });

  describe("target connector hints", () => {
    it("should respect 'loop' target connector", () => {
      const from = createNode("n1", 100, 100 + verticalGap);
      const to = createNode("n2", 100, 100, "loop");
      const edge = createEdge("n1", "n2", { targetConnector: "loop" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      // Loop connector typically enters from top
      expect(result.inSide).toBe("top");
    });

    it("should respect 'in' target connector when routing straight down", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100, 100 + verticalGap); // Directly below
      const edge = createEdge("n1", "n2", { targetConnector: "in" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("top");
    });

    it("should respect 'in1' target connector when routing straight down", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100, 100 + verticalGap); // Directly below
      const edge = createEdge("n1", "n2", { targetConnector: "in1" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("top");
    });

    it("should respect 'in2' target connector when routing straight down", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100, 100 + verticalGap); // Directly below
      const edge = createEdge("n1", "n2", { targetConnector: "in2" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("top");
    });

    it("should respect 'left' target connector", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100 + horizontalGap, 100 + verticalGap);
      const edge = createEdge("n1", "n2", { targetConnector: "left" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("left");
    });

    it("should respect 'right' target connector", () => {
      const from = createNode("n1", 100 + horizontalGap, 100);
      const to = createNode("n2", 100, 100 + verticalGap);
      const edge = createEdge("n1", "n2", { targetConnector: "right" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("right");
    });

    it("should respect 'bottom' target connector", () => {
      const from = createNode("n1", 100, 100 + verticalGap);
      const to = createNode("n2", 100, 100);
      const edge = createEdge("n1", "n2", { targetConnector: "bottom" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("bottom");
    });

    it("should default to 'top' for unknown target connector when routing straight down", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100, 100 + verticalGap); // Directly below
      const edge = createEdge("n1", "n2", { targetConnector: "unknown" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("top");
    });
  });

  describe("smart exit side defaults", () => {
    it("should enter from left for outSide right with target to the right and above", () => {
      const from = createNode("n1", 100, 100 + verticalGap * 2);
      const to = createNode("n2", 100 + horizontalGap * 2, 100);
      const edge = createEdge("n1", "n2", { sourceConnector: "error" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("right");
      // Smart routing enters from left for target to the right
      expect(result.inSide).toBe("left");
    });

    it("should enter from right for outSide left with target to the left and above", () => {
      const from = createNode("n1", 100 + horizontalGap * 2, 100 + verticalGap * 2);
      const to = createNode("n2", 100, 100);
      const edge = createEdge("n1", "n2", { sourceConnector: "no" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("left");
      // Smart routing enters from right for target to the left
      expect(result.inSide).toBe("right");
    });

    it("should enter from left for outSide right with target to the right and below", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100 + horizontalGap * 2, 100 + verticalGap * 2);
      const edge = createEdge("n1", "n2", { sourceConnector: "error" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("right");
      // Smart routing enters from left for target to the right
      expect(result.inSide).toBe("left");
    });

    it("should enter from right for outSide left with target to the left and below", () => {
      const from = createNode("n1", 100 + horizontalGap * 2, 100);
      const to = createNode("n2", 100, 100 + verticalGap * 2);
      const edge = createEdge("n1", "n2", { sourceConnector: "no" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("left");
      // Smart routing enters from right for target to the left
      expect(result.inSide).toBe("right");
    });
  });

  describe("join node horizontal approach when exiting vertically", () => {
    it("should prefer horizontal entry when exiting vertically with significant horizontal offset to the right", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100 + nodeWidth * 2, 100 + verticalGap, "join");
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("left");
    });

    it("should prefer horizontal entry when exiting vertically with significant horizontal offset to the left", () => {
      const from = createNode("n1", 100 + nodeWidth * 2, 100);
      const to = createNode("n2", 100, 100 + verticalGap, "join");
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("right");
    });
  });

  describe("join node routing - vertical dominant", () => {
    it("should enter join from bottom when approaching from below", () => {
      const from = createNode("n1", 100, 100 + verticalGap * 3);
      const to = createNode("n2", 100, 100, "join");
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("bottom");
    });

    it("should enter join from top when nearly aligned and target below", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100 + nodeWidth * 0.2, 100 + verticalGap * 2, "join");
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("top");
    });

    it("should enter join from bottom when nearly aligned and target above", () => {
      const from = createNode("n1", 100, 100 + verticalGap * 2);
      const to = createNode("n2", 100 + nodeWidth * 0.2, 100, "join");
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("bottom");
    });
  });

  describe("join node routing - mixed cases", () => {
    it("should enter join from left for mixed case with positive dx", () => {
      // Create a scenario where neither horizontal nor vertical is dominant
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100 + nodeWidth * 0.8, 100 + nodeHeight * 0.8, "join");
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      // Should use left entry for dx > 0
      expect(result.inSide).toBe("left");
    });

    it("should enter join from right for mixed case with negative dx", () => {
      const from = createNode("n1", 100 + nodeWidth * 0.8, 100);
      const to = createNode("n2", 100, 100 + nodeHeight * 0.8, "join");
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      // Should use right entry for dx < 0
      expect(result.inSide).toBe("right");
    });
  });

  describe("join node routing - horizontal dominant", () => {
    it("should enter from top when horizontally centered on same row", () => {
      // Target is horizontally centered but on the same row
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100, 100 + nodeHeight * 0.3, "join");
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("top");
    });
  });

  describe("blocking node handling", () => {
    it("should route around blocker to the right when target is to the right", () => {
      const from = createNode("n1", 100, 100);
      const blocker = createNode("blocker", 100, 100 + verticalGap);
      const to = createNode("n2", 100 + horizontalGap, 100 + verticalGap * 2);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = {
        n1: from,
        blocker: blocker,
        n2: to,
      };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.blockingNode).toBe(blocker);
      expect(result.outSide).toBe("right");
    });

    it("should route around blocker to the left when target is to the left", () => {
      const from = createNode("n1", 100 + horizontalGap, 100);
      const blocker = createNode("blocker", 100 + horizontalGap, 100 + verticalGap);
      const to = createNode("n2", 100, 100 + verticalGap * 2);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = {
        n1: from,
        blocker: blocker,
        n2: to,
      };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.blockingNode).toBe(blocker);
      expect(result.outSide).toBe("left");
    });

    it("should default to left when blocker exists and target is centered", () => {
      const from = createNode("n1", 100, 100);
      const blocker = createNode("blocker", 100, 100 + verticalGap);
      const to = createNode("n2", 100, 100 + verticalGap * 2);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = {
        n1: from,
        blocker: blocker,
        n2: to,
      };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.blockingNode).toBe(blocker);
      expect(result.outSide).toBe("left");
    });

    it("should enter from left when blocker exists and target to the right", () => {
      const from = createNode("n1", 100, 100);
      const blocker = createNode("blocker", 100, 100 + verticalGap);
      const to = createNode("n2", 100 + horizontalGap, 100 + verticalGap * 2);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = {
        n1: from,
        blocker: blocker,
        n2: to,
      };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("left");
    });

    it("should enter from right when blocker exists and target to the left", () => {
      const from = createNode("n1", 100 + horizontalGap, 100);
      const blocker = createNode("blocker", 100 + horizontalGap, 100 + verticalGap);
      const to = createNode("n2", 100, 100 + verticalGap * 2);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = {
        n1: from,
        blocker: blocker,
        n2: to,
      };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("right");
    });

    it("should enter from left when blocker exists and target centered", () => {
      const from = createNode("n1", 100, 100);
      const blocker = createNode("blocker", 100, 100 + verticalGap);
      const to = createNode("n2", 100, 100 + verticalGap * 2);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = {
        n1: from,
        blocker: blocker,
        n2: to,
      };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.inSide).toBe("left");
    });
  });

  describe("non-join target routing adjustments", () => {
    it("should change to horizontal routing when target is on the same row and exiting bottom", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100 + horizontalGap * 2, 100 + nodeHeight * 0.3);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("right");
      expect(result.inSide).toBe("left");
    });

    it("should change to horizontal routing when target is primarily to the side without blocker", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100 + horizontalGap * 3, 100 + verticalGap);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("right");
      expect(result.inSide).toBe("left");
    });

    it("should enter from right when exiting bottom and source is to the right of target", () => {
      const from = createNode("n1", 100 + horizontalGap * 2, 100);
      const to = createNode("n2", 100, 100 + verticalGap);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      // Target is to the left, so we should route left-to-right
      expect(result.outSide).toBe("left");
      expect(result.inSide).toBe("right");
    });

    it("should enter from left when exiting bottom and source is to the left of target", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100 + horizontalGap * 2, 100 + verticalGap);
      const edge = createEdge("n1", "n2");
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      // Target is to the right, so we should route right-to-left
      expect(result.outSide).toBe("right");
      expect(result.inSide).toBe("left");
    });
  });

  describe("connector 'true' and 'false' handling", () => {
    it("should exit right for 'true' connector when target not directly below", () => {
      const from = createNode("n1", 100, 100, "decision");
      const to = createNode("n2", 100 + horizontalGap, 100 + verticalGap);
      const edge = createEdge("n1", "n2", { sourceConnector: "true" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("right");
    });

    it("should exit left for 'false' connector when target not directly below", () => {
      const from = createNode("n1", 100, 100, "decision");
      const to = createNode("n2", 100 - horizontalGap, 100 + verticalGap);
      const edge = createEdge("n1", "n2", { sourceConnector: "false" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("left");
    });

    it("should exit bottom for 'false' when target directly below with no blockers", () => {
      const from = createNode("n1", 100, 100, "decision");
      const to = createNode("n2", 100, 100 + verticalGap);
      const edge = createEdge("n1", "n2", { sourceConnector: "false" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("bottom");
    });
  });

  describe("error connector handling", () => {
    it("should exit right for 'error' source connector", () => {
      const from = createNode("n1", 100, 100);
      const to = createNode("n2", 100 + horizontalGap, 100 + verticalGap);
      const edge = createEdge("n1", "n2", { sourceConnector: "error" });
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("right");
    });
  });

  describe("back edge with existing exit/entry adjustments", () => {
    it("should route from right to left when target above and to the right", () => {
      const from = createNode("n1", 100, 100 + verticalGap * 2);
      const to = createNode("n2", 100 + horizontalGap, 100);
      const edge = createEdge("n1", "n2", { sourceConnector: "error" }); // Force right exit
      const nodeMap: Record<string, PlacedNode> = { n1: from, n2: to };

      const result = determineSidesFromNodeMap(edge, from, to, nodeMap);

      expect(result.outSide).toBe("right");
      // When target is above and to the right, smart routing enters from left
      expect(result.inSide).toBe("left");
    });
  });
});

describe("determineSidesFromMap", () => {
  it("should work with Map<string, PlacedNode>", () => {
    const from = createNode("n1", 100, 100);
    const to = createNode("n2", 100, 100 + verticalGap);
    const edge = createEdge("n1", "n2");
    const nodeMap = new Map<string, PlacedNode>([
      ["n1", from],
      ["n2", to],
    ]);

    const result = determineSidesFromMap(edge, from, to, nodeMap);

    expect(result.outSide).toBe("bottom");
    expect(result.inSide).toBe("top");
  });
});

describe("setDebugLogging", () => {
  it("should enable and disable debug logging without errors", () => {
    expect(() => setDebugLogging(true)).not.toThrow();
    expect(() => setDebugLogging(false)).not.toThrow();
  });
});
