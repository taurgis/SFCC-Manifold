/**
 * Edge drawing and selection module (Konva-specific)
 * 
 * This module handles the visual rendering of edges using Konva.js,
 * delegating routing logic to the shared edge modules.
 */

import Konva from "konva";
import { LAYOUT_CONFIG, EDGE_SPACING, getEdgeColor, isLoopBackEdge, BENDPOINT_INDICATOR_COLOR } from "./constants";
import { edgeGroups, selectedEdgeId, setSelectedEdgeId } from "./state";
import { clearSelection } from "./selection";
import { showPropertiesPanel, renderEdgeProperties } from "./properties";
import type { PlacedNode, PipelineEdge, Point } from "./types";

// Import from shared edge modules
import {
  getAnchor,
  getArrowAngleForSide,
  determineSidesFromNodeMap,
  buildBackEdgePath,
  buildOrthogonalPath,
  pointsToSegments,
  type Segment,
  type OrthogonalPathResult,
} from "./edges/index";

const { nodeWidth, nodeHeight } = LAYOUT_CONFIG;

/**
 * Clear edge selection
 */
export function clearEdgeSelection(layer: Konva.Layer): void {
  if (selectedEdgeId && edgeGroups[selectedEdgeId]) {
    const group = edgeGroups[selectedEdgeId];
    const edgeData = group.getAttr("edgeData") as PipelineEdge;
    const originalColor = getEdgeColor(edgeData.label);

    const edgeLine = group.findOne(".edge-line") as Konva.Line | undefined;
    if (edgeLine) {
      edgeLine.stroke(originalColor);
      edgeLine.strokeWidth(2);
    }

    const arrowLine = group.findOne(".edge-arrow") as
      | Konva.RegularPolygon
      | undefined;
    if (arrowLine) {
      arrowLine.fill(originalColor);
      arrowLine.stroke(originalColor);
    }

    const texts = group.find("Text") as Konva.Text[];
    texts.forEach((text) => {
      text.fill(originalColor);
    });

    const glow = group.findOne(".edge-glow");
    if (glow) {
      glow.destroy();
    }
  }
  setSelectedEdgeId(null);
}

/**
 * Select an edge
 */
function selectEdge(
  edgeId: string,
  edge: PipelineEdge,
  layer: Konva.Layer
): void {
  clearSelection();

  if (selectedEdgeId && selectedEdgeId !== edgeId) {
    clearEdgeSelection(layer);
  }

  setSelectedEdgeId(edgeId);
  const group = edgeGroups[edgeId];
  if (!group) return;

  const highlightColor = "#ffffff";

  const edgeLine = group.findOne(".edge-line") as Konva.Line | undefined;
  if (edgeLine) {
    edgeLine.stroke(highlightColor);
    edgeLine.strokeWidth(4);
  }

  const arrowLine = group.findOne(".edge-arrow") as
    | Konva.RegularPolygon
    | undefined;
  if (arrowLine) {
    arrowLine.fill(highlightColor);
    arrowLine.stroke(highlightColor);
  }

  const texts = group.find("Text") as Konva.Text[];
  texts.forEach((text) => {
    text.fill(highlightColor);
  });

  // Add glow effect
  if (edgeLine) {
    const glowLine = edgeLine.clone({
      name: "edge-glow",
      stroke: highlightColor,
      strokeWidth: 10,
      opacity: 0.3,
      listening: false,
    });
    group.add(glowLine);
    glowLine.moveToBottom();
  }

  layer.batchDraw();

  showPropertiesPanel();
  renderEdgeProperties(edge);
}

/**
 * Setup edge hover effects
 */
function setupEdgeHover(
  edgeGroup: Konva.Group,
  edgeId: string,
  edge: PipelineEdge,
  layer: Konva.Layer
): void {
  edgeGroup.on("mouseenter", () => {
    document.body.style.cursor = "pointer";
    if (selectedEdgeId !== edgeId) {
      const group = edgeGroups[edgeId];
      const edgeLine = group?.findOne(".edge-line") as Konva.Line | undefined;
      if (edgeLine) {
        edgeLine.strokeWidth(4);
      }
      layer.batchDraw();
    }
  });

  edgeGroup.on("mouseleave", () => {
    document.body.style.cursor = "default";
    if (selectedEdgeId !== edgeId) {
      const group = edgeGroups[edgeId];
      const edgeLine = group?.findOne(".edge-line") as Konva.Line | undefined;
      if (edgeLine) {
        edgeLine.strokeWidth(2);
      }
      layer.batchDraw();
    }
  });

  edgeGroup.on("click tap", (e) => {
    e.cancelBubble = true;
    selectEdge(edgeId, edge, layer);
  });
}

