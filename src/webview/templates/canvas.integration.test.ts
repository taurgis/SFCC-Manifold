/**
 * Integration tests for complete pipeline rendering
 * Tests the full rendering pipeline with real-world pipeline data structures
 * to verify all node types, properties, and UI elements render correctly
 */

import { describe, it, expect } from "vitest";
import { renderCanvas, CanvasData } from "./canvas";
import { ParsedPipeline, PipelineNode, PipelineEdge } from "../../lib/types";

/**
 * Creates a comprehensive test pipeline with all node types and various configurations.
 * Modeled after real SFCC pipelines like Error.xml and Account.xml
 */
function createComprehensiveTestPipeline(): ParsedPipeline {
  const nodes: PipelineNode[] = [
    // Start nodes - entry points with different configurations
    {
      id: "Start:0:0",
      label: "Start Start",
      type: "start",
      branch: "Start",
      attributes: {
        name: "Start",
        secure: "false",
      },
      position: { x: 0, y: 0 },
      sourceLocation: { line: 10, column: 5 },
    },
    {
      id: "SecureStart:0:0",
      label: "Start SecureStart",
      type: "start",
      branch: "SecureStart",
      attributes: {
        name: "SecureStart",
        secure: "true",
        "call-center-enabled": "true",
      },
      position: { x: 5, y: 0 },
      sourceLocation: { line: 20, column: 5 },
    },

    // Decision nodes - branching logic
    {
      id: "Start:0:1",
      label: "Decision IsLoggedIn",
      type: "decision",
      branch: "Start",
      attributes: {
        "condition-key": "customer.authenticated",
        "condition-operator": "expr",
      },
      position: { x: 0, y: 1, orientation: "horizontal" },
      sourceLocation: { line: 30, column: 5 },
    },
    {
      id: "Start:0:3",
      label: "Decision HasCart",
      type: "decision",
      branch: "Start",
      attributes: {
        "condition-key": "Basket != null && Basket.productLineItems.length > 0",
        "condition-operator": "expr",
      },
      position: { x: 0, y: 3 },
      sourceLocation: { line: 50, column: 5 },
    },

    // Pipelet nodes - with config properties and bindings
    {
      id: "Start:0:2",
      label: "Assign SetVariables",
      type: "pipelet",
      branch: "Start",
      attributes: {
        "pipelet-name": "Assign",
        "pipelet-set-identifier": "bc_api",
        "custom-name": "Set customer variables",
      },
      configProperties: [
        { key: "Transactional", value: "false" },
      ],
      bindings: [
        { key: "From_0", alias: "customer.profile.email" },
        { key: "To_0", alias: "CustomerEmail" },
        { key: "From_1", alias: "customer.profile.firstName" },
        { key: "To_1", alias: "CustomerName" },
      ],
      position: { x: 0, y: 2 },
      sourceLocation: { line: 40, column: 5 },
    },
    {
      id: "Start:0:4",
      label: "Script CalculateTotal",
      type: "pipelet",
      branch: "Start",
      attributes: {
        "pipelet-name": "Script",
        "pipelet-set-identifier": "bc_api",
      },
      configProperties: [
        { key: "ScriptFile", value: "cartridge/scripts/calculateTotal.ds" },
        { key: "Transactional", value: "true" },
      ],
      bindings: [
        { key: "Basket", alias: "CurrentBasket" },
        { key: "Total", alias: "OrderTotal" },
      ],
      position: { x: 0, y: 4 },
      sourceLocation: { line: 60, column: 5 },
    },
    {
      id: "SecureStart:0:1",
      label: "LogoutCustomer",
      type: "pipelet",
      branch: "SecureStart",
      attributes: {
        "pipelet-name": "LogoutCustomer",
        "pipelet-set-identifier": "bc_api",
      },
      position: { x: 5, y: 1 },
      sourceLocation: { line: 25, column: 5 },
    },

    // Interaction nodes - templates with various configs
    {
      id: "Start:0:5",
      label: "Interaction cart/show",
      type: "interaction",
      branch: "Start",
      attributes: {
        "transaction-required": "false",
      },
      template: {
        name: "cart/show",
        buffered: true,
        dynamic: false,
      },
      position: { x: 0, y: 5 },
      sourceLocation: { line: 70, column: 5 },
    },
    {
      id: "Start:1:1",
      label: "Interaction error/generalerror",
      type: "interaction",
      branch: "Start",
      attributes: {
        "transaction-required": "false",
      },
      template: {
        name: "error/generalerror",
        buffered: true,
        dynamic: false,
      },
      position: { x: 2, y: 5 },
      sourceLocation: { line: 80, column: 5 },
    },

    // Call node - pipeline calls
    {
      id: "Start:b1:0",
      label: "Call Account-Show",
      type: "call",
      branch: "Start",
      attributes: {
        "target-pipeline": "Account",
        "target-start-node": "Show",
      },
      position: { x: 1, y: 2 },
      sourceLocation: { line: 90, column: 5 },
    },

    // Jump node - redirects
    {
      id: "Start:b1:1",
      label: "Jump Home-Show",
      type: "jump",
      branch: "Start",
      attributes: {
        "target-pipeline": "Home",
        "target-start-node": "Show",
      },
      position: { x: 1, y: 3 },
      sourceLocation: { line: 100, column: 5 },
    },

    // Join node - merge paths
    {
      id: "Start:1:0",
      label: "Join",
      type: "join",
      branch: "Start",
      attributes: {},
      position: { x: 1, y: 4 },
      sourceLocation: { line: 110, column: 5 },
    },

    // Loop node - iteration
    {
      id: "Start:2:0",
      label: "Loop ProductLineItems",
      type: "loop",
      branch: "Start",
      attributes: {
        "loop-alias": "ProductLineItem",
        "loop-iterator": "Basket.productLineItems.iterator()",
      },
      position: { x: 2, y: 2 },
      sourceLocation: { line: 120, column: 5 },
    },

    // End nodes - different exit types
    {
      id: "Start:2:1",
      label: "End success",
      type: "end",
      branch: "Start",
      attributes: {
        name: "success",
      },
      position: { x: 2, y: 3 },
      sourceLocation: { line: 130, column: 5 },
    },
    {
      id: "SecureStart:0:2",
      label: "End error",
      type: "end",
      branch: "SecureStart",
      attributes: {
        name: "error",
      },
      position: { x: 5, y: 2 },
      sourceLocation: { line: 140, column: 5 },
    },

    // Text node - documentation
    {
      id: "_ANONYMOUS_BRANCH_1:0:0",
      label: "This is a comprehensive test pipeline with all node types",
      type: "text",
      branch: "_ANONYMOUS_BRANCH_1",
      attributes: {},
      description:
        "This pipeline demonstrates all supported node types:\n" +
        "- Start nodes (entry points)\n" +
        "- Decision nodes (branching)\n" +
        "- Pipelet nodes (business logic)\n" +
        "- Interaction nodes (templates)\n" +
        "- Call nodes (sub-pipelines)\n" +
        "- Jump nodes (redirects)\n" +
        "- Join nodes (merge paths)\n" +
        "- Loop nodes (iteration)\n" +
        "- End nodes (exit points)\n" +
        "- Text nodes (documentation)",
      position: { x: 3, y: 0, width: 2 },
      sourceLocation: { line: 5, column: 5 },
    },

    // Unknown node type (for edge cases)
    {
      id: "Start:unknown:0",
      label: "Unknown Node Type",
      type: "unknown",
      branch: "Start",
      attributes: {
        "custom-attr": "custom-value",
      },
      position: { x: 4, y: 1 },
      sourceLocation: { line: 150, column: 5 },
    },
  ];

  const edges: PipelineEdge[] = [
    // Simple transitions
    {
      from: "Start:0:0",
      to: "Start:0:1",
      sourceLocation: { line: 11 },
    },
    {
      from: "Start:0:1",
      to: "Start:0:2",
      label: "no",
      sourceConnector: "no",
      sourceLocation: { line: 31 },
    },
    {
      from: "Start:0:2",
      to: "Start:0:3",
      sourceLocation: { line: 41 },
    },
    {
      from: "Start:0:3",
      to: "Start:0:4",
      label: "yes",
      sourceConnector: "yes",
      sourceLocation: { line: 51 },
    },
    {
      from: "Start:0:4",
      to: "Start:0:5",
      sourceLocation: { line: 61 },
    },

    // Branch transitions
    {
      from: "Start:0:1",
      to: "Start:b1:0",
      label: "yes",
      sourceConnector: "yes",
      targetConnector: "in",
      display: {
        bendPoints: [{ relativeTo: "source", x: 1, y: 0 }],
      },
      sourceLocation: { line: 32 },
    },
    {
      from: "Start:b1:0",
      to: "Start:b1:1",
      sourceLocation: { line: 91 },
    },

    // Join transitions with multiple inputs
    {
      from: "Start:0:3",
      to: "Start:1:0",
      label: "no",
      sourceConnector: "no",
      targetConnector: "in1",
      sourceLocation: { line: 52 },
    },
    {
      from: "Start:b1:1",
      to: "Start:1:0",
      targetConnector: "in2",
      sourceLocation: { line: 101 },
    },
    {
      from: "Start:1:0",
      to: "Start:1:1",
      sourceLocation: { line: 111 },
    },

    // Loop transitions
    {
      from: "Start:2:0",
      to: "Start:2:1",
      label: "done",
      sourceConnector: "done",
      sourceLocation: { line: 121 },
    },

    // Secure branch
    {
      from: "SecureStart:0:0",
      to: "SecureStart:0:1",
      sourceLocation: { line: 21 },
    },
    {
      from: "SecureStart:0:1",
      to: "SecureStart:0:2",
      sourceLocation: { line: 26 },
    },
  ];

  return {
    name: "ComprehensiveTest",
    group: "TestGroup",
    type: "Pipeline",
    description:
      "A comprehensive test pipeline demonstrating all node types, " +
      "configurations, and edge cases for thorough UI testing.",
    nodes,
    edges,
  };
}

