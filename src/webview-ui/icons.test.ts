/**
 * Tests for webview-ui SVG icons used in the properties panel
 */

import { describe, it, expect } from "vitest";
import { iconSvgs, getNodeTypeIcon } from "./icons";

describe("iconSvgs", () => {
  const iconNames = Object.keys(iconSvgs) as (keyof typeof iconSvgs)[];

  describe("all icons", () => {
    it.each(iconNames)("icon '%s' should be a valid SVG element", (iconName) => {
      const icon = iconSvgs[iconName];
      expect(icon).toContain("<svg");
      expect(icon).toContain("</svg>");
    });

    it.each(iconNames)("icon '%s' should have viewBox attribute", (iconName) => {
      const icon = iconSvgs[iconName];
      expect(icon).toContain('viewBox="0 0 24 24"');
    });

    it.each(iconNames)("icon '%s' should have stroke styling", (iconName) => {
      const icon = iconSvgs[iconName];
      expect(icon).toContain('stroke="currentColor"');
    });

    it.each(iconNames)("icon '%s' should have fill set to none", (iconName) => {
      const icon = iconSvgs[iconName];
      expect(icon).toContain('fill="none"');
    });

    it.each(iconNames)("icon '%s' should have stroke-width", (iconName) => {
      const icon = iconSvgs[iconName];
      expect(icon).toContain('stroke-width="2"');
    });
  });

  describe("required icons for properties panel", () => {
    it("should have location icon", () => {
      expect(iconSvgs.location).toBeDefined();
      expect(iconSvgs.location).toContain("<svg");
    });

    it("should have connections icon", () => {
      expect(iconSvgs.connections).toBeDefined();
    });

    it("should have settings icon", () => {
      expect(iconSvgs.settings).toBeDefined();
    });

    it("should have binding icon", () => {
      expect(iconSvgs.binding).toBeDefined();
    });

    it("should have template icon", () => {
      expect(iconSvgs.template).toBeDefined();
    });

    it("should have arrow icons", () => {
      expect(iconSvgs.arrowDown).toBeDefined();
      expect(iconSvgs.arrowUp).toBeDefined();
      expect(iconSvgs.arrowRight).toBeDefined();
    });
  });

  describe("node type icons", () => {
    it("should have play icon for start nodes", () => {
      expect(iconSvgs.play).toBeDefined();
      expect(iconSvgs.play).toContain("polygon");
    });

    it("should have stop icon for end nodes", () => {
      expect(iconSvgs.stop).toBeDefined();
      expect(iconSvgs.stop).toContain("circle");
      expect(iconSvgs.stop).toContain("rect");
    });

    it("should have box icon for pipelet nodes", () => {
      expect(iconSvgs.box).toBeDefined();
    });

    it("should have phoneCall icon for call nodes", () => {
      expect(iconSvgs.phoneCall).toBeDefined();
    });

    it("should have user icon for interaction nodes", () => {
      expect(iconSvgs.user).toBeDefined();
    });

    it("should have gitBranch icon for decision nodes", () => {
      expect(iconSvgs.gitBranch).toBeDefined();
    });

    it("should have merge icon for join nodes", () => {
      expect(iconSvgs.merge).toBeDefined();
    });

    it("should have repeat icon for loop nodes", () => {
      expect(iconSvgs.repeat).toBeDefined();
    });

    it("should have text icon for text nodes", () => {
      expect(iconSvgs.text).toBeDefined();
    });

    it("should have circle icon for unknown nodes", () => {
      expect(iconSvgs.circle).toBeDefined();
    });
  });

  describe("additional icons", () => {
    it("should have search icon", () => {
      expect(iconSvgs.search).toBeDefined();
    });

    it("should have code icon", () => {
      expect(iconSvgs.code).toBeDefined();
    });
  });

  describe("icon consistency", () => {
    it("should have all icons as non-empty strings", () => {
      for (const [name, svg] of Object.entries(iconSvgs)) {
        expect(typeof svg, `Icon '${name}' should be a string`).toBe("string");
        expect(svg.length, `Icon '${name}' should not be empty`).toBeGreaterThan(0);
      }
    });

    it("should have no duplicate icon definitions", () => {
      const iconValues = Object.values(iconSvgs);
      const uniqueIcons = new Set(iconValues);
      expect(uniqueIcons.size).toBe(iconValues.length);
    });

    it("should not have inline event handlers (security)", () => {
      for (const [name, svg] of Object.entries(iconSvgs)) {
        expect(svg, `Icon '${name}' should not have onclick`).not.toContain("onclick");
        expect(svg, `Icon '${name}' should not have onerror`).not.toContain("onerror");
        expect(svg, `Icon '${name}' should not have onload`).not.toContain("onload");
      }
    });

    it("should not contain script tags (security)", () => {
      for (const [name, svg] of Object.entries(iconSvgs)) {
        expect(
          svg.toLowerCase(),
          `Icon '${name}' should not contain script tags`
        ).not.toContain("<script");
      }
    });
  });

  describe("SVG structure", () => {
    it("should have at least one drawing element in each icon", () => {
      for (const [name, svg] of Object.entries(iconSvgs)) {
        const hasPath = svg.includes("<path");
        const hasLine = svg.includes("<line");
        const hasCircle = svg.includes("<circle");
        const hasRect = svg.includes("<rect");
        const hasPolyline = svg.includes("<polyline");
        const hasPolygon = svg.includes("<polygon");

        expect(
          hasPath || hasLine || hasCircle || hasRect || hasPolyline || hasPolygon,
          `Icon '${name}' should have at least one drawing element`
        ).toBe(true);
      }
    });
  });
});

