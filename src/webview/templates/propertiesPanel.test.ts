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

    it("should render the close button", () => {
      const html = renderPropertiesPanel();
      expect(html).toContain('id="propertiesClose"');
      expect(html).toContain('class="properties-close"');
      expect(html).toContain('title="Close panel"');
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
});