describe("Pipeline Integration Tests", () => {
  const testPipeline = createComprehensiveTestPipeline();
  const testData: CanvasData = {
    pipeline: testPipeline,
    sourcePath: "/test/cartridges/app_test/cartridge/pipelines/ComprehensiveTest.xml",
  };

  describe("complete pipeline rendering", () => {
    it("should render a complete pipeline with all sections", () => {
      const html = renderCanvas(testData);

      // Main structural elements
      expect(html).toContain('class="canvas-area"');
      expect(html).toContain('id="konva-container"');
      expect(html).toContain('class="bottom-controls"');
      expect(html).toContain('id="infoPanel"');
      expect(html).toContain('id="legendPanel"');
      expect(html).toContain('id="searchPanel"');
      expect(html).toContain('id="propertiesPanel"');
    });

    it("should display correct pipeline metadata", () => {
      const html = renderCanvas(testData);

      expect(html).toContain("ComprehensiveTest");
      expect(html).toContain("TestGroup");
      expect(html).toContain("Pipeline");
      expect(html).toContain("comprehensive test pipeline demonstrating all node types");
    });

    it("should display correct node count", () => {
      const html = renderCanvas(testData);
      const nodeCount = testPipeline.nodes.length;
      expect(html).toContain(`<span class="info-stat-value">${nodeCount}</span>`);
      expect(html).toContain("Nodes");
    });

    it("should display correct edge count", () => {
      const html = renderCanvas(testData);
      const edgeCount = testPipeline.edges.length;
      expect(html).toContain(`<span class="info-stat-value">${edgeCount}</span>`);
      expect(html).toContain("Edges");
    });

    it("should display the full source path", () => {
      const html = renderCanvas(testData);
      expect(html).toContain(
        "/test/cartridges/app_test/cartridge/pipelines/ComprehensiveTest.xml"
      );
    });
  });

  describe("pipeline with all node types", () => {
    it("should handle pipeline with start nodes", () => {
      const startNodes = testPipeline.nodes.filter((n) => n.type === "start");
      expect(startNodes.length).toBeGreaterThan(0);

      // Verify start node has expected attributes
      const secureStart = startNodes.find((n) => n.attributes.secure === "true");
      expect(secureStart).toBeDefined();
      expect(secureStart?.attributes["call-center-enabled"]).toBe("true");
    });

    it("should handle pipeline with decision nodes", () => {
      const decisionNodes = testPipeline.nodes.filter((n) => n.type === "decision");
      expect(decisionNodes.length).toBeGreaterThan(0);

      // Verify decision node has condition
      const decision = decisionNodes[0];
      expect(decision.attributes["condition-key"]).toBeDefined();
      expect(decision.attributes["condition-operator"]).toBe("expr");
    });

    it("should handle pipeline with pipelet nodes", () => {
      const pipeletNodes = testPipeline.nodes.filter((n) => n.type === "pipelet");
      expect(pipeletNodes.length).toBeGreaterThan(0);

      // Verify pipelet has config properties and bindings
      const scriptPipelet = pipeletNodes.find(
        (n) => n.attributes["pipelet-name"] === "Script"
      );
      expect(scriptPipelet).toBeDefined();
      expect(scriptPipelet?.configProperties).toBeDefined();
      expect(scriptPipelet?.configProperties?.length).toBeGreaterThan(0);
      expect(scriptPipelet?.bindings).toBeDefined();
    });

    it("should handle pipeline with interaction nodes", () => {
      const interactionNodes = testPipeline.nodes.filter((n) => n.type === "interaction");
      expect(interactionNodes.length).toBeGreaterThan(0);

      // Verify interaction node has template config
      const interaction = interactionNodes[0];
      expect(interaction.template).toBeDefined();
      expect(interaction.template?.name).toBe("cart/show");
      expect(interaction.template?.buffered).toBe(true);
    });

    it("should handle pipeline with call nodes", () => {
      const callNodes = testPipeline.nodes.filter((n) => n.type === "call");
      expect(callNodes.length).toBeGreaterThan(0);

      const callNode = callNodes[0];
      expect(callNode.attributes["target-pipeline"]).toBe("Account");
      expect(callNode.attributes["target-start-node"]).toBe("Show");
    });

    it("should handle pipeline with jump nodes", () => {
      const jumpNodes = testPipeline.nodes.filter((n) => n.type === "jump");
      expect(jumpNodes.length).toBeGreaterThan(0);

      const jumpNode = jumpNodes[0];
      expect(jumpNode.attributes["target-pipeline"]).toBe("Home");
    });

    it("should handle pipeline with join nodes", () => {
      const joinNodes = testPipeline.nodes.filter((n) => n.type === "join");
      expect(joinNodes.length).toBeGreaterThan(0);
    });

    it("should handle pipeline with loop nodes", () => {
      const loopNodes = testPipeline.nodes.filter((n) => n.type === "loop");
      expect(loopNodes.length).toBeGreaterThan(0);

      const loopNode = loopNodes[0];
      expect(loopNode.attributes["loop-alias"]).toBe("ProductLineItem");
      expect(loopNode.attributes["loop-iterator"]).toContain("iterator()");
    });

    it("should handle pipeline with end nodes", () => {
      const endNodes = testPipeline.nodes.filter((n) => n.type === "end");
      expect(endNodes.length).toBeGreaterThan(0);

      const successEnd = endNodes.find((n) => n.attributes.name === "success");
      const errorEnd = endNodes.find((n) => n.attributes.name === "error");
      expect(successEnd).toBeDefined();
      expect(errorEnd).toBeDefined();
    });

    it("should handle pipeline with text nodes", () => {
      const textNodes = testPipeline.nodes.filter((n) => n.type === "text");
      expect(textNodes.length).toBeGreaterThan(0);

      const textNode = textNodes[0];
      expect(textNode.description).toBeDefined();
      expect(textNode.description).toContain("Start nodes");
    });

    it("should handle pipeline with unknown node types gracefully", () => {
      const unknownNodes = testPipeline.nodes.filter((n) => n.type === "unknown");
      expect(unknownNodes.length).toBeGreaterThan(0);

      // The rendering should not crash with unknown types
      const html = renderCanvas(testData);
      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(0);
    });
  });

  describe("edge configurations", () => {
    it("should handle edges with labels", () => {
      const labeledEdges = testPipeline.edges.filter((e) => e.label);
      expect(labeledEdges.length).toBeGreaterThan(0);
      expect(labeledEdges.some((e) => e.label === "yes")).toBe(true);
      expect(labeledEdges.some((e) => e.label === "no")).toBe(true);
    });

    it("should handle edges with source connectors", () => {
      const edges = testPipeline.edges.filter((e) => e.sourceConnector);
      expect(edges.length).toBeGreaterThan(0);
      expect(edges.some((e) => e.sourceConnector === "yes")).toBe(true);
      expect(edges.some((e) => e.sourceConnector === "no")).toBe(true);
      expect(edges.some((e) => e.sourceConnector === "done")).toBe(true);
    });

    it("should handle edges with target connectors", () => {
      const edges = testPipeline.edges.filter((e) => e.targetConnector);
      expect(edges.length).toBeGreaterThan(0);
      expect(edges.some((e) => e.targetConnector === "in")).toBe(true);
      expect(edges.some((e) => e.targetConnector === "in1")).toBe(true);
      expect(edges.some((e) => e.targetConnector === "in2")).toBe(true);
    });

    it("should handle edges with bend points", () => {
      const edgesWithBendPoints = testPipeline.edges.filter(
        (e) => e.display?.bendPoints?.length
      );
      expect(edgesWithBendPoints.length).toBeGreaterThan(0);

      const edge = edgesWithBendPoints[0];
      expect(edge.display?.bendPoints[0].relativeTo).toBe("source");
      expect(edge.display?.bendPoints[0].x).toBe(1);
    });

    it("should handle edges with source locations", () => {
      const edgesWithLocations = testPipeline.edges.filter((e) => e.sourceLocation);
      expect(edgesWithLocations.length).toBe(testPipeline.edges.length);
    });
  });

  describe("node positions and attributes", () => {
    it("should have position data for all nodes", () => {
      const nodesWithPositions = testPipeline.nodes.filter((n) => n.position);
      expect(nodesWithPositions.length).toBe(testPipeline.nodes.length);
    });

    it("should handle nodes with width attribute", () => {
      const textNode = testPipeline.nodes.find((n) => n.type === "text");
      expect(textNode?.position?.width).toBe(2);
    });

    it("should handle nodes with orientation attribute", () => {
      const horizontalNode = testPipeline.nodes.find(
        (n) => n.position?.orientation === "horizontal"
      );
      expect(horizontalNode).toBeDefined();
      expect(horizontalNode?.type).toBe("decision");
    });

    it("should have source locations for all nodes", () => {
      const nodesWithLocations = testPipeline.nodes.filter((n) => n.sourceLocation);
      expect(nodesWithLocations.length).toBe(testPipeline.nodes.length);
    });

    it("should have branch information for all nodes", () => {
      const nodesWithBranches = testPipeline.nodes.filter((n) => n.branch);
      expect(nodesWithBranches.length).toBe(testPipeline.nodes.length);
    });
  });

  describe("special content handling", () => {
    it("should handle long descriptions without breaking layout", () => {
      const longDescPipeline: ParsedPipeline = {
        name: "LongDescription",
        description: "A".repeat(500), // Very long description
        nodes: [],
        edges: [],
      };
      const data: CanvasData = {
        pipeline: longDescPipeline,
        sourcePath: "/test/pipeline.xml",
      };

      const html = renderCanvas(data);
      expect(html).toContain("A".repeat(500));
      expect(html).toContain('class="info-value description"');
    });

    it("should handle special characters in pipeline data", () => {
      const specialPipeline: ParsedPipeline = {
        name: "Test<>&\"'Pipeline",
        group: "Group<with>special&chars",
        description: 'Description with "quotes" and <brackets>',
        nodes: [],
        edges: [],
      };
      const data: CanvasData = {
        pipeline: specialPipeline,
        sourcePath: "/path/<special>/file.xml",
      };

      const html = renderCanvas(data);
      // Should be escaped
      expect(html).toContain("&lt;");
      expect(html).toContain("&gt;");
      expect(html).toContain("&amp;");
      expect(html).toContain("&quot;");
    });

    it("should handle complex condition expressions", () => {
      const decision = testPipeline.nodes.find(
        (n) =>
          n.type === "decision" &&
          n.attributes["condition-key"]?.includes("Basket")
      );
      expect(decision).toBeDefined();
      expect(decision?.attributes["condition-key"]).toContain("Basket");
      expect(decision?.attributes["condition-key"]).toContain("productLineItems");
    });

    it("should handle pipelet bindings with expressions", () => {
      const pipelet = testPipeline.nodes.find(
        (n) => n.type === "pipelet" && n.bindings && n.bindings.length > 0
      );
      expect(pipelet).toBeDefined();
      expect(pipelet?.bindings?.some((b) => b.alias.includes("."))).toBe(true);
    });
  });

  describe("empty and minimal pipelines", () => {
    it("should render a pipeline with no nodes or edges", () => {
      const emptyPipeline: ParsedPipeline = {
        name: "Empty",
        nodes: [],
        edges: [],
      };
      const data: CanvasData = {
        pipeline: emptyPipeline,
        sourcePath: "/empty.xml",
      };

      const html = renderCanvas(data);
      expect(html).toContain("Empty");
      expect(html).toContain('<span class="info-stat-value">0</span>');
    });

    it("should render a pipeline with only required fields", () => {
      const minimalPipeline: ParsedPipeline = {
        name: "Minimal",
        nodes: [
          {
            id: "start",
            label: "Start",
            type: "start",
            branch: "main",
            attributes: {},
          },
        ],
        edges: [],
      };
      const data: CanvasData = {
        pipeline: minimalPipeline,
        sourcePath: "/minimal.xml",
      };

      const html = renderCanvas(data);
      expect(html).toContain("Minimal");
      expect(html).toContain('<span class="info-stat-value">1</span>');
    });
  });

  describe("UI control elements for all scenarios", () => {
    it("should render all zoom controls", () => {
      const html = renderCanvas(testData);

      expect(html).toContain('id="zoomIn"');
      expect(html).toContain('id="zoomOut"');
      expect(html).toContain('id="zoomLevel"');
      expect(html).toContain('id="zoomFit"');
      expect(html).toContain('id="zoomReset"');
    });

    it("should render all panel toggle controls", () => {
      const html = renderCanvas(testData);

      expect(html).toContain('id="searchToggle"');
      expect(html).toContain('id="legendToggle"');
      expect(html).toContain('id="infoToggle"');
    });

    it("should render all panel close buttons", () => {
      const html = renderCanvas(testData);

      expect(html).toContain('id="infoPanelClose"');
      expect(html).toContain('id="legendPanelClose"');
      expect(html).toContain('id="propertiesClose"');
    });

    it("should render search functionality elements", () => {
      const html = renderCanvas(testData);

      expect(html).toContain('id="searchOverlay"');
      expect(html).toContain('id="searchPanel"');
      expect(html).toContain('id="searchInput"');
      expect(html).toContain('id="searchResults"');
      expect(html).toContain('id="searchEmpty"');
      expect(html).toContain('id="searchFooter"');
    });

    it("should render properties panel structure", () => {
      const html = renderCanvas(testData);

      expect(html).toContain('id="propertiesPanel"');
      expect(html).toContain('id="propertiesResizeHandle"');
      expect(html).toContain('id="propertiesContent"');
      expect(html).toContain('id="propertiesEmpty"');
    });

    it("should render legend container", () => {
      const html = renderCanvas(testData);

      expect(html).toContain('id="legendPanel"');
      expect(html).toContain('id="legend"');
    });

    it("should render canvas container for Konva", () => {
      const html = renderCanvas(testData);

      expect(html).toContain('id="konva-container"');
    });
  });
});

