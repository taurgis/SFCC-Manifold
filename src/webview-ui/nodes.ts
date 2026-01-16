/**
 * Node rendering module
 */

import Konva from "konva";
import { NODE_COLORS, LAYOUT_CONFIG } from "./constants";
import { nodeGroups, selectedNodeId } from "./state";
import { selectNode } from "./selection";
import { clearEdgeSelection } from "./edges";
import { handleNodeDoubleClick } from "./navigation";
import type { PlacedNode } from "./types";

const { nodeWidth, nodeHeight } = LAYOUT_CONFIG;

/**
 * Draw a join node (small circle connector)
 */
function drawJoinNode(layer: Konva.Layer, node: PlacedNode): void {
  const color = NODE_COLORS[node.type] || NODE_COLORS.join || "#6b7394";
  const radius = 10;

  const group = new Konva.Group({
    x: node.x + nodeWidth / 2,
    y: node.y + nodeHeight / 2,
    name: "node-group",
    perfectDrawEnabled: false,
  });

  nodeGroups[node.id] = group;

  // Outer circle
  const circle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: radius,
    fill: "#0d1328",
    stroke: color,
    strokeWidth: 2,
    shadowColor: "#000",
    shadowBlur: 10,
    shadowOpacity: 0.4,
    shadowOffsetY: 2,
    perfectDrawEnabled: false,
  });
  group.add(circle);

  // Inner dot
  group.add(
    new Konva.Circle({
      x: 0,
      y: 0,
      radius: 4,
      fill: color,
      listening: false,
      perfectDrawEnabled: false,
    })
  );

  // Hover effects
  group.on("mouseenter", () => {
    document.body.style.cursor = "pointer";
    if (selectedNodeId !== node.id) {
      circle.shadowBlur(15);
      circle.shadowOpacity(0.6);
      layer.batchDraw();
    }
  });

  group.on("mouseleave", () => {
    document.body.style.cursor = "default";
    if (selectedNodeId !== node.id) {
      circle.shadowBlur(10);
      circle.shadowOpacity(0.4);
      layer.batchDraw();
    }
  });

  // Click to select
  group.on("click tap", (e) => {
    e.cancelBubble = true;
    clearEdgeSelection(layer);
    selectNode(node, layer);
  });

  layer.add(group);
}

/**
 * Draw a single node
 */
function drawNode(layer: Konva.Layer, node: PlacedNode): void {
  // Join nodes are rendered as small circles
  if (node.type === "join") {
    drawJoinNode(layer, node);
    return;
  }

  const color = NODE_COLORS[node.type] || NODE_COLORS.unknown;

  const group = new Konva.Group({
    x: node.x,
    y: node.y,
    name: "node-group",
    perfectDrawEnabled: false,
  });

  nodeGroups[node.id] = group;

  // Node background
  const rect = new Konva.Rect({
    width: nodeWidth,
    height: nodeHeight,
    fill: "#0d1328",
    stroke: color,
    strokeWidth: 2,
    cornerRadius: 10,
    shadowColor: "#000",
    shadowBlur: 15,
    shadowOpacity: 0.4,
    shadowOffsetY: 5,
    perfectDrawEnabled: false,
  });
  group.add(rect);

  // Inner gradient overlay
  group.add(
    new Konva.Rect({
      x: 1,
      y: 1,
      width: nodeWidth - 2,
      height: nodeHeight / 2,
      fill: "rgba(255,255,255,0.03)",
      cornerRadius: [9, 9, 0, 0],
      listening: false,
      perfectDrawEnabled: false,
    })
  );

  // Type pill
  const pillText = new Konva.Text({
    text: node.type,
    fontSize: 10,
    fontFamily: "IBM Plex Sans, system-ui, sans-serif",
    fill: "#0b1021",
    padding: 0,
    perfectDrawEnabled: false,
  });
  const pillWidth = pillText.width() + 12;

  group.add(
    new Konva.Rect({
      x: 10,
      y: 10,
      width: pillWidth,
      height: 18,
      fill: color,
      cornerRadius: 9,
      perfectDrawEnabled: false,
    })
  );

  pillText.x(10 + 6);
  pillText.y(10 + 4);
  group.add(pillText);

  // Node title
  group.add(
    new Konva.Text({
      x: 10,
      y: 34,
      width: nodeWidth - 20,
      text: node.label,
      fontSize: 13,
      fontFamily: "IBM Plex Sans, system-ui, sans-serif",
      fontStyle: "bold",
      fill: "#d8e2ff",
      ellipsis: true,
      wrap: "none",
      listening: false,
      perfectDrawEnabled: false,
    })
  );

  // Branch subtitle
  group.add(
    new Konva.Text({
      x: 10,
      y: 52,
      width: nodeWidth - 20,
      text: node.branch,
      fontSize: 10,
      fontFamily: "IBM Plex Sans, system-ui, sans-serif",
      fill: "#93a4c8",
      ellipsis: true,
      wrap: "none",
      listening: false,
      perfectDrawEnabled: false,
    })
  );

  // Add navigation indicator for jump/call nodes
  if (node.type === "jump" || node.type === "call") {
    addNavigationIndicator(group, nodeWidth, nodeHeight);
  }

  // Hover effects
  setupNodeHover(group, rect, node, layer);

  // Click to select
  group.on("click tap", (e) => {
    e.cancelBubble = true;
    clearEdgeSelection(layer);
    selectNode(node, layer);
  });

  // Double-click to navigate (for jump and call nodes)
  if (node.type === "jump" || node.type === "call") {
    group.on("dblclick dbltap", (e) => {
      e.cancelBubble = true;
      handleNodeDoubleClick(node);
    });
  }

  layer.add(group);
}

