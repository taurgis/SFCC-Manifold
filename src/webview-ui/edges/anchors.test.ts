import { describe, it, expect } from "vitest";
import {
  getAnchor,
  getAnchorPoint,
  getArrowAngleForSide,
  calculateArrowAngleFromPoints,
  sideVector,
  nudgePoint,
  JOIN_RADIUS,
} from "./anchors";
import type { PlacedNode } from "../types";
import { LAYOUT_CONFIG } from "../constants";

const { nodeWidth, nodeHeight } = LAYOUT_CONFIG;

// Helper to create a mock placed node
function createMockNode(x: number, y: number, type: string = "pipelet"): PlacedNode {
  return {
    id: "test",
    label: "Test",
    type: type as PlacedNode["type"],
    branch: "Start",
    attributes: {},
    x,
    y,
  };
}

describe("getAnchor", () => {
  describe("regular nodes", () => {
    it("should return top anchor point", () => {
      const node = createMockNode(100, 100);
      const anchor = getAnchor(node, "top", 0);

      expect(anchor.x).toBe(100 + nodeWidth / 2);
      expect(anchor.y).toBe(100);
    });

    it("should return bottom anchor point", () => {
      const node = createMockNode(100, 100);
      const anchor = getAnchor(node, "bottom", 0);

      expect(anchor.x).toBe(100 + nodeWidth / 2);
      expect(anchor.y).toBe(100 + nodeHeight);
    });

    it("should return left anchor point", () => {
      const node = createMockNode(100, 100);
      const anchor = getAnchor(node, "left", 0);

      expect(anchor.x).toBe(100);
      expect(anchor.y).toBe(100 + nodeHeight / 2);
    });

    it("should return right anchor point", () => {
      const node = createMockNode(100, 100);
      const anchor = getAnchor(node, "right", 0);

      expect(anchor.x).toBe(100 + nodeWidth);
      expect(anchor.y).toBe(100 + nodeHeight / 2);
    });

    it("should apply horizontal offset for vertical sides", () => {
      const node = createMockNode(100, 100);
      const anchor = getAnchor(node, "top", 10);

      expect(anchor.x).toBe(100 + nodeWidth / 2 + 10);
      expect(anchor.y).toBe(100);
    });

    it("should apply vertical offset for horizontal sides", () => {
      const node = createMockNode(100, 100);
      const anchor = getAnchor(node, "left", 10);

      expect(anchor.x).toBe(100);
      expect(anchor.y).toBe(100 + nodeHeight / 2 + 10);
    });
  });

  describe("join nodes", () => {
    it("should return circular anchor for top side", () => {
      const node = createMockNode(100, 100, "join");
      const anchor = getAnchor(node, "top", 0);

      const centerX = 100 + nodeWidth / 2;
      const centerY = 100 + nodeHeight / 2;
      expect(anchor.x).toBe(centerX);
      expect(anchor.y).toBe(centerY - JOIN_RADIUS);
    });

    it("should return circular anchor for bottom side", () => {
      const node = createMockNode(100, 100, "join");
      const anchor = getAnchor(node, "bottom", 0);

      const centerX = 100 + nodeWidth / 2;
      const centerY = 100 + nodeHeight / 2;
      expect(anchor.x).toBe(centerX);
      expect(anchor.y).toBe(centerY + JOIN_RADIUS);
    });

    it("should return circular anchor for left side", () => {
      const node = createMockNode(100, 100, "join");
      const anchor = getAnchor(node, "left", 0);

      const centerX = 100 + nodeWidth / 2;
      const centerY = 100 + nodeHeight / 2;
      expect(anchor.x).toBe(centerX - JOIN_RADIUS);
      expect(anchor.y).toBe(centerY);
    });

    it("should return circular anchor for right side", () => {
      const node = createMockNode(100, 100, "join");
      const anchor = getAnchor(node, "right", 0);

      const centerX = 100 + nodeWidth / 2;
      const centerY = 100 + nodeHeight / 2;
      expect(anchor.x).toBe(centerX + JOIN_RADIUS);
      expect(anchor.y).toBe(centerY);
    });
  });
});

describe("getAnchorPoint", () => {
  it("should return anchor without offset", () => {
    const node = createMockNode(100, 100);
    const anchor = getAnchorPoint(node, "top");

    expect(anchor.x).toBe(100 + nodeWidth / 2);
    expect(anchor.y).toBe(100);
  });
});

