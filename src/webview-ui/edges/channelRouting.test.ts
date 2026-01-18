/**
 * Tests for channel-based edge routing
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ChannelRegistry,
  buildMergedChannelPath,
} from "./channelRouting";
import type { Segment } from "./collision";

describe("ChannelRegistry", () => {
  let registry: ChannelRegistry;

  beforeEach(() => {
    registry = new ChannelRegistry();
  });

  describe("registerEdge", () => {
    it("should register a vertical segment as a channel", () => {
      const segments: Segment[] = [
        { x1: 100, y1: 200, x2: 100, y2: 400 }, // vertical
      ];

      registry.registerEdge(segments, "node1", "right");

      const channels = registry.getChannels();
      expect(channels).toHaveLength(1);
      expect(channels[0].direction).toBe("vertical");
      expect(channels[0].position).toBe(100);
      expect(channels[0].start).toBe(200);
      expect(channels[0].end).toBe(400);
      expect(channels[0].targetNodeId).toBe("node1");
      expect(channels[0].targetSide).toBe("right");
      expect(channels[0].edgeCount).toBe(1);
    });

    it("should register a horizontal segment as a channel", () => {
      const segments: Segment[] = [
        { x1: 100, y1: 300, x2: 400, y2: 300 }, // horizontal
      ];

      registry.registerEdge(segments, "node1", "top");

      const channels = registry.getChannels();
      expect(channels).toHaveLength(1);
      expect(channels[0].direction).toBe("horizontal");
      expect(channels[0].position).toBe(300);
      expect(channels[0].start).toBe(100);
      expect(channels[0].end).toBe(400);
    });

    it("should extend existing channel when same target and side", () => {
      const segments1: Segment[] = [
        { x1: 100, y1: 200, x2: 100, y2: 400 },
      ];
      const segments2: Segment[] = [
        { x1: 100, y1: 350, x2: 100, y2: 500 },
      ];

      registry.registerEdge(segments1, "node1", "right");
      registry.registerEdge(segments2, "node1", "right");

      const channels = registry.getChannels();
      expect(channels).toHaveLength(1);
      expect(channels[0].edgeCount).toBe(2);
      expect(channels[0].start).toBe(200);
      expect(channels[0].end).toBe(500);
    });

    it("should create separate channels for different targets", () => {
      const segments1: Segment[] = [
        { x1: 100, y1: 200, x2: 100, y2: 400 },
      ];
      const segments2: Segment[] = [
        { x1: 100, y1: 200, x2: 100, y2: 400 },
      ];

      registry.registerEdge(segments1, "node1", "right");
      registry.registerEdge(segments2, "node2", "right");

      const channels = registry.getChannels();
      expect(channels).toHaveLength(2);
    });
  });

  describe("findMergeableVerticalChannel", () => {
    it("should find a matching vertical channel", () => {
      const segments: Segment[] = [
        { x1: 810, y1: 430, x2: 810, y2: 650 },
      ];
      registry.registerEdge(segments, "joinNode", "right");

      const result = registry.findMergeableVerticalChannel(
        "joinNode",
        "right",
        650, // approachY
        720  // sourceX
      );

      expect(result).not.toBeNull();
      expect(result?.channel.position).toBe(810);
    });

    it("should return null when no matching channel exists", () => {
      const result = registry.findMergeableVerticalChannel(
        "nonexistent",
        "right",
        650,
        720
      );

      expect(result).toBeNull();
    });

    it("should apply positive offset for right-side entry", () => {
      const segments: Segment[] = [
        { x1: 810, y1: 430, x2: 810, y2: 650 },
      ];
      registry.registerEdge(segments, "joinNode", "right");

      const result = registry.findMergeableVerticalChannel(
        "joinNode",
        "right",
        650,
        810
      );

      expect(result).not.toBeNull();
      // Offset should be positive (push further right)
      expect(result?.mergePoint.x).toBeGreaterThan(810);
    });

    it("should apply negative offset for left-side entry", () => {
      const segments: Segment[] = [
        { x1: 400, y1: 430, x2: 400, y2: 650 },
      ];
      registry.registerEdge(segments, "joinNode", "left");

      const result = registry.findMergeableVerticalChannel(
        "joinNode",
        "left",
        650,
        500
      );

      expect(result).not.toBeNull();
      // Offset should be negative (push further left)
      expect(result?.mergePoint.x).toBeLessThan(400);
    });
  });

  describe("findMergeableHorizontalChannel", () => {
    it("should find a matching horizontal channel", () => {
      const segments: Segment[] = [
        { x1: 400, y1: 300, x2: 600, y2: 300 },
      ];
      registry.registerEdge(segments, "node1", "top");

      const result = registry.findMergeableHorizontalChannel(
        "node1",
        "top",
        500, // approachX
        200  // sourceY
      );

      expect(result).not.toBeNull();
      expect(result?.channel.position).toBe(300);
    });
  });

  describe("clear", () => {
    it("should remove all channels", () => {
      const segments: Segment[] = [
        { x1: 100, y1: 200, x2: 100, y2: 400 },
      ];
      registry.registerEdge(segments, "node1", "right");
      expect(registry.getChannels()).toHaveLength(1);

      registry.clear();
      expect(registry.getChannels()).toHaveLength(0);
    });
  });
});

describe("buildMergedChannelPath", () => {
  describe("vertical channel merge", () => {
    it("should create correct path when exiting bottom and channel is to the right", () => {
      const start = { x: 810, y: 250 };
      const mergePoint = { x: 822, y: 650 };
      const end = { x: 600, y: 650 };

      const path = buildMergedChannelPath(
        start,
        mergePoint,
        end,
        "bottom",
        "vertical"
      );

      // Should go: down a bit, right to channel, down to target Y, left to target
      expect(path[0]).toBe(810); // start x
      expect(path[1]).toBe(250); // start y
      // Path should eventually reach target
      expect(path[path.length - 2]).toBe(600); // end x
      expect(path[path.length - 1]).toBe(650); // end y
    });

    it("should create correct path when exiting right into vertical channel", () => {
      const start = { x: 680, y: 430 };
      const mergePoint = { x: 810, y: 650 };
      const end = { x: 600, y: 650 };

      const path = buildMergedChannelPath(
        start,
        mergePoint,
        end,
        "right",
        "vertical"
      );

      // Should go: right to channel X, down to target Y, left to target
      expect(path).toContain(810); // channel X
      expect(path[path.length - 2]).toBe(600); // end x
      expect(path[path.length - 1]).toBe(650); // end y
    });
  });

  describe("horizontal channel merge", () => {
    it("should create correct path when exiting bottom into horizontal channel", () => {
      const start = { x: 500, y: 250 };
      const mergePoint = { x: 600, y: 300 };
      const end = { x: 600, y: 400 };

      const path = buildMergedChannelPath(
        start,
        mergePoint,
        end,
        "bottom",
        "horizontal"
      );

      expect(path[0]).toBe(500); // start x
      expect(path[1]).toBe(250); // start y
      expect(path[path.length - 2]).toBe(600); // end x
      expect(path[path.length - 1]).toBe(400); // end y
    });
  });
});
