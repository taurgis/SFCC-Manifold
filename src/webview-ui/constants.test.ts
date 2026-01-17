import { describe, it, expect } from "vitest";
import { getEdgeColor, isLoopBackEdge, EDGE_COLORS } from "./constants";

describe("getEdgeColor", () => {
  describe("error edges", () => {
    it("should return error color for 'error' label", () => {
      expect(getEdgeColor("error")).toBe(EDGE_COLORS.error);
      expect(getEdgeColor("ERROR")).toBe(EDGE_COLORS.error);
      expect(getEdgeColor("Error")).toBe(EDGE_COLORS.error);
    });

    it("should return error color for pipelet_error", () => {
      expect(getEdgeColor("pipelet_error")).toBe(EDGE_COLORS.pipelet_error);
      expect(getEdgeColor("PIPELET_ERROR")).toBe(EDGE_COLORS.pipelet_error);
    });

    it("should return error color for labels containing 'error'", () => {
      expect(getEdgeColor("validation_error")).toBe(EDGE_COLORS.error);
      expect(getEdgeColor("error_handler")).toBe(EDGE_COLORS.error);
    });
  });

  describe("loop edges", () => {
    it("should return loop color for 'do' label", () => {
      expect(getEdgeColor("do")).toBe(EDGE_COLORS.do);
      expect(getEdgeColor("DO")).toBe(EDGE_COLORS.do);
    });

    it("should return loop color for 'loop' label", () => {
      expect(getEdgeColor("loop")).toBe(EDGE_COLORS.loop);
      expect(getEdgeColor("LOOP")).toBe(EDGE_COLORS.loop);
    });

    it("should return loop color for labels containing 'iterate'", () => {
      expect(getEdgeColor("iterate")).toBe(EDGE_COLORS.iterate);
      expect(getEdgeColor("next_iteration")).toBe(EDGE_COLORS.loop);
    });
  });

  describe("decision edges", () => {
    it("should return yes/true color for 'yes' label", () => {
      expect(getEdgeColor("yes")).toBe(EDGE_COLORS.yes);
      expect(getEdgeColor("YES")).toBe(EDGE_COLORS.yes);
    });

    it("should return yes/true color for 'true' label", () => {
      expect(getEdgeColor("true")).toBe(EDGE_COLORS.true);
      expect(getEdgeColor("TRUE")).toBe(EDGE_COLORS.true);
    });

    it("should return no/false color for 'no' label", () => {
      expect(getEdgeColor("no")).toBe(EDGE_COLORS.no);
      expect(getEdgeColor("NO")).toBe(EDGE_COLORS.no);
    });

    it("should return no/false color for 'false' label", () => {
      expect(getEdgeColor("false")).toBe(EDGE_COLORS.false);
      expect(getEdgeColor("FALSE")).toBe(EDGE_COLORS.false);
    });
  });

  describe("success edges", () => {
    it("should return success color for labels containing 'success'", () => {
      expect(getEdgeColor("success")).toBe(EDGE_COLORS.success);
      expect(getEdgeColor("on_success")).toBe(EDGE_COLORS.success);
    });

    it("should return success color for 'pipelet_next'", () => {
      expect(getEdgeColor("pipelet_next")).toBe(EDGE_COLORS.pipelet_next);
    });

    it("should return success color for 'ok'", () => {
      expect(getEdgeColor("ok")).toBe(EDGE_COLORS.ok);
      expect(getEdgeColor("OK")).toBe(EDGE_COLORS.ok);
    });

    it("should return next color for 'next'", () => {
      expect(getEdgeColor("next")).toBe(EDGE_COLORS.next);
      expect(getEdgeColor("NEXT")).toBe(EDGE_COLORS.next);
    });
  });

  describe("default cases", () => {
    it("should return default color for null/undefined", () => {
      expect(getEdgeColor(null)).toBe(EDGE_COLORS.default);
      expect(getEdgeColor(undefined)).toBe(EDGE_COLORS.default);
    });

    it("should return default color for unknown labels", () => {
      expect(getEdgeColor("custom")).toBe(EDGE_COLORS.default);
      expect(getEdgeColor("something")).toBe(EDGE_COLORS.default);
    });
  });

  describe("label normalization", () => {
    it("should handle hyphens", () => {
      expect(getEdgeColor("pipelet-next")).toBe(EDGE_COLORS.pipelet_next);
      expect(getEdgeColor("pipelet-error")).toBe(EDGE_COLORS.error);
    });

    it("should handle underscores", () => {
      expect(getEdgeColor("pipelet_next")).toBe(EDGE_COLORS.pipelet_next);
    });
  });
});

describe("isLoopBackEdge", () => {
  it("should return true for 'loop' label", () => {
    expect(isLoopBackEdge("loop")).toBe(true);
    expect(isLoopBackEdge("LOOP")).toBe(true);
    expect(isLoopBackEdge("Loop")).toBe(true);
  });

  it("should return true for 'next_iteration' label", () => {
    expect(isLoopBackEdge("next_iteration")).toBe(true);
    expect(isLoopBackEdge("NEXT_ITERATION")).toBe(true);
  });

  it("should return false for non-loop labels", () => {
    expect(isLoopBackEdge("next")).toBe(false);
    expect(isLoopBackEdge("error")).toBe(false);
    expect(isLoopBackEdge("do")).toBe(false);
  });

  it("should return false for null/undefined", () => {
    expect(isLoopBackEdge(null)).toBe(false);
    expect(isLoopBackEdge(undefined)).toBe(false);
  });
});