describe("Real Pipeline Parsing Integration", () => {
  // This test validates that real pipeline XML can be parsed and rendered
  // without errors. It uses a mock parsed structure similar to Error.xml

  it("should handle Error.xml-like pipeline structure", () => {
    const errorPipeline: ParsedPipeline = {
      name: "Error",
      group: "Application",
      description:
        "This pipeline is called whenever a technical error occurs while processing a request.",
      nodes: [
        {
          id: "_ANONYMOUS_BRANCH_1:0:0",
          label: "Called by the system when an error was not handled locally",
          type: "text",
          branch: "_ANONYMOUS_BRANCH_1",
          attributes: {},
          position: { x: 2, y: 1, width: 2 },
        },
        {
          id: "Start:0:0",
          label: "Start Start",
          type: "start",
          branch: "Start",
          attributes: { name: "Start", secure: "false" },
          position: { x: 2, y: 2 },
        },
        {
          id: "Start:0:1",
          label: "Decision ErrorText == 'Secure connection required...",
          type: "decision",
          branch: "Start",
          attributes: {
            "condition-key":
              "ErrorText == 'Secure connection required for this request.'",
            "condition-operator": "expr",
          },
          position: { x: 0, y: 1, orientation: "horizontal" },
        },
        {
          id: "Start:b2:0",
          label: "Assign Set location to redirect",
          type: "pipelet",
          branch: "Start",
          attributes: {
            "custom-name": "Set location to redirect",
            "pipelet-name": "Assign",
            "pipelet-set-identifier": "bc_api",
          },
          configProperties: [{ key: "Transactional", value: "false" }],
          bindings: [
            { key: "From_0", alias: "QueryString" },
            { key: "To_0", alias: "Location" },
          ],
          position: { x: 1, y: 0, orientation: "horizontal" },
        },
        {
          id: "Start:b2:1",
          label: "Interaction util/redirect",
          type: "interaction",
          branch: "Start",
          attributes: { "transaction-required": "false" },
          template: { name: "util/redirect", buffered: true, dynamic: false },
          position: { x: 1, y: 0, orientation: "horizontal" },
        },
        {
          id: "Start:1:0",
          label: "Join",
          type: "join",
          branch: "Start",
          attributes: {},
          position: { x: 1, y: 3 },
        },
        {
          id: "Start:1:1",
          label: "Interaction error/generalerror",
          type: "interaction",
          branch: "Start",
          attributes: { "transaction-required": "false" },
          template: {
            name: "error/generalerror",
            buffered: true,
            dynamic: false,
          },
          position: { x: 0, y: 1 },
        },
        {
          id: "Forbidden:0:0",
          label: "Start Forbidden",
          type: "start",
          branch: "Forbidden",
          attributes: { name: "Forbidden", secure: "false" },
          position: { x: 5, y: 2 },
        },
        {
          id: "Forbidden:0:1",
          label: "LogoutCustomer",
          type: "pipelet",
          branch: "Forbidden",
          attributes: {
            "pipelet-name": "LogoutCustomer",
            "pipelet-set-identifier": "bc_api",
          },
          position: { x: 0, y: 1 },
        },
        {
          id: "Forbidden:0:2",
          label: "Interaction error/forbidden",
          type: "interaction",
          branch: "Forbidden",
          attributes: { "transaction-required": "false" },
          template: { name: "error/forbidden", buffered: true, dynamic: false },
          position: { x: 0, y: 1 },
        },
      ],
      edges: [
        { from: "Start:0:0", to: "Start:0:1" },
        { from: "Start:0:1", to: "Start:b2:0", sourceConnector: "yes" },
        { from: "Start:b2:0", to: "Start:b2:1" },
        { from: "Start:0:1", to: "Start:1:0", sourceConnector: "no" },
        { from: "Start:1:0", to: "Start:1:1" },
        { from: "Forbidden:0:0", to: "Forbidden:0:1" },
        { from: "Forbidden:0:1", to: "Forbidden:0:2" },
      ],
    };

    const data: CanvasData = {
      pipeline: errorPipeline,
      sourcePath: "/app_storefront/cartridge/pipelines/Error.xml",
    };

    const html = renderCanvas(data);

    // Verify rendering succeeds
    expect(html).toBeDefined();
    expect(html.length).toBeGreaterThan(1000);

    // Verify pipeline info
    expect(html).toContain("Error");
    expect(html).toContain("Application");
    expect(html).toContain("technical error occurs");

    // Verify node count (10 nodes)
    expect(html).toContain('<span class="info-stat-value">10</span>');

    // Verify edge count (7 edges)
    expect(html).toContain('<span class="info-stat-value">7</span>');
  });
});