describe("getNodeTypeIcon", () => {
  describe("node type mapping", () => {
    it("should return play icon for start type", () => {
      const icon = getNodeTypeIcon("start");
      expect(icon).toBe(iconSvgs.play);
    });

    it("should return stop icon for end type", () => {
      const icon = getNodeTypeIcon("end");
      expect(icon).toBe(iconSvgs.stop);
    });

    it("should return box icon for pipelet type", () => {
      const icon = getNodeTypeIcon("pipelet");
      expect(icon).toBe(iconSvgs.box);
    });

    it("should return phoneCall icon for call type", () => {
      const icon = getNodeTypeIcon("call");
      expect(icon).toBe(iconSvgs.phoneCall);
    });

    it("should return arrowRight icon for jump type", () => {
      const icon = getNodeTypeIcon("jump");
      expect(icon).toBe(iconSvgs.arrowRight);
    });

    it("should return user icon for interaction type", () => {
      const icon = getNodeTypeIcon("interaction");
      expect(icon).toBe(iconSvgs.user);
    });

    it("should return gitBranch icon for decision type", () => {
      const icon = getNodeTypeIcon("decision");
      expect(icon).toBe(iconSvgs.gitBranch);
    });

    it("should return merge icon for join type", () => {
      const icon = getNodeTypeIcon("join");
      expect(icon).toBe(iconSvgs.merge);
    });

    it("should return repeat icon for loop type", () => {
      const icon = getNodeTypeIcon("loop");
      expect(icon).toBe(iconSvgs.repeat);
    });

    it("should return text icon for text type", () => {
      const icon = getNodeTypeIcon("text");
      expect(icon).toBe(iconSvgs.text);
    });

    it("should return circle icon for unknown type", () => {
      const icon = getNodeTypeIcon("unknown");
      expect(icon).toBe(iconSvgs.circle);
    });
  });

  describe("default case", () => {
    it("should return circle icon for unrecognized types", () => {
      const icon = getNodeTypeIcon("nonexistent");
      expect(icon).toBe(iconSvgs.circle);
    });

    it("should return circle icon for empty string", () => {
      const icon = getNodeTypeIcon("");
      expect(icon).toBe(iconSvgs.circle);
    });

    it("should handle various unknown types gracefully", () => {
      const unknownTypes = [
        "custom",
        "widget",
        "block",
        "node",
        "undefined",
        "null",
        "123",
      ];

      for (const type of unknownTypes) {
        const icon = getNodeTypeIcon(type);
        expect(icon, `Type '${type}' should return default icon`).toBe(
          iconSvgs.circle
        );
      }
    });
  });

  describe("all valid node types", () => {
    const validTypes = [
      "start",
      "end",
      "pipelet",
      "call",
      "jump",
      "interaction",
      "decision",
      "join",
      "loop",
      "text",
    ];

    it.each(validTypes)("should return a valid SVG for type '%s'", (type) => {
      const icon = getNodeTypeIcon(type);
      expect(icon).toContain("<svg");
      expect(icon).toContain("</svg>");
    });

    it.each(validTypes)("should return non-empty icon for type '%s'", (type) => {
      const icon = getNodeTypeIcon(type);
      expect(icon.length).toBeGreaterThan(50); // SVGs should be substantial
    });
  });
});
