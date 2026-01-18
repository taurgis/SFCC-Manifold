/**
 * Channel-based edge routing
 *
 * Tracks "channels" - shared vertical/horizontal paths that multiple edges
 * can merge into for cleaner routing. This prevents overlapping edges when
 * multiple connections head to the same target side.
 *
 * A channel represents a reusable path segment (vertical or horizontal line)
 * that edges can join rather than creating parallel overlapping paths.
 */

import type { Point } from "../types";
import { EDGE_SPACING } from "../constants";
import type { Segment } from "./collision";

/**
 * Represents a shared routing channel that edges can merge into
 */
export interface EdgeChannel {
  /** The fixed coordinate (x for vertical, y for horizontal) */
  position: number;
  /** Start of the channel range */
  start: number;
  /** End of the channel range */
  end: number;
  /** Direction: 'vertical' or 'horizontal' */
  direction: "vertical" | "horizontal";
  /** Target node ID this channel leads to */
  targetNodeId: string;
  /** Which side of the target node this channel enters */
  targetSide: string;
  /** Number of edges using this channel (for offset calculation) */
  edgeCount: number;
  /** Source segments that contributed to this channel */
  sourceSegments: Segment[];
}

/**
 * Manages routing channels for edge deduplication
 */
export class ChannelRegistry {
  private channels: EdgeChannel[] = [];

  /**
   * Register segments from a drawn edge as potential merge targets
   */
  registerEdge(
    segments: Segment[],
    targetNodeId: string,
    targetSide: string
  ): void {
    for (const seg of segments) {
      const isVertical = Math.abs(seg.x1 - seg.x2) < 5;
      const isHorizontal = Math.abs(seg.y1 - seg.y2) < 5;

      if (isVertical) {
        const x = (seg.x1 + seg.x2) / 2;
        const minY = Math.min(seg.y1, seg.y2);
        const maxY = Math.max(seg.y1, seg.y2);

        // Find existing channel or create new one
        const existingChannel = this.findMatchingChannel(
          x,
          "vertical",
          targetNodeId,
          targetSide
        );

        if (existingChannel) {
          // Extend the channel range
          existingChannel.start = Math.min(existingChannel.start, minY);
          existingChannel.end = Math.max(existingChannel.end, maxY);
          existingChannel.edgeCount++;
          existingChannel.sourceSegments.push(seg);
        } else {
          this.channels.push({
            position: x,
            start: minY,
            end: maxY,
            direction: "vertical",
            targetNodeId,
            targetSide,
            edgeCount: 1,
            sourceSegments: [seg],
          });
        }
      } else if (isHorizontal) {
        const y = (seg.y1 + seg.y2) / 2;
        const minX = Math.min(seg.x1, seg.x2);
        const maxX = Math.max(seg.x1, seg.x2);

        const existingChannel = this.findMatchingChannel(
          y,
          "horizontal",
          targetNodeId,
          targetSide
        );

        if (existingChannel) {
          existingChannel.start = Math.min(existingChannel.start, minX);
          existingChannel.end = Math.max(existingChannel.end, maxX);
          existingChannel.edgeCount++;
          existingChannel.sourceSegments.push(seg);
        } else {
          this.channels.push({
            position: y,
            start: minX,
            end: maxX,
            direction: "horizontal",
            targetNodeId,
            targetSide,
            edgeCount: 1,
            sourceSegments: [seg],
          });
        }
      }
    }
  }

  /**
   * Find a channel that matches position (within tolerance), direction, and target
   */
  private findMatchingChannel(
    position: number,
    direction: "vertical" | "horizontal",
    targetNodeId: string,
    targetSide: string
  ): EdgeChannel | undefined {
    const tolerance = EDGE_SPACING * 2; // Allow some tolerance for merging
    return this.channels.find(
      (ch) =>
        ch.direction === direction &&
        ch.targetNodeId === targetNodeId &&
        ch.targetSide === targetSide &&
        Math.abs(ch.position - position) < tolerance
    );
  }

