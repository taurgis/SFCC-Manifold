import { describe, it, expect } from "vitest";
import {
  normalizeLabel,
  isErrorEdge,
  inferExitSideFromBendpoints,
  inferEntrySideFromBendpoints,
  getSourceBendpoints,
  getTargetBendpoints,
} from "./edgeUtils";
import type { BendPoint } from "../types";

describe("normalizeLabel", () => {
  it("should return empty string for null/undefined", () => {
    expect(normalizeLabel(null)).toBe("");
    expect(normalizeLabel(undefined)).toBe("");
  });

  it("should convert to lowercase", () => {
    expect(normalizeLabel("ERROR")).toBe("error");
    expect(normalizeLabel("Yes")).toBe("yes");
    expect(normalizeLabel("PIPELET_NEXT")).toBe("pipelet_next");
  });

  it("should normalize spaces to underscores", () => {
    expect(normalizeLabel("pipelet error")).toBe("pipelet_error");
    expect(normalizeLabel("some label")).toBe("some_label");
  });

  it("should normalize hyphens to underscores", () => {
    expect(normalizeLabel("pipelet-error")).toBe("pipelet_error");
    expect(normalizeLabel("some-label")).toBe("some_label");
  });

  it("should handle mixed separators", () => {
    expect(normalizeLabel("pipelet-next error")).toBe("pipelet_next_error");
  });
});

describe("isErrorEdge", () => {
  it("should return true for error labels", () => {
    expect(isErrorEdge("error")).toBe(true);
    expect(isErrorEdge("ERROR")).toBe(true);
    expect(isErrorEdge("Error")).toBe(true);
  });

  it("should return true for pipelet_error", () => {
    expect(isErrorEdge("pipelet_error")).toBe(true);
    expect(isErrorEdge("PIPELET_ERROR")).toBe(true);
    expect(isErrorEdge("pipelet-error")).toBe(true);
  });

  it("should return true for labels containing error", () => {
    expect(isErrorEdge("validation_error")).toBe(true);
    expect(isErrorEdge("error_handler")).toBe(true);
  });

  it("should return false for non-error labels", () => {
    expect(isErrorEdge("next")).toBe(false);
    expect(isErrorEdge("yes")).toBe(false);
    expect(isErrorEdge("success")).toBe(false);
    expect(isErrorEdge(null)).toBe(false);
    expect(isErrorEdge(undefined)).toBe(false);
  });
});

describe("inferExitSideFromBendpoints", () => {
  it("should return null for empty/undefined bendpoints", () => {
    expect(inferExitSideFromBendpoints(undefined)).toBeNull();
    expect(inferExitSideFromBendpoints([])).toBeNull();
  });

  it("should return null when no source bendpoint exists", () => {
    const bendPoints: BendPoint[] = [{ relativeTo: "target", x: 1, y: 0 }];
    expect(inferExitSideFromBendpoints(bendPoints)).toBeNull();
  });

  it("should infer right exit for positive x", () => {
    const bendPoints: BendPoint[] = [{ relativeTo: "source", x: 2, y: 0 }];
    expect(inferExitSideFromBendpoints(bendPoints)).toBe("right");
  });

  it("should infer left exit for negative x", () => {
    const bendPoints: BendPoint[] = [{ relativeTo: "source", x: -2, y: 0 }];
    expect(inferExitSideFromBendpoints(bendPoints)).toBe("left");
  });

  it("should infer bottom exit for positive y (primarily vertical)", () => {
    const bendPoints: BendPoint[] = [{ relativeTo: "source", x: 0, y: 2 }];
    expect(inferExitSideFromBendpoints(bendPoints)).toBe("bottom");
  });

  it("should infer top exit for negative y (primarily vertical)", () => {
    const bendPoints: BendPoint[] = [{ relativeTo: "source", x: 0, y: -2 }];
    expect(inferExitSideFromBendpoints(bendPoints)).toBe("top");
  });

  it("should prefer horizontal for equal non-zero values", () => {
    const bendPoints: BendPoint[] = [{ relativeTo: "source", x: 1, y: 1 }];
    expect(inferExitSideFromBendpoints(bendPoints)).toBe("right");

    const bendPoints2: BendPoint[] = [{ relativeTo: "source", x: -1, y: -1 }];
    expect(inferExitSideFromBendpoints(bendPoints2)).toBe("left");
  });

  it("should return null for zero values", () => {
    const bendPoints: BendPoint[] = [{ relativeTo: "source", x: 0, y: 0 }];
    expect(inferExitSideFromBendpoints(bendPoints)).toBeNull();
  });
});

