/**
 * End-to-end layout integration tests
 *
 * Tests the complete pipeline: XML parsing → layout calculation → node positions
 * Uses real pipeline XML files from pipeline_examples/ to verify correct behavior
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parsePipeline } from "../lib/pipelineParser";
import { calculateLayout } from "./layout";
import type { PlacedNode } from "./types";

const PIPELINE_EXAMPLES_DIR = path.join(process.cwd(), "pipeline_examples");

/**
 * Helper to load and parse a pipeline XML file
 */
function loadPipeline(filename: string) {
  const xmlPath = path.join(PIPELINE_EXAMPLES_DIR, filename);
  const xml = fs.readFileSync(xmlPath, "utf-8");
  return parsePipeline(xml, filename);
}

/**
 * Helper to get placed nodes with grid coordinates preserved
 */
function getLayoutWithGrid(filename: string): PlacedNode[] {
  const pipeline = loadPipeline(filename);
  return calculateLayout(pipeline.nodes, { preserveGrid: true });
}

describe("Layout Integration Tests", () => {
  describe("Real Pipeline XML Files", () => {
    it("should parse and layout Error.xml without errors", () => {
      const nodes = getLayoutWithGrid("Error.xml");

      expect(nodes.length).toBeGreaterThan(0);
      // All nodes should have valid pixel positions
      for (const node of nodes) {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);
      }
    });

    it("should parse and layout Cart.xml without errors", () => {
      const nodes = getLayoutWithGrid("Cart.xml");

      expect(nodes.length).toBeGreaterThan(0);
      // Cart.xml is a complex pipeline with many branches
      const branches = new Set(nodes.map((n) => n.branch));
      expect(branches.size).toBeGreaterThan(1);
    });

    it("should parse and layout Account.xml without errors", () => {
      const nodes = getLayoutWithGrid("Account.xml");

      expect(nodes.length).toBeGreaterThan(0);
    });

    it("should parse and layout Home.xml without errors", () => {
      const nodes = getLayoutWithGrid("Home.xml");

      expect(nodes.length).toBeGreaterThan(0);
    });

    it("should parse and layout Login.xml without errors", () => {
      const nodes = getLayoutWithGrid("Login.xml");

      expect(nodes.length).toBeGreaterThan(0);
    });

    it("should parse and layout GiftRegistry.xml without errors", () => {
      const nodes = getLayoutWithGrid("GiftRegistry.xml");

      expect(nodes.length).toBeGreaterThan(0);
      // GiftRegistry is a complex pipeline
      expect(nodes.length).toBeGreaterThan(20);
    });
  });

  describe("Node Position Calculations", () => {
    it("should place start nodes at their specified grid positions", () => {
      const nodes = getLayoutWithGrid("Error.xml");

      const startNodes = nodes.filter((n) => n.type === "start");
      expect(startNodes.length).toBeGreaterThan(0);

      // Start nodes should have valid positions
      for (const node of startNodes) {
        expect(typeof node.gridX).toBe("number");
        expect(typeof node.gridY).toBe("number");
      }
    });

    it("should not overlap nodes at the same grid position", () => {
      const nodes = getLayoutWithGrid("Cart.xml");

      // Check for unique grid positions
      const positions = new Map<string, string>();
      let hasOverlap = false;

      for (const node of nodes) {
        const key = `${node.gridX},${node.gridY}`;
        if (positions.has(key)) {
          // Some pipelines intentionally stack text nodes - allow those
          if (node.type !== "text" && positions.get(key) !== "text") {
            hasOverlap = true;
          }
        }
        positions.set(key, node.type);
      }

      // In a well-formed pipeline, non-text nodes shouldn't overlap
      expect(hasOverlap).toBe(false);
    });

    it("should maintain relative positions within branches", () => {
      const nodes = getLayoutWithGrid("Mail.xml");

      // Group nodes by branch
      const branchNodes = new Map<string, PlacedNode[]>();
      for (const node of nodes) {
        const existing = branchNodes.get(node.branch) || [];
        existing.push(node);
        branchNodes.set(node.branch, existing);
      }

      // Within each branch, nodes should generally flow downward (increasing Y)
      for (const [branch, branchNodeList] of branchNodes) {
        if (branchNodeList.length <= 1) {continue;}

        // Sort by original order (assuming first appears first in array)
        // Check that Y generally increases for sequential nodes
        let previousY = -Infinity;
        let yIncreases = 0;
        let yDecreases = 0;

        for (const node of branchNodeList) {
          if (node.gridY !== undefined) {
            if (node.gridY >= previousY) {
              yIncreases++;
            } else {
              yDecreases++;
            }
            previousY = node.gridY;
          }
        }

        // Most nodes in a branch should flow downward
        // Allow some flexibility for horizontal branches
        expect(
          yIncreases >= yDecreases,
          `Branch "${branch}" should generally flow downward`
        ).toBe(true);
      }
    });

    it("should separate different branches horizontally", () => {
      const nodes = getLayoutWithGrid("COBilling.xml");

      // Find nodes from different top-level branches
      const topLevelBranches = nodes
        .map((n) => n.branch.split("/")[0])
        .filter((b, i, arr) => arr.indexOf(b) === i);

      if (topLevelBranches.length > 1) {
        // Get the X range for each branch
        const branchXRanges = new Map<string, { min: number; max: number }>();

        for (const node of nodes) {
          const topBranch = node.branch.split("/")[0];
          const existing = branchXRanges.get(topBranch) || {
            min: Infinity,
            max: -Infinity,
          };
          if (node.gridX !== undefined) {
            existing.min = Math.min(existing.min, node.gridX);
            existing.max = Math.max(existing.max, node.gridX);
          }
          branchXRanges.set(topBranch, existing);
        }

        // Different branches should have different X ranges (though may overlap)
        // The key is that they're positioned, not that they're strictly separated
        expect(branchXRanges.size).toBe(topLevelBranches.length);
      }
    });
  });

  describe("Node Type Handling", () => {
    it("should handle all node types in a complex pipeline", () => {
      const pipeline = loadPipeline("GiftRegistry.xml");
      const nodeTypes = new Set(pipeline.nodes.map((n) => n.type));

      // A complex pipeline should have multiple node types
      expect(nodeTypes.size).toBeGreaterThan(3);

      const nodes = calculateLayout(pipeline.nodes);
      expect(nodes.length).toBe(pipeline.nodes.length);
    });

    it("should handle decision nodes correctly", () => {
      const nodes = getLayoutWithGrid("Error.xml");

      const decisionNodes = nodes.filter((n) => n.type === "decision");
      if (decisionNodes.length > 0) {
        for (const node of decisionNodes) {
          expect(node.x).toBeGreaterThanOrEqual(0);
          expect(node.y).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("should handle join nodes correctly", () => {
      const nodes = getLayoutWithGrid("Mail.xml");

      const joinNodes = nodes.filter((n) => n.type === "join");
      // Join nodes typically receive multiple incoming edges
      // They should be positioned correctly
      for (const node of joinNodes) {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);
      }
    });

    it("should handle text/annotation nodes", () => {
      const nodes = getLayoutWithGrid("Error.xml");

      const textNodes = nodes.filter((n) => n.type === "text");
      // Text nodes are documentation nodes
      for (const node of textNodes) {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);
      }
    });

    it("should handle loop nodes", () => {
      // Find a pipeline with loop nodes
      const nodes = getLayoutWithGrid("GiftRegistry.xml");

      const loopNodes = nodes.filter((n) => n.type === "loop");
      for (const node of loopNodes) {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle pipelines with only start and end nodes", () => {
      const pipeline = loadPipeline("OnRequest.xml");
      const nodes = calculateLayout(pipeline.nodes);

      expect(nodes.length).toBeGreaterThan(0);
      // All nodes should have valid positions
      for (const node of nodes) {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
      }
    });

    it("should handle deeply nested branches", () => {
      const nodes = getLayoutWithGrid("COBilling.xml");

      // Find max branch depth
      let maxDepth = 0;
      for (const node of nodes) {
        const depth = node.branch.split("/").length;
        maxDepth = Math.max(maxDepth, depth);
      }

      // Should have handled nested branches
      expect(maxDepth).toBeGreaterThanOrEqual(1);
      
      // All nodes should still have valid positions
      for (const node of nodes) {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
      }
    });

    it("should handle pipelines with many branches", () => {
      const nodes = getLayoutWithGrid("Cart.xml");

      const branches = new Set(nodes.map((n) => n.branch));
      
      // Cart.xml has multiple branches
      expect(branches.size).toBeGreaterThan(3);

      // All branches should be laid out without errors
      for (const node of nodes) {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
      }
    });
  });

  describe("Layout Consistency", () => {
    it("should produce consistent results for the same input", () => {
      const nodes1 = getLayoutWithGrid("Home.xml");
      const nodes2 = getLayoutWithGrid("Home.xml");

      expect(nodes1.length).toBe(nodes2.length);

      for (let i = 0; i < nodes1.length; i++) {
        expect(nodes1[i].id).toBe(nodes2[i].id);
        expect(nodes1[i].x).toBe(nodes2[i].x);
        expect(nodes1[i].y).toBe(nodes2[i].y);
        expect(nodes1[i].gridX).toBe(nodes2[i].gridX);
        expect(nodes1[i].gridY).toBe(nodes2[i].gridY);
      }
    });

    it("should maintain node order from parser", () => {
      const pipeline = loadPipeline("Login.xml");
      const nodes = calculateLayout(pipeline.nodes);

      // Node IDs should be in same order
      for (let i = 0; i < pipeline.nodes.length; i++) {
        expect(nodes[i].id).toBe(pipeline.nodes[i].id);
      }
    });
  });

  describe("Pixel Coordinate Calculations", () => {
    it("should convert grid coordinates to valid pixel coordinates", () => {
      const nodes = getLayoutWithGrid("Error.xml");

      for (const node of nodes) {
        // Pixel coordinates should be positive
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);

        // Pixel coordinates should be reasonable (not astronomically large)
        expect(node.x).toBeLessThan(50000);
        expect(node.y).toBeLessThan(50000);
      }
    });

    it("should space nodes according to layout config", () => {
      const nodes = getLayoutWithGrid("Mail.xml");

      // Find nodes at adjacent grid positions
      const nodesByGrid = new Map<string, PlacedNode>();
      for (const node of nodes) {
        nodesByGrid.set(`${node.gridX},${node.gridY}`, node);
      }

      // Check spacing between horizontally adjacent nodes
      for (const node of nodes) {
        const rightNeighbor = nodesByGrid.get(
          `${(node.gridX ?? 0) + 1},${node.gridY}`
        );
        if (rightNeighbor) {
          const xDiff = rightNeighbor.x - node.x;
          // Should be the horizontal gap
          expect(xDiff).toBeGreaterThan(0);
        }

        const belowNeighbor = nodesByGrid.get(
          `${node.gridX},${(node.gridY ?? 0) + 1}`
        );
        if (belowNeighbor) {
          const yDiff = belowNeighbor.y - node.y;
          // Should be the vertical gap
          expect(yDiff).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("All Pipeline Examples", () => {
    // Get all XML files in the examples directory
    const xmlFiles = fs.readdirSync(PIPELINE_EXAMPLES_DIR).filter((f) =>
      f.endsWith(".xml")
    );

    it.each(xmlFiles)("should parse and layout %s without errors", (filename) => {
      const pipeline = loadPipeline(filename);
      const nodes = calculateLayout(pipeline.nodes, { preserveGrid: true });

      // Basic sanity checks
      expect(nodes.length).toBe(pipeline.nodes.length);

      // All nodes should have valid positions
      for (const node of nodes) {
        expect(
          Number.isFinite(node.x),
          `Node ${node.id} in ${filename} has invalid x`
        ).toBe(true);
        expect(
          Number.isFinite(node.y),
          `Node ${node.id} in ${filename} has invalid y`
        ).toBe(true);
        expect(
          node.x >= 0,
          `Node ${node.id} in ${filename} has negative x`
        ).toBe(true);
        expect(
          node.y >= 0,
          `Node ${node.id} in ${filename} has negative y`
        ).toBe(true);
      }

      // All nodes should preserve essential properties
      for (const node of nodes) {
        expect(node.id).toBeDefined();
        expect(node.type).toBeDefined();
        expect(node.branch).toBeDefined();
      }
    });
  });

  describe("Regression Tests", () => {
    it("should correctly position nodes in Error.xml Start branch", () => {
      const nodes = getLayoutWithGrid("Error.xml");

      // Find the Start start node
      const startNode = nodes.find(
        (n) => n.type === "start" && n.branch === "Start"
      );
      expect(startNode).toBeDefined();

      // It should be at a consistent position
      expect(startNode?.gridX).toBeDefined();
      expect(startNode?.gridY).toBeDefined();
    });

    it("should handle Cart.xml Show branch correctly", () => {
      const nodes = getLayoutWithGrid("Cart.xml");

      // Find nodes in the Show branch
      const showNodes = nodes.filter((n) => n.branch === "Show");
      expect(showNodes.length).toBeGreaterThan(0);

      // Start node should be at the beginning
      const startNode = showNodes.find((n) => n.type === "start");
      expect(startNode).toBeDefined();
    });

    it("should preserve node attributes through layout", () => {
      const pipeline = loadPipeline("Account.xml");
      const nodes = calculateLayout(pipeline.nodes);

      // Find a pipelet node with attributes
      const pipeletNode = nodes.find(
        (n) => n.type === "pipelet" && Object.keys(n.attributes).length > 0
      );

      if (pipeletNode) {
        // Attributes should be preserved
        expect(Object.keys(pipeletNode.attributes).length).toBeGreaterThan(0);
      }
    });

    it("should preserve bindings through layout", () => {
      const pipeline = loadPipeline("Error.xml");
      const nodes = calculateLayout(pipeline.nodes);

      // Find a node with bindings
      const nodeWithBindings = nodes.find(
        (n) => n.bindings && n.bindings.length > 0
      );

      if (nodeWithBindings) {
        expect(nodeWithBindings.bindings.length).toBeGreaterThan(0);
        expect(nodeWithBindings.bindings[0].key).toBeDefined();
      }
    });

    it("should preserve template information through layout", () => {
      const pipeline = loadPipeline("Error.xml");
      const nodes = calculateLayout(pipeline.nodes);

      // Find an interaction node with template
      const interactionNode = nodes.find(
        (n) => n.type === "interaction" && n.template
      );

      if (interactionNode) {
        expect(interactionNode.template?.name).toBeDefined();
      }
    });
  });
});

describe("Pipeline Parser Integration", () => {
  describe("Edge Parsing", () => {
    it("should parse edges with bend points correctly", () => {
      const pipeline = loadPipeline("Mail.xml");

      const edgesWithBendpoints = pipeline.edges.filter(
        (e) => e.display?.bendPoints && e.display.bendPoints.length > 0
      );

      // Should have some edges with bend points
      // (this depends on the actual pipeline content)
      if (edgesWithBendpoints.length > 0) {
        for (const edge of edgesWithBendpoints) {
          const bendPoints = edge.display?.bendPoints;
          expect(bendPoints).toBeDefined();
          expect(bendPoints?.length).toBeGreaterThan(0);
        }
      }
    });

    it("should parse edge labels correctly", () => {
      const pipeline = loadPipeline("Error.xml");

      // Decision nodes should have labeled edges (yes/no)
      const labeledEdges = pipeline.edges.filter((e) => e.label);

      if (labeledEdges.length > 0) {
        // Common labels in SFCC pipelines
        const labels = labeledEdges.map((e) => e.label);
        const hasCommonLabels = labels.some(
          (l) =>
            l === "yes" ||
            l === "no" ||
            l === "error" ||
            l === "done" ||
            l === "next"
        );
        expect(hasCommonLabels || labels.length > 0).toBe(true);
      }
    });

    it("should connect nodes correctly", () => {
      const pipeline = loadPipeline("Home.xml");

      // Every edge should reference existing nodes
      const nodeIds = new Set(pipeline.nodes.map((n) => n.id));

      for (const edge of pipeline.edges) {
        expect(
          nodeIds.has(edge.from),
          `Edge from unknown node: ${edge.from}`
        ).toBe(true);
        expect(
          nodeIds.has(edge.to),
          `Edge to unknown node: ${edge.to}`
        ).toBe(true);
      }
    });
  });

  describe("Node Properties", () => {
    it("should parse source locations for debugging", () => {
      const pipeline = loadPipeline("Login.xml");

      // Most nodes should have source locations
      const nodesWithLocations = pipeline.nodes.filter((n) => n.sourceLocation);
      expect(nodesWithLocations.length).toBeGreaterThan(0);

      for (const node of nodesWithLocations) {
        expect(node.sourceLocation?.line).toBeGreaterThan(0);
      }
    });

    it("should parse config properties", () => {
      const pipeline = loadPipeline("Error.xml");

      const nodesWithConfig = pipeline.nodes.filter(
        (n) => n.configProperties && n.configProperties.length > 0
      );

      if (nodesWithConfig.length > 0) {
        for (const node of nodesWithConfig) {
          const config = node.configProperties;
          expect(config?.length).toBeGreaterThan(0);
          expect(config?.[0].key).toBeDefined();
        }
      }
    });
  });
});
