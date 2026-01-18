/**
 * Main webview entry point
 * This is the bundled script that runs in the webview context
 */

import {
  setPipelineData,
  setPlacedNodes,
  setInitialStartNode,
} from "./state";
import { calculateLayout, buildNodeMap, calculateBounds } from "./layout";
import { initializeStage, createDrawGrid } from "./stage";
import { renderLegend } from "./legend";
import { drawNodes } from "./nodes";
import { drawEdges, clearEdgeSelection } from "./edges";
import {
  createUpdateZoomLevel,
  setupWheelZoom,
  setupZoomButtons,
  setupFloatingPanels,
  setupContainerTracking,
  setupResizeHandler,
} from "./controls";
import { initPropertiesPanel, hidePropertiesPanel, showPropertiesPanel, renderNodeProperties } from "./properties";
import { clearSelection, navigateToNode, setPropertiesFunctions } from "./selection";
import { initNavigation, findStartNode } from "./navigation";
import { updateViewportCulling } from "./viewport";
import { initSearch } from "./search";
import type { PipelineData } from "./types";

/**
 * Initialize the canvas
 */
function initialize(): void {
  // Get data from global variables injected by the HTML
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (window as any).pipelineData as PipelineData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startNode = (window as any).initialStartNode as string | undefined;

  if (!data) {
    // eslint-disable-next-line no-console
    console.error("No pipeline data found");
    return;
  }

  setPipelineData(data);
  if (startNode) {
    setInitialStartNode(startNode);
  }

  // Initialize navigation (sets up VS Code API)
  initNavigation();

  // Wire up properties functions to selection module (breaks circular dep)
  setPropertiesFunctions(showPropertiesPanel, renderNodeProperties);

  // Calculate layout
  const nodes = calculateLayout(data.nodes);
  setPlacedNodes(nodes);

  // Build node map and bounds
  const nodeMap = buildNodeMap(nodes);
  const bounds = calculateBounds(nodes);

  // Expose placedNodes globally for navigation
  window.placedNodes = nodes;

  // Render legend
  renderLegend(nodes);

  // Initialize Konva
  const konva = initializeStage("konva-container");
  const { stage, layer, gridLayer } = konva;
  const container = document.getElementById("konva-container") as HTMLElement;

  // Expose stage and layer globally
  window.pipelineStage = stage;
  window.pipelineLayer = layer;

  // Setup container tracking
  const containerTracking = setupContainerTracking(container);
  const { getContainerRect, updateContainerRect } = containerTracking;

  // Create draw grid function
  const drawGrid = createDrawGrid(stage, gridLayer, getContainerRect);

  // Expose drawGrid globally
  window.drawGridFn = drawGrid;

  // Draw canvas
  drawEdges(layer, data.edges, nodeMap);
  drawNodes(layer, nodes);
  drawGrid();
  layer.batchDraw();

  // Setup controls
  const updateZoomLevel = createUpdateZoomLevel(stage);
  setupWheelZoom(stage, layer, drawGrid, updateZoomLevel);
  setupZoomButtons(stage, layer, getContainerRect, drawGrid, updateZoomLevel, bounds);
  setupResizeHandler(stage, container, layer, drawGrid, updateContainerRect);

  // Setup floating panels
  setupFloatingPanels();

  // Initialize properties panel
  initPropertiesPanel();

  // Initialize search functionality
  initSearch();

  // Setup stage click to deselect
  stage.on("click", (e) => {
    if (e.target === stage) {
      hidePropertiesPanel();
      clearSelection();
      clearEdgeSelection(layer);
      layer.batchDraw();
    }
  });

  // Connection click handler
  window.handleConnectionClick = (nodeId: string) => {
    navigateToNode(nodeId, stage, layer, nodes);
    drawGrid();
    updateViewportCulling(stage, layer);
    layer.batchDraw();
  };

  // Initial viewport culling and fit for large pipelines
  if (nodes.length > 10) {
    document.getElementById("zoomFit")?.click();
  } else {
    updateViewportCulling(stage, layer);
    layer.batchDraw();
  }

  // Navigate to initial start node if specified
  if (startNode) {
    setTimeout(() => {
      const targetNode = findStartNode(startNode);
      if (targetNode) {
        navigateToNode(targetNode.id, stage, layer, nodes);
        drawGrid();
        updateViewportCulling(stage, layer);
        layer.batchDraw();
      }
    }, 100);
  }
}

// Run initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
