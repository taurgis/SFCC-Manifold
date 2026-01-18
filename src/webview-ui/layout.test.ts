import { describe, it, expect } from "vitest";
import { calculateLayout, buildNodeMap, calculateBounds } from "./layout";
import type { PipelineNode } from "./types";

// Helper to create mock nodes
function createNode(
  id: string,
  branch: string,
  x?: number,
  y?: number,
  type: string = "pipelet"
): PipelineNode {
  return {
    id,
    label: `Node ${id}`,
    type: type as PipelineNode["type"],
    branch,
    attributes: {},
    configProperties: [],
    bindings: [],
    template: null,
    description: null,
    position: x !== undefined ? { x, y } : undefined,
  };
}

describe("calculateLayout", () => {
  describe("basic layout", () => {
    it("should position single node at base coordinates", () => {
      const nodes: PipelineNode[] = [createNode("Start:0:0", "Start", 0, 0)];

      const result = calculateLayout(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].x).toBe(60); // baseX
      expect(result[0].y).toBe(60); // baseY
    });

    it("should position nodes in a vertical sequence", () => {
      const nodes: PipelineNode[] = [
        createNode("Start:0:0", "Start", 0, 0),
        createNode("Start:0:1", "Start", 0, 1),
        createNode("Start:0:2", "Start", 0, 2),
      ];

      const result = calculateLayout(nodes);

      expect(result).toHaveLength(3);
      // Nodes should be vertically spaced
      expect(result[0].y).toBeLessThan(result[1].y);
      expect(result[1].y).toBeLessThan(result[2].y);
      // Nodes should be horizontally aligned
      expect(result[0].x).toBe(result[1].x);
      expect(result[1].x).toBe(result[2].x);
    });

    it("should position nodes in a horizontal sequence", () => {
      const nodes: PipelineNode[] = [
        createNode("Start:0:0", "Start", 0, 0),
        createNode("Start:0:1", "Start", 1, 0),
        createNode("Start:0:2", "Start", 2, 0),
      ];

      const result = calculateLayout(nodes);

      expect(result).toHaveLength(3);
      // Nodes should be horizontally spaced
      expect(result[0].x).toBeLessThan(result[1].x);
      expect(result[1].x).toBeLessThan(result[2].x);
      // Nodes should be vertically aligned
      expect(result[0].y).toBe(result[1].y);
      expect(result[1].y).toBe(result[2].y);
    });
  });

  describe("nested branches", () => {
    it("should position nested branch nodes relative to parent", () => {
      const nodes: PipelineNode[] = [
        createNode("Start:0:0", "Start", 0, 0, "decision"),
        createNode("Start:0:0/yes:0:0", "Start:0:0/yes", 1, 0),
      ];

      const result = calculateLayout(nodes);

      expect(result).toHaveLength(2);
      // Nested node should be to the right of parent
      expect(result[1].x).toBeGreaterThan(result[0].x);
    });

    it("should handle multiple branches from same node", () => {
      const nodes: PipelineNode[] = [
        createNode("Start:0:0", "Start", 0, 0, "decision"),
        createNode("Start:0:0/yes:0:0", "Start:0:0/yes", 1, 0),
        createNode("Start:0:0/no:0:0", "Start:0:0/no", -1, 0),
      ];

      const result = calculateLayout(nodes);

      expect(result).toHaveLength(3);
      // "no" branch should be to the left
      expect(result[2].x).toBeLessThan(result[0].x);
      // "yes" branch should be to the right
      expect(result[1].x).toBeGreaterThan(result[0].x);
    });
  });

  describe("grid coordinates preservation", () => {
    it("should preserve grid coordinates when preserveGrid option is true", () => {
      const nodes: PipelineNode[] = [
        createNode("Start:0:0", "Start", 0, 0),
        createNode("Start:0:1", "Start", 1, 1),
      ];

      const result = calculateLayout(nodes, { preserveGrid: true });

      expect(result[0].gridX).toBe(0);
      expect(result[0].gridY).toBe(0);
      expect(result[1].gridX).toBe(1);
      expect(result[1].gridY).toBe(1);
    });

    it("should not include grid coordinates by default", () => {
      const nodes: PipelineNode[] = [createNode("Start:0:0", "Start", 0, 0)];

      const result = calculateLayout(nodes);

      expect(result[0].gridX).toBeUndefined();
      expect(result[0].gridY).toBeUndefined();
    });
  });

  describe("negative coordinate normalization", () => {
    it("should normalize negative grid coordinates", () => {
      const nodes: PipelineNode[] = [
        createNode("Start:0:0", "Start", 0, 0),
        createNode("Start:0:0/left:0:0", "Start:0:0/left", -2, 0),
      ];

      const result = calculateLayout(nodes, { preserveGrid: true });

      // After normalization, minimum should be 0
      const minGridX = Math.min(...result.map((n) => n.gridX ?? 0));
      expect(minGridX).toBe(0);
    });
  });

  describe("node properties preservation", () => {
    it("should preserve all node properties in output", () => {
      const nodes: PipelineNode[] = [
        {
          id: "Start:0:0",
          label: "Test Node",
          type: "pipelet",
          branch: "Start",
          attributes: { key: "value" },
          configProperties: [{ key: "Script", value: "test.ds" }],
          bindings: [{ key: "Input", alias: "MyInput" }],
          template: null,
          description: null,
          position: { x: 0, y: 0, orientation: "vertical" },
        },
      ];

      const result = calculateLayout(nodes);

      expect(result[0].id).toBe("Start:0:0");
      expect(result[0].label).toBe("Test Node");
      expect(result[0].type).toBe("pipelet");
      expect(result[0].branch).toBe("Start");
      expect(result[0].attributes).toEqual({ key: "value" });
      expect(result[0].configProperties).toEqual([{ key: "Script", value: "test.ds" }]);
      expect(result[0].bindings).toEqual([{ key: "Input", alias: "MyInput" }]);
      expect(result[0].orientation).toBe("vertical");
    });
  });

  describe("fallback layout", () => {
    it("should handle nodes without position data", () => {
      const nodes: PipelineNode[] = [
        { id: "n1", label: "Node 1", type: "start", branch: "Start", attributes: {}, configProperties: [], bindings: [], template: null, description: null },
        { id: "n2", label: "Node 2", type: "end", branch: "Start", attributes: {}, configProperties: [], bindings: [], template: null, description: null },
      ];

      const result = calculateLayout(nodes);

      expect(result).toHaveLength(2);
      // Should still produce valid positions
      expect(typeof result[0].x).toBe("number");
      expect(typeof result[0].y).toBe("number");
    });
  });
});