describe("getArrowAngleForSide", () => {
  it("should return downward angle for top entry", () => {
    const angle = getArrowAngleForSide("top");
    expect(angle).toBe(Math.PI / 2); // 90 degrees
  });

  it("should return upward angle for bottom entry", () => {
    const angle = getArrowAngleForSide("bottom");
    expect(angle).toBe(-Math.PI / 2); // -90 degrees
  });

  it("should return rightward angle for left entry", () => {
    const angle = getArrowAngleForSide("left");
    expect(angle).toBe(0); // 0 degrees
  });

  it("should return leftward angle for right entry", () => {
    const angle = getArrowAngleForSide("right");
    expect(angle).toBe(Math.PI); // 180 degrees
  });
});

describe("calculateArrowAngleFromPoints", () => {
  it("should return 0 for insufficient points", () => {
    expect(calculateArrowAngleFromPoints([])).toBe(0);
    expect(calculateArrowAngleFromPoints([0, 0])).toBe(0);
  });

  it("should calculate angle for rightward movement", () => {
    const points = [0, 0, 100, 0];
    const angle = calculateArrowAngleFromPoints(points);
    expect(angle).toBeCloseTo(0, 5);
  });

  it("should calculate angle for downward movement", () => {
    const points = [0, 0, 0, 100];
    const angle = calculateArrowAngleFromPoints(points);
    expect(angle).toBeCloseTo(Math.PI / 2, 5);
  });

  it("should calculate angle for leftward movement", () => {
    const points = [100, 0, 0, 0];
    const angle = calculateArrowAngleFromPoints(points);
    expect(angle).toBeCloseTo(Math.PI, 5);
  });

  it("should calculate angle for upward movement", () => {
    const points = [0, 100, 0, 0];
    const angle = calculateArrowAngleFromPoints(points);
    expect(angle).toBeCloseTo(-Math.PI / 2, 5);
  });

  it("should use last segment direction for multi-segment paths", () => {
    // Path: right, then down
    const points = [0, 0, 100, 0, 100, 100];
    const angle = calculateArrowAngleFromPoints(points);
    expect(angle).toBeCloseTo(Math.PI / 2, 5); // Should be downward
  });

  it("should skip duplicate endpoints", () => {
    const points = [0, 0, 100, 0, 100, 100, 100, 100];
    const angle = calculateArrowAngleFromPoints(points);
    expect(angle).toBeCloseTo(Math.PI / 2, 5);
  });
});

describe("sideVector", () => {
  it("should return upward vector for top", () => {
    const v = sideVector("top");
    expect(v).toEqual({ x: 0, y: -1 });
  });

  it("should return downward vector for bottom", () => {
    const v = sideVector("bottom");
    expect(v).toEqual({ x: 0, y: 1 });
  });

  it("should return leftward vector for left", () => {
    const v = sideVector("left");
    expect(v).toEqual({ x: -1, y: 0 });
  });

  it("should return rightward vector for right", () => {
    const v = sideVector("right");
    expect(v).toEqual({ x: 1, y: 0 });
  });

  it("should default to right for unknown side", () => {
    const v = sideVector("unknown");
    expect(v).toEqual({ x: 1, y: 0 });
  });
});

describe("nudgePoint", () => {
  it("should nudge point upward for top side", () => {
    const result = nudgePoint({ x: 100, y: 100 }, "top", 10);
    expect(result).toEqual({ x: 100, y: 90 });
  });

  it("should nudge point downward for bottom side", () => {
    const result = nudgePoint({ x: 100, y: 100 }, "bottom", 10);
    expect(result).toEqual({ x: 100, y: 110 });
  });

  it("should nudge point leftward for left side", () => {
    const result = nudgePoint({ x: 100, y: 100 }, "left", 10);
    expect(result).toEqual({ x: 90, y: 100 });
  });

  it("should nudge point rightward for right side", () => {
    const result = nudgePoint({ x: 100, y: 100 }, "right", 10);
    expect(result).toEqual({ x: 110, y: 100 });
  });

  it("should handle zero distance", () => {
    const result = nudgePoint({ x: 100, y: 100 }, "top", 0);
    expect(result).toEqual({ x: 100, y: 100 });
  });

  it("should handle negative distance", () => {
    const result = nudgePoint({ x: 100, y: 100 }, "top", -10);
    expect(result).toEqual({ x: 100, y: 110 });
  });
});