/**
 * Add navigation indicator for jump/call nodes
 */
function addNavigationIndicator(
  group: Konva.Group,
  nodeWidth: number,
  nodeHeight: number
): void {
  const iconGroup = new Konva.Group({
    x: nodeWidth - 28,
    y: nodeHeight - 28,
    listening: false,
    perfectDrawEnabled: false,
  });

  iconGroup.add(
    new Konva.Rect({
      width: 20,
      height: 20,
      fill: "rgba(242, 192, 120, 0.2)",
      cornerRadius: 4,
      listening: false,
      perfectDrawEnabled: false,
    })
  );

  // Draw external link icon
  iconGroup.add(
    new Konva.Line({
      points: [5, 15, 15, 5],
      stroke: "#f2c078",
      strokeWidth: 1.5,
      lineCap: "round",
      listening: false,
      perfectDrawEnabled: false,
    })
  );
  iconGroup.add(
    new Konva.Line({
      points: [9, 5, 15, 5, 15, 11],
      stroke: "#f2c078",
      strokeWidth: 1.5,
      lineCap: "round",
      lineJoin: "round",
      listening: false,
      perfectDrawEnabled: false,
    })
  );
  iconGroup.add(
    new Konva.Line({
      points: [5, 9, 5, 15, 11, 15],
      stroke: "#f2c078",
      strokeWidth: 1.5,
      lineCap: "round",
      lineJoin: "round",
      listening: false,
      perfectDrawEnabled: false,
    })
  );

  group.add(iconGroup);
}

/**
 * Setup node hover effects
 */
function setupNodeHover(
  group: Konva.Group,
  rect: Konva.Rect,
  node: PlacedNode,
  layer: Konva.Layer
): void {
  group.on("mouseenter", function () {
    document.body.style.cursor = "pointer";
    if (selectedNodeId !== node.id) {
      const mainRect = this.findOne("Rect") as Konva.Rect | undefined;
      if (mainRect) {
        mainRect.shadowBlur(25);
        mainRect.shadowOpacity(0.6);
        layer.batchDraw();
      }
    }
  });

  group.on("mouseleave", function () {
    document.body.style.cursor = "default";
    if (selectedNodeId !== node.id) {
      const mainRect = this.findOne("Rect") as Konva.Rect | undefined;
      if (mainRect) {
        mainRect.shadowBlur(15);
        mainRect.shadowOpacity(0.4);
        layer.batchDraw();
      }
    }
  });
}

/**
 * Draw all nodes
 */
export function drawNodes(layer: Konva.Layer, placedNodes: PlacedNode[]): void {
  for (const node of placedNodes) {
    drawNode(layer, node);
  }
}