describe("buildNodeMap", () => {
  it("should create a map from node ID to node", () => {
    const nodes = [
      { id: "n1", label: "Node 1", type: "start" as const, branch: "Start", attributes: {}, x: 0, y: 0 },
      { id: "n2", label: "Node 2", type: "end" as const, branch: "Start", attributes: {}, x: 100, y: 100 },
    ];

    const map = buildNodeMap(nodes as any);

    expect(map["n1"]).toBe(nodes[0]);
    expect(map["n2"]).toBe(nodes[1]);
  });

  it("should handle empty node list", () => {
    const map = buildNodeMap([]);

    expect(Object.keys(map)).toHaveLength(0);
  });
});

describe("calculateBounds", () => {
  it("should calculate bounds from placed nodes", () => {
    const nodes = [
      { id: "n1", x: 60, y: 60 },
      { id: "n2", x: 280, y: 170 },
    ];

    const bounds = calculateBounds(nodes as any);

    // maxX should be rightmost node x + nodeWidth + horizontalGap
    expect(bounds.maxX).toBeGreaterThan(280);
    // maxY should be bottom node y + nodeHeight + verticalGap
    expect(bounds.maxY).toBeGreaterThan(170);
  });

  it("should return base values for empty node list", () => {
    const bounds = calculateBounds([]);

    expect(bounds.maxX).toBeGreaterThan(0);
    expect(bounds.maxY).toBeGreaterThan(0);
  });
});

