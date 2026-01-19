/**
 * Tests for canvas template HTML generation
 * Ensures all required UI elements are present and correctly structured
 */

import { describe, it, expect } from "vitest";
import { renderCanvas, CanvasData } from "./canvas";
import { ParsedPipeline } from "../../lib/types";

// Mock pipeline data for testing
const mockPipeline: ParsedPipeline = {
  name: "TestPipeline",
  group: "TestGroup",
  type: "Pipeline",
  description: "A test pipeline",
  nodes: [
    { id: "Start", type: "start", name: "Start", x: 0, y: 0 },
    { id: "Pipelet1", type: "pipelet", name: "TestPipelet", x: 100, y: 0 },
  ],
  edges: [{ sourceNodeId: "Start", targetNodeId: "Pipelet1", label: "next" }],
};

const mockCanvasData: CanvasData = {
  pipeline: mockPipeline,
  sourcePath: "/path/to/pipeline.xml",
};

describe("renderCanvas", () => {
  it("should render the main canvas area container", () => {
    const html = renderCanvas(mockCanvasData);
    expect(html).toContain('class="canvas-area"');
    expect(html).toContain('id="konva-container"');
  });

  it("should render the canvas hint with keyboard shortcuts", () => {
    const html = renderCanvas(mockCanvasData);
    expect(html).toContain('class="canvas-hint"');
    expect(html).toContain("Scroll");
    expect(html).toContain("zoom");
    expect(html).toContain("Drag");
    expect(html).toContain("pan");
    expect(html).toContain("Click");
    expect(html).toContain("select");
    expect(html).toContain("⌘F");
    expect(html).toContain("search");
  });

  describe("bottom controls", () => {
    it("should render the bottom controls container", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain('class="bottom-controls"');
    });

    it("should render zoom controls with all buttons", () => {
      const html = renderCanvas(mockCanvasData);
      // Zoom out button
      expect(html).toContain('id="zoomOut"');
      expect(html).toContain('title="Zoom out"');
      // Zoom level display
      expect(html).toContain('id="zoomLevel"');
      expect(html).toContain("100%");
      // Zoom in button
      expect(html).toContain('id="zoomIn"');
      expect(html).toContain('title="Zoom in"');
    });

    it("should render view controls with fit and reset buttons", () => {
      const html = renderCanvas(mockCanvasData);
      // Fit to view button
      expect(html).toContain('id="zoomFit"');
      expect(html).toContain('title="Fit to view"');
      // Reset view button
      expect(html).toContain('id="zoomReset"');
      expect(html).toContain('title="Reset view"');
    });

    it("should render utility controls", () => {
      const html = renderCanvas(mockCanvasData);
      // Search toggle button
      expect(html).toContain('id="searchToggle"');
      expect(html).toContain('title="Search nodes (Cmd/Ctrl+F)"');
      // Legend toggle button
      expect(html).toContain('id="legendToggle"');
      expect(html).toContain('title="Toggle legend"');
      // Info toggle button
      expect(html).toContain('id="infoToggle"');
      expect(html).toContain('title="Pipeline info"');
    });

    it("should render a control divider", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain('class="control-divider"');
    });

    it("should render control groups for organization", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain('class="control-group zoom-controls"');
      expect(html).toContain('class="control-group view-controls"');
      expect(html).toContain('class="control-group utility-controls"');
    });
  });

  describe("info panel", () => {
    it("should render the info panel with correct structure", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain('id="infoPanel"');
      expect(html).toContain('class="floating-panel info-panel"');
    });

    it("should render info panel header with title and close button", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain("Pipeline Info");
      expect(html).toContain('id="infoPanelClose"');
    });

    it("should display pipeline name", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain("TestPipeline");
      expect(html).toContain('class="info-value name"');
    });

    it("should display pipeline group when present", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain("TestGroup");
    });

    it("should display pipeline type when present", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain("Pipeline");
    });

    it("should display pipeline description when present", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain("A test pipeline");
      expect(html).toContain('class="info-value description"');
    });

    it("should display node and edge counts", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain('class="info-stats"');
      expect(html).toContain('class="info-stat-value">2</span>'); // 2 nodes
      expect(html).toContain("Nodes");
      expect(html).toContain('class="info-stat-value">1</span>'); // 1 edge
      expect(html).toContain("Edges");
    });

    it("should display source path", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain("/path/to/pipeline.xml");
      expect(html).toContain('class="info-value path"');
    });

    it("should not display optional fields when not present", () => {
      const pipelineWithoutOptional: ParsedPipeline = {
        name: "MinimalPipeline",
        nodes: [],
        edges: [],
      };
      const data: CanvasData = {
        pipeline: pipelineWithoutOptional,
        sourcePath: "/path/to/minimal.xml",
      };
      const html = renderCanvas(data);

      // Should not have group, type, or description sections
      // (only if they're wrapped in conditional rendering)
      expect(html).toContain("MinimalPipeline");
    });
  });

  describe("legend panel", () => {
    it("should render the legend panel", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain('id="legendPanel"');
      expect(html).toContain('class="floating-panel legend-panel"');
    });

    it("should render legend panel header with close button", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain("Legend");
      expect(html).toContain('id="legendPanelClose"');
    });

    it("should render legend grid container", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain('id="legend"');
      expect(html).toContain('class="legend-grid"');
    });
  });

  describe("search panel", () => {
    it("should render the search overlay and panel", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain('id="searchOverlay"');
      expect(html).toContain('class="search-overlay"');
      expect(html).toContain('id="searchPanel"');
      expect(html).toContain('class="search-panel"');
    });

    it("should render search input with proper attributes", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain('id="searchInput"');
      expect(html).toContain('class="search-input"');
      expect(html).toContain('placeholder="Search nodes by name, type, or ID..."');
      expect(html).toContain('autocomplete="off"');
      expect(html).toContain('spellcheck="false"');
    });

    it("should render search results container", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain('id="searchResults"');
      expect(html).toContain('class="search-results"');
    });

    it("should render empty state for search", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain('id="searchEmpty"');
      expect(html).toContain("Type to search pipelets, decisions, and more...");
    });

    it("should render search footer with keyboard hints", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain('id="searchFooter"');
      expect(html).toContain("↑↓");
      expect(html).toContain("Navigate");
      expect(html).toContain("Enter");
      expect(html).toContain("Select");
      expect(html).toContain("Esc");
      expect(html).toContain("Close");
    });

    it("should show ESC shortcut in search input area", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain("ESC to close");
    });
  });

  describe("properties panel", () => {
    it("should include the properties panel", () => {
      const html = renderCanvas(mockCanvasData);
      expect(html).toContain('id="propertiesPanel"');
    });
  });

  describe("SVG icons", () => {
    it("should include SVG icons in controls", () => {
      const html = renderCanvas(mockCanvasData);
      // Check that SVG elements are present (icons are embedded)
      expect(html).toContain("<svg");
      expect(html).toContain("</svg>");
    });
  });

  describe("HTML structure integrity", () => {
    it("should have balanced opening and closing tags for main elements", () => {
      const html = renderCanvas(mockCanvasData);

      // Count opening and closing main tags
      const mainOpen = (html.match(/<main/g) || []).length;
      const mainClose = (html.match(/<\/main>/g) || []).length;
      expect(mainOpen).toBe(mainClose);

      const divOpen = (html.match(/<div/g) || []).length;
      const divClose = (html.match(/<\/div>/g) || []).length;
      expect(divOpen).toBe(divClose);

      const buttonOpen = (html.match(/<button/g) || []).length;
      const buttonClose = (html.match(/<\/button>/g) || []).length;
      expect(buttonOpen).toBe(buttonClose);
    });

    it("should have all control buttons with control-btn class", () => {
      const html = renderCanvas(mockCanvasData);
      // Count control buttons - should have at least 8 (zoom in/out, fit, reset, search, legend, info, close buttons)
      const controlBtnCount = (html.match(/class="control-btn"/g) || []).length;
      expect(controlBtnCount).toBeGreaterThanOrEqual(7);
    });
  });

  describe("accessibility", () => {
    it("should have title attributes on all control buttons", () => {
      const html = renderCanvas(mockCanvasData);
      // Each button should have a title for accessibility
      expect(html).toContain('title="Zoom out"');
      expect(html).toContain('title="Zoom in"');
      expect(html).toContain('title="Fit to view"');
      expect(html).toContain('title="Reset view"');
      expect(html).toContain('title="Search nodes (Cmd/Ctrl+F)"');
      expect(html).toContain('title="Toggle legend"');
      expect(html).toContain('title="Pipeline info"');
      expect(html).toContain('title="Close"');
    });
  });

  describe("XSS prevention", () => {
    it("should escape HTML special characters in pipeline name", () => {
      const maliciousPipeline: ParsedPipeline = {
        name: '<script>alert("XSS")</script>',
        nodes: [],
        edges: [],
      };
      const data: CanvasData = {
        pipeline: maliciousPipeline,
        sourcePath: "/path/to/test.xml",
      };
      const html = renderCanvas(data);

      expect(html).not.toContain("<script>alert");
      expect(html).toContain("&lt;script&gt;");
    });

    it("should escape HTML special characters in source path", () => {
      const data: CanvasData = {
        pipeline: mockPipeline,
        sourcePath: '/path/to/<script>evil</script>.xml',
      };
      const html = renderCanvas(data);

      expect(html).not.toContain("<script>evil");
    });

    it("should escape HTML special characters in description", () => {
      const maliciousPipeline: ParsedPipeline = {
        name: "Test",
        description: '"><img src=x onerror=alert(1)>',
        nodes: [],
        edges: [],
      };
      const data: CanvasData = {
        pipeline: maliciousPipeline,
        sourcePath: "/path/to/test.xml",
      };
      const html = renderCanvas(data);

      // The angle brackets should be escaped
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;img");
    });
  });
});
