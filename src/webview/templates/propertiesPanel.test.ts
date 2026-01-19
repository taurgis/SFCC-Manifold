/**
 * Tests for properties panel template HTML generation
 * Ensures all required UI elements are present
 */

import { describe, it, expect } from "vitest";
import { renderPropertiesPanel } from "./propertiesPanel";

describe("renderPropertiesPanel", () => {
  it("should render the properties panel container", () => {
    const html = renderPropertiesPanel();
    expect(html).toContain('id="propertiesPanel"');
    expect(html).toContain('class="properties-panel"');
  });

  it("should render the panel as an aside element for accessibility", () => {
    const html = renderPropertiesPanel();
    expect(html).toContain("<aside");
    expect(html).toContain("</aside>");
  });

  it("should render the resize handle", () => {
    const html = renderPropertiesPanel();
    expect(html).toContain('id="propertiesResizeHandle"');
    expect(html).toContain('class="properties-resize-handle"');
  });

  describe("panel header", () => {
    it("should render the header section", () => {
      const html = renderPropertiesPanel();
      expect(html).toContain('class="properties-header"');
      expect(html).toContain('class="properties-header-content"');
    });

    it("should render the title with icon", () => {
      const html = renderPropertiesPanel();
      expect(html).toContain('class="properties-title"');
      expect(html).toContain("Properties");
      // Should contain an SVG icon
      expect(html).toContain("<svg");
    });

    it("should render the info icon in the title", () => {
      const html = renderPropertiesPanel();
      // The info icon has a circle with cx="12" cy="12" r="10"
      expect(html).toContain('r="10"');
      // Info icon has characteristic line elements for the "i"
      expect(html).toContain('x1="12" y1="16"');
    });

    it("should render the close button", () => {
      const html = renderPropertiesPanel();
      expect(html).toContain('id="propertiesClose"');
      expect(html).toContain('class="properties-close"');
      expect(html).toContain('title="Close panel"');
    });

    it("should render the close button as a button element", () => {
      const html = renderPropertiesPanel();
      expect(html).toContain("<button");
      expect(html).toContain("</button>");
    });

    it("should render the close icon (X shape) in the close button", () => {
      const html = renderPropertiesPanel();
      // Close icon has two diagonal lines forming an X
      expect(html).toContain('x1="18" y1="6" x2="6" y2="18"');
      expect(html).toContain('x1="6" y1="6" x2="18" y2="18"');
    });
  });

  describe("content area", () => {
    it("should render the content container", () => {
      const html = renderPropertiesPanel();
      expect(html).toContain('id="propertiesContent"');
      expect(html).toContain('class="properties-content"');
    });
  });

  describe("empty state", () => {
    it("should render the empty state container", () => {
      const html = renderPropertiesPanel();
      expect(html).toContain('id="propertiesEmpty"');
      expect(html).toContain('class="properties-empty"');
    });

    it("should render empty state icon", () => {
      const html = renderPropertiesPanel();
      expect(html).toContain('class="empty-icon"');
      // Should contain an SVG for the pointer click icon
      expect(html).toContain("<svg");
    });

    it("should render the pointer click icon for empty state", () => {
      const html = renderPropertiesPanel();
      // The pointer click icon has specific path elements
      expect(html).toContain('d="M22 14a8 8 0 0 1-8 8"');
    });

    it("should render empty state text", () => {
      const html = renderPropertiesPanel();
      expect(html).toContain('class="empty-text"');
      expect(html).toContain("Select a node to view its properties");
    });

    it("should render empty state hint", () => {
      const html = renderPropertiesPanel();
      expect(html).toContain('class="empty-hint"');
      expect(html).toContain("Click on any node in the canvas");
    });

    it("should have proper visual hierarchy in empty state", () => {
      const html = renderPropertiesPanel();
      // Icon, text, hint should all be present for good UX
      const iconIndex = html.indexOf('class="empty-icon"');
      const textIndex = html.indexOf('class="empty-text"');
      const hintIndex = html.indexOf('class="empty-hint"');

      // They should appear in order: icon, text, hint
      expect(iconIndex).toBeLessThan(textIndex);
      expect(textIndex).toBeLessThan(hintIndex);
    });
  });

  describe("HTML structure integrity", () => {
    it("should have balanced opening and closing tags", () => {
      const html = renderPropertiesPanel();

      const asideOpen = (html.match(/<aside/g) || []).length;
      const asideClose = (html.match(/<\/aside>/g) || []).length;
      expect(asideOpen).toBe(asideClose);

      const divOpen = (html.match(/<div/g) || []).length;
      const divClose = (html.match(/<\/div>/g) || []).length;
      expect(divOpen).toBe(divClose);

      const buttonOpen = (html.match(/<button/g) || []).length;
      const buttonClose = (html.match(/<\/button>/g) || []).length;
      expect(buttonOpen).toBe(buttonClose);
    });
  });

  describe("accessibility", () => {
    it("should have title attribute on close button", () => {
      const html = renderPropertiesPanel();
      expect(html).toContain('title="Close panel"');
    });
  });

  describe("required IDs for JavaScript binding", () => {
    it("should have all required IDs for runtime JavaScript", () => {
      const html = renderPropertiesPanel();

      // These IDs are used by the webview-ui JavaScript to manipulate the panel
      const requiredIds = [
        "propertiesPanel",
        "propertiesResizeHandle",
        "propertiesContent",
        "propertiesClose",
        "propertiesEmpty",
      ];

      for (const id of requiredIds) {
        expect(html, `Missing required ID: ${id}`).toContain(`id="${id}"`);
      }
    });
  });

  describe("SVG icons", () => {
    it("should have valid SVG structure for all icons", () => {
      const html = renderPropertiesPanel();
      // Count opening and closing svg tags - should be equal
      const svgOpen = (html.match(/<svg/g) || []).length;
      const svgClose = (html.match(/<\/svg>/g) || []).length;
      expect(svgOpen).toBe(svgClose);
      // Should have at least 2 icons (info icon in title, close icon, pointer icon)
      expect(svgOpen).toBeGreaterThanOrEqual(2);
    });

    it("should have viewBox attributes on all SVGs", () => {
      const html = renderPropertiesPanel();
      const svgCount = (html.match(/<svg/g) || []).length;
      const viewBoxCount = (html.match(/viewBox="0 0 24 24"/g) || []).length;
      expect(viewBoxCount).toBe(svgCount);
    });

    it("should have stroke styling on all SVGs", () => {
      const html = renderPropertiesPanel();
      const svgCount = (html.match(/<svg/g) || []).length;
      const strokeCount = (html.match(/stroke="currentColor"/g) || []).length;
      expect(strokeCount).toBe(svgCount);
    });
  });

  describe("panel structure for visibility toggling", () => {
    it("should have a structure that supports CSS visibility toggling", () => {
      const html = renderPropertiesPanel();
      // The panel must have id="propertiesPanel" for JS to add/remove 'visible' class
      expect(html).toContain('id="propertiesPanel"');
      expect(html).toContain('class="properties-panel"');
    });

    it("should have content container separate from empty state for content switching", () => {
      const html = renderPropertiesPanel();
      // propertiesContent should contain propertiesEmpty initially
      const contentIndex = html.indexOf('id="propertiesContent"');
      const emptyIndex = html.indexOf('id="propertiesEmpty"');
      expect(contentIndex).toBeLessThan(emptyIndex);
    });
  });

  describe("security", () => {
    it("should not contain inline event handlers", () => {
      const html = renderPropertiesPanel();
      expect(html).not.toContain("onclick");
      expect(html).not.toContain("onerror");
      expect(html).not.toContain("onload");
      expect(html).not.toContain("onmouseover");
    });

    it("should not contain script tags", () => {
      const html = renderPropertiesPanel();
      expect(html.toLowerCase()).not.toContain("<script");
    });

    it("should not contain javascript: URLs", () => {
      const html = renderPropertiesPanel();
      expect(html.toLowerCase()).not.toContain("javascript:");
    });
  });
});