describe("inferEntrySideFromBendpoints", () => {
  it("should return null for empty/undefined bendpoints", () => {
    expect(inferEntrySideFromBendpoints(undefined)).toBeNull();
    expect(inferEntrySideFromBendpoints([])).toBeNull();
  });

  it("should return null when no target bendpoint exists", () => {
    const bendPoints: BendPoint[] = [{ relativeTo: "source", x: 1, y: 0 }];
    expect(inferEntrySideFromBendpoints(bendPoints)).toBeNull();
  });

  it("should infer right entry for positive x (coming from left)", () => {
    const bendPoints: BendPoint[] = [{ relativeTo: "target", x: 2, y: 0 }];
    expect(inferEntrySideFromBendpoints(bendPoints)).toBe("right");
  });

  it("should infer left entry for negative x (coming from right)", () => {
    const bendPoints: BendPoint[] = [{ relativeTo: "target", x: -2, y: 0 }];
    expect(inferEntrySideFromBendpoints(bendPoints)).toBe("left");
  });

  it("should infer bottom entry for positive y (coming from above)", () => {
    const bendPoints: BendPoint[] = [{ relativeTo: "target", x: 0, y: 2 }];
    expect(inferEntrySideFromBendpoints(bendPoints)).toBe("bottom");
  });

  it("should infer top entry for negative y (coming from below)", () => {
    const bendPoints: BendPoint[] = [{ relativeTo: "target", x: 0, y: -2 }];
    expect(inferEntrySideFromBendpoints(bendPoints)).toBe("top");
  });

  it("should prefer vertical for equal non-zero values", () => {
    const bendPoints: BendPoint[] = [{ relativeTo: "target", x: 1, y: 1 }];
    expect(inferEntrySideFromBendpoints(bendPoints)).toBe("bottom");

    const bendPoints2: BendPoint[] = [{ relativeTo: "target", x: -1, y: -1 }];
    expect(inferEntrySideFromBendpoints(bendPoints2)).toBe("top");
  });

  it("should return null for zero values", () => {
    const bendPoints: BendPoint[] = [{ relativeTo: "target", x: 0, y: 0 }];
    expect(inferEntrySideFromBendpoints(bendPoints)).toBeNull();
  });

  it("should use closest bendpoint when multiple target bendpoints exist", () => {
    // Multiple target bendpoints: (0,-2) and (0,-1)
    // Should use (0,-1) as it's closest to target
    const bendPoints: BendPoint[] = [
      { relativeTo: "target", x: 0, y: -2 },
      { relativeTo: "target", x: 0, y: -1 },
    ];
    expect(inferEntrySideFromBendpoints(bendPoints)).toBe("top");
  });
});

describe("getSourceBendpoints", () => {
  it("should return empty array for undefined/empty bendpoints", () => {
    expect(getSourceBendpoints(undefined)).toEqual([]);
    expect(getSourceBendpoints([])).toEqual([]);
  });

  it("should filter only source bendpoints", () => {
    const bendPoints: BendPoint[] = [
      { relativeTo: "source", x: 1, y: 0 },
      { relativeTo: "target", x: 0, y: -1 },
      { relativeTo: "source", x: 2, y: 1 },
    ];
    const result = getSourceBendpoints(bendPoints);
    expect(result).toHaveLength(2);
    expect(result.every(bp => bp.relativeTo === "source")).toBe(true);
  });

  it("should sort by distance from source (closest first)", () => {
    const bendPoints: BendPoint[] = [
      { relativeTo: "source", x: 3, y: 0 }, // distance 3
      { relativeTo: "source", x: 1, y: 0 }, // distance 1
      { relativeTo: "source", x: 2, y: 1 }, // distance 3
    ];
    const result = getSourceBendpoints(bendPoints);
    expect(result[0].x).toBe(1);
    expect(result[0].y).toBe(0);
  });
});

describe("getTargetBendpoints", () => {
  it("should return empty array for undefined/empty bendpoints", () => {
    expect(getTargetBendpoints(undefined)).toEqual([]);
    expect(getTargetBendpoints([])).toEqual([]);
  });

  it("should filter only target bendpoints", () => {
    const bendPoints: BendPoint[] = [
      { relativeTo: "source", x: 1, y: 0 },
      { relativeTo: "target", x: 0, y: -1 },
      { relativeTo: "target", x: 0, y: -2 },
    ];
    const result = getTargetBendpoints(bendPoints);
    expect(result).toHaveLength(2);
    expect(result.every(bp => bp.relativeTo === "target")).toBe(true);
  });

  it("should sort by distance from target (closest first)", () => {
    const bendPoints: BendPoint[] = [
      { relativeTo: "target", x: 0, y: -2 }, // distance 2
      { relativeTo: "target", x: 0, y: -1 }, // distance 1
    ];
    const result = getTargetBendpoints(bendPoints);
    expect(result[0].y).toBe(-1);
    expect(result[1].y).toBe(-2);
  });
});