/**
 * Create edge group with all visual elements
 */
function createEdgeGroup(
  layer: Konva.Layer,
  edgeId: string,
  edge: PipelineEdge,
  points: number[],
  edgeColor: string,
  arrowAngle: number,
  end: Point,
  start: Point,
  outSide: string,
  waypoints: Point[] = []
): void {
  const edgeGroup = new Konva.Group({
    name: "edge-group",
    perfectDrawEnabled: false,
  });
  edgeGroup.setAttr("edgeData", edge);
  edgeGroups[edgeId] = edgeGroup;

  // Hit area
  const hitLine = new Konva.Line({
    points: points,
    stroke: "transparent",
    strokeWidth: 20,
    lineCap: "round",
    lineJoin: "round",
    hitStrokeWidth: 20,
    perfectDrawEnabled: false,
  });
  edgeGroup.add(hitLine);

  // Visible line
  const visibleLine = new Konva.Line({
    name: "edge-line",
    points: points,
    stroke: edgeColor,
    strokeWidth: 2,
    lineCap: "round",
    lineJoin: "round",
    listening: false,
    perfectDrawEnabled: false,
  });
  edgeGroup.add(visibleLine);

  // Arrow head - manual triangle so orientation is always correct
  // Use the actual last point from the path, not the `end` parameter
  const actualEndX = points[points.length - 2];
  const actualEndY = points[points.length - 1];
  const arrowRadius = 8;
  const baseHalf = arrowRadius * 0.7;
  const dirX = Math.cos(arrowAngle);
  const dirY = Math.sin(arrowAngle);
  const tipX = actualEndX;
  const tipY = actualEndY;
  const baseCenterX = tipX - dirX * arrowRadius;
  const baseCenterY = tipY - dirY * arrowRadius;
  const perpX = -dirY;
  const perpY = dirX;
  const baseLeftX = baseCenterX + perpX * baseHalf;
  const baseLeftY = baseCenterY + perpY * baseHalf;
  const baseRightX = baseCenterX - perpX * baseHalf;
  const baseRightY = baseCenterY - perpY * baseHalf;

  const arrowHead = new Konva.Line({
    name: "edge-arrow",
    points: [tipX, tipY, baseLeftX, baseLeftY, baseRightX, baseRightY],
    closed: true,
    fill: edgeColor,
    stroke: edgeColor,
    strokeWidth: 1,
    listening: false,
    perfectDrawEnabled: false,
  });
  edgeGroup.add(arrowHead);

  // Bendpoint waypoint indicators (red dots for forced routes)
  for (const waypoint of waypoints) {
    const waypointDot = new Konva.Circle({
      name: "bendpoint-indicator",
      x: waypoint.x,
      y: waypoint.y,
      radius: 4,
      fill: BENDPOINT_INDICATOR_COLOR,
      stroke: "#ffffff",
      strokeWidth: 1,
      listening: false,
      perfectDrawEnabled: false,
    });
    edgeGroup.add(waypointDot);
  }

  // Label
  if (edge.label) {
    let labelX = (start.x + end.x) / 2;
    let labelY = (start.y + end.y) / 2;
    if (outSide === "right" || outSide === "left") {
      labelY -= 14;
    } else {
      labelX += 14;
      labelY -= 16;
    }

    const text = new Konva.Text({
      x: labelX,
      y: labelY,
      text: edge.label,
      fontSize: 11,
      fontFamily: "IBM Plex Sans, system-ui, sans-serif",
      fill: edgeColor,
      listening: false,
    });
    text.offsetX(text.width() / 2);
    edgeGroup.add(text);
  }

  setupEdgeHover(edgeGroup, edgeId, edge, layer);
  layer.add(edgeGroup);
}

/**
 * Planned edge interface for internal use
 */
interface PlannedEdge {
  i: number;
  edgeId: string;
  edge: PipelineEdge;
  fromNode: PlacedNode;
  toNode: PlacedNode;
  outSide: string;
  inSide: string;
  blockingNode: PlacedNode | null;
}

/**
 * Draw edges between nodes
 */