describe("calculateLayout - additional scenarios", () => {
  describe("complex branch structures", () => {
    it("should handle deeply nested branch paths with colons", () => {
      const nodes: PipelineNode[] = [
        createNode("Start:0:0", "Start", 0, 0, "decision"),
        createNode("Start:0:0:branch:0:1", "Start:0:0/branch", 1, 1),
        createNode("Start:0:0:branch:0:1:nested:0:2", "Start:0:0/branch:0:1/nested", 2, 2),
      ];

      const result = calculateLayout(nodes);

      expect(result).toHaveLength(3);
      expect(typeof result[0].x).toBe("number");
      expect(typeof result[1].x).toBe("number");
      expect(typeof result[2].x).toBe("number");
    });

    it("should handle branch with special path syntax", () => {
      const nodes: PipelineNode[] = [
        createNode("Start:0:0", "Start", 0, 0),
        createNode("Start:0:0/yes:0:1", "Start:0:0/yes", 1, 1),
        createNode("Start:0:0/yes:0:1/nested:0:2", "Start:0:0/yes:0:1/nested", 2, 2),
      ];

      const result = calculateLayout(nodes);

      expect(result).toHaveLength(3);
    });
  });

  describe("first node in branch detection", () => {
    it("should detect first node in a new branch", () => {
      const nodes: PipelineNode[] = [
        createNode("Start:0:0", "Start", 0, 0),
        createNode("Other:0:0", "Other", 2, 0),
      ];

      const result = calculateLayout(nodes);

      expect(result).toHaveLength(2);
      // Different branches should produce different X positions
      expect(result[0].x).not.toBe(result[1].x);
    });

    it("should not detect second node as first in branch", () => {
      const nodes: PipelineNode[] = [
        createNode("Start:0:0", "Start", 0, 0),
        createNode("Start:0:1", "Start", 0, 1),
      ];

      const result = calculateLayout(nodes);

      expect(result).toHaveLength(2);
      // Same branch should have same X
      expect(result[0].x).toBe(result[1].x);
    });
  });

  describe("previous node position finding", () => {
    it("should find previous node in the same branch", () => {
      const nodes: PipelineNode[] = [
        createNode("Start:0:0", "Start", 0, 0),
        createNode("Start:0:1", "Start", 0, 1),
        createNode("Start:0:2", "Start", 0, 2),
      ];

      const result = calculateLayout(nodes);

      expect(result).toHaveLength(3);
      // All should be vertically aligned
      expect(result[0].x).toBe(result[1].x);
      expect(result[1].x).toBe(result[2].x);
    });
  });

  describe("parent node position fallback", () => {
    it("should handle missing parent node gracefully", () => {
      const nodes: PipelineNode[] = [
        createNode("Orphan/child:0:0", "Orphan/child", 0, 0),
      ];

      const result = calculateLayout(nodes);

      expect(result).toHaveLength(1);
      expect(typeof result[0].x).toBe("number");
      expect(typeof result[0].y).toBe("number");
    });

    it("should handle branch with no slash", () => {
      const nodes: PipelineNode[] = [
        createNode("SingleBranch:0:0", "SingleBranch", 0, 0),
      ];

      const result = calculateLayout(nodes);

      expect(result).toHaveLength(1);
      expect(typeof result[0].x).toBe("number");
    });
  });

  describe("orientation handling", () => {
    it("should preserve horizontal orientation", () => {
      const nodes: PipelineNode[] = [
        {
          id: "Start:0:0",
          label: "Node",
          type: "pipelet",
          branch: "Start",
          attributes: {},
          configProperties: [],
          bindings: [],
          template: null,
          description: null,
          position: { x: 0, y: 0, orientation: "horizontal" },
        },
      ];

      const result = calculateLayout(nodes);

      expect(result[0].orientation).toBe("horizontal");
    });
  });

  describe("node type handling", () => {
    it("should handle all node types", () => {
      const nodeTypes = ["start", "end", "pipelet", "decision", "join", "interaction", "loop"] as const;
      const nodes: PipelineNode[] = nodeTypes.map((type, i) =>
        createNode(`${type}:0:${i}`, "Start", 0, i, type)
      );

      const result = calculateLayout(nodes);

      expect(result).toHaveLength(nodeTypes.length);
      result.forEach((node, i) => {
        expect(node.type).toBe(nodeTypes[i]);
      });
    });
  });

  describe("template and description handling", () => {
    it("should preserve template property", () => {
      const nodes: PipelineNode[] = [
        {
          id: "Start:0:0",
          label: "Node",
          type: "pipelet",
          branch: "Start",
          attributes: {},
          configProperties: [],
          bindings: [],
          template: { name: "My Template" },
          description: null,
          position: { x: 0, y: 0 },
        },
      ];

      const result = calculateLayout(nodes);

      expect(result[0].template).toEqual({ name: "My Template" });
    });

    it("should preserve description property", () => {
      const nodes: PipelineNode[] = [
        {
          id: "Start:0:0",
          label: "Node",
          type: "pipelet",
          branch: "Start",
          attributes: {},
          configProperties: [],
          bindings: [],
          template: null,
          description: "My Description",
          position: { x: 0, y: 0 },
        },
      ];

      const result = calculateLayout(nodes);

      expect(result[0].description).toBe("My Description");
    });

    it("should handle null template and description", () => {
      const nodes: PipelineNode[] = [
        {
          id: "Start:0:0",
          label: "Node",
          type: "pipelet",
          branch: "Start",
          attributes: {},
          configProperties: [],
          bindings: [],
          template: null,
          description: null,
          position: { x: 0, y: 0 },
        },
      ];

      const result = calculateLayout(nodes);

      expect(result[0].template).toBeNull();
      expect(result[0].description).toBeNull();
    });
  });

  describe("empty attributes handling", () => {
    it("should handle undefined attributes", () => {
      const nodes: PipelineNode[] = [
        {
          id: "Start:0:0",
          label: "Node",
          type: "pipelet",
          branch: "Start",
          // No attributes property
        } as PipelineNode,
      ];

      const result = calculateLayout(nodes);

      expect(result[0].attributes).toBeDefined();
    });
  });
});
