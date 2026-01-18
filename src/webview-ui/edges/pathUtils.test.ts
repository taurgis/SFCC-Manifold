/**
 * Tests for pathUtils.ts
 *
 * Tests path building utility functions.
 */

import { describe, it, expect } from "vitest";
import { ensureMinFinalSegment } from "./pathUtils";

describe("pathUtils", () => {
  describe("ensureMinFinalSegment", () => {
    const minFinalSegment = 25;

    describe("vertical final segment", () => {
      it("extends short vertical segment going down", () => {
        // Final segment: vertical, going down, only 10px
        const points = [100, 0, 100, 50, 100, 60]; // Last segment: (100,50) to (100,60)

        ensureMinFinalSegment(points);

        // Should extend the previous point upward
        const prevY = points[points.length - 3];
        const lastY = points[points.length - 1];
        expect(lastY - prevY).toBeGreaterThanOrEqual(minFinalSegment);
      });

      it("extends short vertical segment going up", () => {
        // Final segment: vertical, going up, only 10px
        const points = [100, 100, 100, 50, 100, 40]; // Last segment: (100,50) to (100,40)

        ensureMinFinalSegment(points);

        // Should extend the previous point downward
        const prevY = points[points.length - 3];
        const lastY = points[points.length - 1];
        expect(prevY - lastY).toBeGreaterThanOrEqual(minFinalSegment);
      });

      it("does not modify segment already at minimum length", () => {
        const points = [100, 0, 100, 50, 100, 75]; // 25px segment
        const originalPrevY = points[3];

        ensureMinFinalSegment(points);

        expect(points[3]).toBe(originalPrevY);
      });

      it("does not modify segment longer than minimum", () => {
        const points = [100, 0, 100, 50, 100, 100]; // 50px segment
        const originalPoints = [...points];

        ensureMinFinalSegment(points);

        expect(points).toEqual(originalPoints);
      });
    });

    describe("horizontal final segment", () => {
      it("extends short horizontal segment going right", () => {
        // Final segment: horizontal, going right, only 10px
        const points = [0, 100, 50, 100, 60, 100]; // Last segment: (50,100) to (60,100)

        ensureMinFinalSegment(points);

        // Should extend the previous point leftward
        const prevX = points[points.length - 4];
        const lastX = points[points.length - 2];
        expect(lastX - prevX).toBeGreaterThanOrEqual(minFinalSegment);
      });

      it("extends short horizontal segment going left", () => {
        // Final segment: horizontal, going left, only 10px
        const points = [100, 100, 50, 100, 40, 100]; // Last segment: (50,100) to (40,100)

        ensureMinFinalSegment(points);

        // Should extend the previous point rightward
        const prevX = points[points.length - 4];
        const lastX = points[points.length - 2];
        expect(prevX - lastX).toBeGreaterThanOrEqual(minFinalSegment);
      });

      it("does not modify segment already at minimum length", () => {
        const points = [0, 100, 50, 100, 75, 100]; // 25px segment
        const originalPrevX = points[2];

        ensureMinFinalSegment(points);

        expect(points[2]).toBe(originalPrevX);
      });

      it("does not modify segment longer than minimum", () => {
        const points = [0, 100, 50, 100, 100, 100]; // 50px segment
        const originalPoints = [...points];

        ensureMinFinalSegment(points);

        expect(points).toEqual(originalPoints);
      });
    });

    describe("edge cases", () => {
      it("does nothing for paths with fewer than 4 points", () => {
        const shortPath = [100, 100];
        const original = [...shortPath];

        ensureMinFinalSegment(shortPath);

        expect(shortPath).toEqual(original);
      });

      it("does nothing for empty array", () => {
        const empty: number[] = [];

        ensureMinFinalSegment(empty);

        expect(empty).toEqual([]);
      });

      it("does nothing for diagonal segment (both dx and dy > 5)", () => {
        // Diagonal segment where both dx and dy exceed threshold
        const points = [0, 0, 50, 50, 60, 60]; // Diagonal final segment
        const original = [...points];

        ensureMinFinalSegment(points);

        expect(points).toEqual(original);
      });

      it("does nothing for zero-length segment", () => {
        // Zero length segment
        const points = [0, 0, 50, 50, 50, 50]; // Last two points identical
        const original = [...points];

        ensureMinFinalSegment(points);

        expect(points).toEqual(original);
      });

      it("handles exactly 4 points (single segment)", () => {
        const points = [100, 100, 100, 110]; // Short vertical segment

        ensureMinFinalSegment(points);

        const dy = Math.abs(points[3] - points[1]);
        expect(dy).toBeGreaterThanOrEqual(minFinalSegment);
      });
    });

    describe("preserves other points", () => {
      it("only modifies the previous-to-last point", () => {
        const points = [0, 0, 50, 0, 100, 0, 100, 50, 100, 60];
        const originalFirst = [points[0], points[1]];
        const originalSecond = [points[2], points[3]];
        const originalThird = [points[4], points[5]];

        ensureMinFinalSegment(points);

        expect([points[0], points[1]]).toEqual(originalFirst);
        expect([points[2], points[3]]).toEqual(originalSecond);
        expect([points[4], points[5]]).toEqual(originalThird);
      });

      it("preserves the last point (endpoint)", () => {
        const points = [100, 0, 100, 50, 100, 60];
        const originalLastX = points[4];
        const originalLastY = points[5];

        ensureMinFinalSegment(points);

        expect(points[points.length - 2]).toBe(originalLastX);
        expect(points[points.length - 1]).toBe(originalLastY);
      });
    });
  });
});
