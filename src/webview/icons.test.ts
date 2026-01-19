/**
 * Tests for SVG icon definitions
 * Ensures all icons are properly structured and contain valid SVG markup
 */

import { describe, it, expect } from "vitest";
import { icons, IconName } from "./icons";

describe("icons", () => {
  const iconNames = Object.keys(icons) as IconName[];

  describe("all icons", () => {
    it.each(iconNames)("icon '%s' should be a valid SVG element", (iconName) => {
      const icon = icons[iconName];
      expect(icon).toContain("<svg");
      expect(icon).toContain("</svg>");
    });

    it.each(iconNames)("icon '%s' should have viewBox attribute", (iconName) => {
      const icon = icons[iconName];
      expect(icon).toContain('viewBox="0 0 24 24"');
    });

    it.each(iconNames)("icon '%s' should have stroke styling", (iconName) => {
      const icon = icons[iconName];
      expect(icon).toContain('stroke="currentColor"');
    });

    it.each(iconNames)("icon '%s' should have fill set to none", (iconName) => {
      const icon = icons[iconName];
      expect(icon).toContain('fill="none"');
    });

    it.each(iconNames)("icon '%s' should have stroke-width", (iconName) => {
      const icon = icons[iconName];
      expect(icon).toContain('stroke-width="2"');
    });
  });

  describe("required icons for UI components", () => {
    it("should have zoom control icons", () => {
      expect(icons.zoomIn).toBeDefined();
      expect(icons.zoomOut).toBeDefined();
    });

    it("should have view control icons", () => {
      expect(icons.maximize).toBeDefined();
      expect(icons.home).toBeDefined();
    });

    it("should have utility control icons", () => {
      expect(icons.search).toBeDefined();
      expect(icons.grid).toBeDefined();
      expect(icons.fileText).toBeDefined();
    });

    it("should have panel icons", () => {
      expect(icons.close).toBeDefined();
      expect(icons.info).toBeDefined();
    });

    it("should have empty state icons", () => {
      expect(icons.pointerClick).toBeDefined();
    });

    it("should have file/data icons", () => {
      expect(icons.file).toBeDefined();
      expect(icons.table).toBeDefined();
      expect(icons.text).toBeDefined();
    });

    it("should have navigation icons", () => {
      expect(icons.chevronLeft).toBeDefined();
    });
  });

  describe("icon consistency", () => {
    it("should have all icons as non-empty strings", () => {
      for (const [name, svg] of Object.entries(icons)) {
        expect(typeof svg, `Icon '${name}' should be a string`).toBe("string");
        expect(svg.length, `Icon '${name}' should not be empty`).toBeGreaterThan(0);
      }
    });

    it("should have no duplicate icon definitions", () => {
      const iconValues = Object.values(icons);
      const uniqueIcons = new Set(iconValues);
      expect(uniqueIcons.size).toBe(iconValues.length);
    });

    it("should not have inline event handlers (security)", () => {
      for (const [name, svg] of Object.entries(icons)) {
        expect(svg, `Icon '${name}' should not have onclick`).not.toContain("onclick");
        expect(svg, `Icon '${name}' should not have onerror`).not.toContain("onerror");
        expect(svg, `Icon '${name}' should not have onload`).not.toContain("onload");
      }
    });

    it("should not contain script tags (security)", () => {
      for (const [name, svg] of Object.entries(icons)) {
        expect(svg.toLowerCase(), `Icon '${name}' should not contain script tags`).not.toContain(
          "<script"
        );
      }
    });
  });

  describe("SVG structure", () => {
    it("should have at least one drawing element in each icon", () => {
      for (const [name, svg] of Object.entries(icons)) {
        const hasPath = svg.includes("<path");
        const hasLine = svg.includes("<line");
        const hasCircle = svg.includes("<circle");
        const hasRect = svg.includes("<rect");
        const hasPolyline = svg.includes("<polyline");

        expect(
          hasPath || hasLine || hasCircle || hasRect || hasPolyline,
          `Icon '${name}' should have at least one drawing element`
        ).toBe(true);
      }
    });
  });

  describe("type safety", () => {
    it("should export IconName type that matches all keys", () => {
      // This test ensures the IconName type is properly derived from the icons object
      const expectedKeys: IconName[] = [
        "file",
        "table",
        "text",
        "grid",
        "chevronLeft",
        "zoomIn",
        "zoomOut",
        "home",
        "maximize",
        "info",
        "fileText",
        "close",
        "pointerClick",
        "search",
      ];

      for (const key of expectedKeys) {
        expect(icons[key]).toBeDefined();
      }
    });
  });
});