export function drawEdges(
  layer: Konva.Layer,
  edges: PipelineEdge[],
  nodeMap: Record<string, PlacedNode>
): void {
  // First pass: plan routes
  const planned: PlannedEdge[] = [];
  const outCounts: Record<string, number> = {};
  const inCounts: Record<string, number> = {};
  const occupiedSegments: Segment[] = [];

  function incCount(map: Record<string, number>, key: string): void {
    map[key] = (map[key] || 0) + 1;
  }

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const fromNode = nodeMap[edge.from];
    const toNode = nodeMap[edge.to];
    if (!fromNode || !toNode) continue;

    const edgeId = `edge-${i}-${edge.from}-${edge.to}`;
    const sides = determineSidesFromNodeMap(edge, fromNode, toNode, nodeMap);

    const outKey = `${edge.from}|${sides.outSide}`;
    const inKey = `${edge.to}|${sides.inSide}`;
    incCount(outCounts, outKey);
    incCount(inCounts, inKey);

    planned.push({
      i,
      edgeId,
      edge,
      fromNode,
      toNode,
      outSide: sides.outSide,
      inSide: sides.inSide,
      blockingNode: sides.blockingNode,
    });
  }

  // Second pass: draw
  const outIndex: Record<string, number> = {};
  const inIndex: Record<string, number> = {};

  function nextOffset(
    indexMap: Record<string, number>,
    countMap: Record<string, number>,
    key: string
  ): number {
    const idx = indexMap[key] || 0;
    indexMap[key] = idx + 1;
    const total = countMap[key] || 1;
    return (idx - (total - 1) / 2) * EDGE_SPACING;
  }

  for (const plan of planned) {
    const { edge, fromNode, toNode, edgeId, outSide, inSide, blockingNode } =
      plan;

    const edgeColor = getEdgeColor(edge.label);
    const isBackEdge = isLoopBackEdge(edge.label);

    const outKey = `${edge.from}|${outSide}`;
    const inKey = `${edge.to}|${inSide}`;
    const outOffset = nextOffset(outIndex, outCounts, outKey);
    const inOffset = nextOffset(inIndex, inCounts, inKey);

    let start = getAnchor(
      fromNode,
      outSide,
      outSide === "top" || outSide === "bottom" ? outOffset : outOffset
    );
    let end = getAnchor(
      toNode,
      inSide,
      inSide === "top" || inSide === "bottom" ? inOffset : inOffset
    );

    // Align for straight vertical connections
    const fromCenterX = fromNode.x + nodeWidth / 2;
    const toCenterX = toNode.x + nodeWidth / 2;
    const nodesAligned = Math.abs(fromCenterX - toCenterX) < 5;

    if (outSide === "bottom" && inSide === "top" && nodesAligned) {
      const alignedX = fromCenterX;
      const startY =
        fromNode.type === "join"
          ? fromNode.y + nodeHeight / 2 + 10
          : fromNode.y + nodeHeight;
      const endY =
        toNode.type === "join" ? toNode.y + nodeHeight / 2 - 10 : toNode.y;
      start = { x: alignedX, y: startY };
      end = { x: alignedX, y: endY };
    }

    const isGoingUp = end.y < start.y - 5;

    let points: number[];
    let arrowAngle: number;
    let waypoints: Point[] = [];

    // Get bendpoints from edge display data
    const bendPoints = edge.display?.bendPoints;
    const hasBendPoints = bendPoints && bendPoints.length > 0;

    // If we have bendpoints, use orthogonal routing even if going up
    // Bendpoints should take priority over the automatic back-edge detection
    if ((isBackEdge || isGoingUp) && !hasBendPoints) {
      const result = buildBackEdgePath(fromNode, toNode);
      points = result.points;
      end = result.end;
      // For back edges, arrow points up into top of target
      arrowAngle = -Math.PI / 2;
    } else {
      const pathResult = buildOrthogonalPath(
        start,
        end,
        bendPoints,
        fromNode,
        toNode,
        outSide,
        inSide,
        outOffset,
        inOffset,
        nodeMap,
        blockingNode,
        occupiedSegments
      );

      // Handle both return types: plain number[] or OrthogonalPathResult
      if (Array.isArray(pathResult)) {
        points = pathResult;
      } else {
        points = pathResult.points;
        waypoints = pathResult.waypoints;
      }

      // Always use inSide to determine arrow direction
      arrowAngle = getArrowAngleForSide(inSide);
    }

    createEdgeGroup(
      layer,
      edgeId,
      edge,
      points,
      edgeColor,
      arrowAngle,
      end,
      start,
      outSide,
      waypoints
    );

    occupiedSegments.push(...pointsToSegments(points));
  }
}