  /**
   * Find a vertical channel that an edge can merge into when approaching a target
   *
   * @param targetNodeId - The target node we're routing to
   * @param targetSide - The side we'll enter the target from
   * @param approachY - The Y coordinate where we'd join the channel
   * @param sourceX - The X coordinate we're coming from
   * @returns Channel info with merge point, or null if no suitable channel
   */
  findMergeableVerticalChannel(
    targetNodeId: string,
    targetSide: string,
    approachY: number,
    _sourceX: number
  ): { channel: EdgeChannel; mergePoint: Point; offset: number } | null {
    // Find vertical channels leading to this target side
    const candidates = this.channels.filter(
      (ch) =>
        ch.direction === "vertical" &&
        ch.targetNodeId === targetNodeId &&
        ch.targetSide === targetSide &&
        // Channel must extend to or past our approach Y
        approachY >= ch.start - 50 &&
        approachY <= ch.end + 50
    );

    if (candidates.length === 0) {
      return null;
    }

    // For vertical channels, pick the one that's most suitable for parallel routing
    // We want to run parallel to existing edges, not overlap them
    const bestChannel = candidates[0]; // Use first matching channel

    // Calculate offset for this edge (spacing from channel center)
    // Offset direction depends on which side we're entering:
    // - For right-side entry, offset should push edges further right (positive)
    // - For left-side entry, offset should push edges further left (negative)
    const offsetDirection = targetSide === "right" ? 1 : -1;
    const offset = bestChannel.edgeCount * EDGE_SPACING * offsetDirection;

    // The merge point is where we join the channel (parallel to existing edges)
    const mergePoint: Point = {
      x: bestChannel.position + offset,
      y: Math.max(bestChannel.start, Math.min(approachY, bestChannel.end)),
    };

    return { channel: bestChannel, mergePoint, offset };
  }

  /**
   * Find a horizontal channel for merging
   */
  findMergeableHorizontalChannel(
    targetNodeId: string,
    targetSide: string,
    approachX: number,
    _sourceY: number
  ): { channel: EdgeChannel; mergePoint: Point; offset: number } | null {
    const candidates = this.channels.filter(
      (ch) =>
        ch.direction === "horizontal" &&
        ch.targetNodeId === targetNodeId &&
        ch.targetSide === targetSide &&
        approachX >= ch.start - 50 &&
        approachX <= ch.end + 50
    );

    if (candidates.length === 0) {
      return null;
    }

    const bestChannel = candidates[0];

    // Offset direction depends on which side we're entering:
    // - For top entry, offset should push edges further up (negative)
    // - For bottom entry, offset should push edges further down (positive)
    const offsetDirection = targetSide === "bottom" ? 1 : -1;
    const offset = bestChannel.edgeCount * EDGE_SPACING * offsetDirection;

    const mergePoint: Point = {
      x: Math.max(bestChannel.start, Math.min(approachX, bestChannel.end)),
      y: bestChannel.position + offset,
    };

    return { channel: bestChannel, mergePoint, offset };
  }

  /**
   * Clear all channels (for fresh routing)
   */
  clear(): void {
    this.channels = [];
  }

  /**
   * Get all registered channels (for debugging)
   */
  getChannels(): readonly EdgeChannel[] {
    return this.channels;
  }
}

/**
 * Build a path that merges into an existing channel
 *
 * @param start - Start point of edge
 * @param mergePoint - Point where we join the channel (already includes offset)
 * @param end - End point (target anchor)
 * @param outSide - Exit side from source node
 * @param channelDirection - Direction of the channel we're merging into
 * @returns Path points array
 */
export function buildMergedChannelPath(
  start: Point,
  mergePoint: Point,
  end: Point,
  outSide: string,
  channelDirection: "vertical" | "horizontal"
): number[] {
  const points: number[] = [start.x, start.y];

  if (channelDirection === "vertical") {
    // Merging into a vertical channel
    // The channel runs vertically at mergePoint.x
    // We need to get to that X position, then travel along the channel

    if (outSide === "bottom" || outSide === "top") {
      // Exiting vertically - need to get to channel X
      if (Math.abs(start.x - mergePoint.x) > 5) {
        // Source not aligned with channel - need to turn
        // First go a short distance in exit direction, then horizontal to channel
        const initialOffset = outSide === "bottom" ? 30 : -30;
        const turnY = start.y + initialOffset;
        points.push(start.x, turnY);
        points.push(mergePoint.x, turnY);
      }
      // Now travel down/up the channel to approach the target
      // The channel leads to the target side entry point
      points.push(mergePoint.x, end.y);
    } else {
      // Exiting horizontally (left/right)
      // Go horizontal to channel X, then vertical down
      points.push(mergePoint.x, start.y);
      points.push(mergePoint.x, end.y);
    }
  } else {
    // Merging into a horizontal channel
    // The channel runs horizontally at mergePoint.y

    if (outSide === "left" || outSide === "right") {
      if (Math.abs(start.y - mergePoint.y) > 5) {
        // Need to get to channel Y
        const initialOffset = outSide === "right" ? 30 : -30;
        const turnX = start.x + initialOffset;
        points.push(turnX, start.y);
        points.push(turnX, mergePoint.y);
      }
      points.push(end.x, mergePoint.y);
    } else {
      points.push(start.x, mergePoint.y);
      points.push(end.x, mergePoint.y);
    }
  }

  points.push(end.x, end.y);
  return points;
}
