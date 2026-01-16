/**
 * Main script orchestrator - combines all script modules
 */

import { getConstantsScript } from "./constants";
import { getLayoutScript } from "./layout";
import { getCanvasScript } from "./canvas";
import { getControlsScript } from "./controls";
import { getSelectionScript } from "./selection";
import { getNavigationScript } from "./navigation";

/**
 * Generate the complete initialization script
 */
export function getMainScript(): string {
  return `
    (function() {
      ${getConstantsScript()}
      ${getNavigationScript()}
      ${getSelectionScript()}
      ${getLayoutScript()}
      ${getCanvasScript()}
      ${getControlsScript()}

      // Initialize
      var placedNodes = calculateLayout(pipelineData.nodes);
      var nodeMap = buildNodeMap(placedNodes);
      var bounds = calculateBounds(placedNodes);

      // Expose placedNodes globally for navigation
      window.placedNodes = placedNodes;

      // Render legend
      renderLegend(placedNodes);

      // Initialize Konva
      var konva = initializeStage("konva-container");
      var stage = konva.stage;
      var layer = konva.layer;
      var gridLayer = konva.gridLayer;
      var container = document.getElementById("konva-container");

      // Expose stage and layer globally for navigation
      window.pipelineStage = stage;
      window.pipelineLayer = layer;

      // Setup container tracking for zoom operations
      var containerTracking = setupContainerTracking(container);
      var getContainerRect = containerTracking.getContainerRect;
      var updateContainerRect = containerTracking.updateContainerRect;

      // Create draw grid function
      var drawGrid = createDrawGrid(stage, gridLayer, getContainerRect);
      
      // Expose drawGrid globally for navigation
      window.drawGridFn = drawGrid;

      // Draw canvas
      drawEdges(layer, pipelineData.edges, nodeMap);
      drawNodes(layer, placedNodes);
      drawGrid();
      layer.batchDraw();

      // Setup controls (pass layer for viewport culling)
      var updateZoomLevel = createUpdateZoomLevel(stage);
      setupWheelZoom(stage, layer, drawGrid, updateZoomLevel);
      setupZoomButtons(stage, layer, getContainerRect, drawGrid, updateZoomLevel, bounds);
      setupResizeHandler(stage, container, layer, drawGrid, updateContainerRect);

      // Setup floating panels (info and legend)
      setupFloatingPanels();

      // Initialize properties panel
      initPropertiesPanel();

      // Setup stage click to deselect
      stage.on("click", function(e) {
        // Only deselect if clicking on empty area (not on a node or edge)
        if (e.target === stage) {
          hidePropertiesPanel();
          clearSelection();
          clearEdgeSelection(layer);
          layer.batchDraw();
        }
      });

      // Connection click handler (called from rendered HTML)
      window.handleConnectionClick = function(nodeId) {
        navigateToNode(nodeId, stage, layer, placedNodes);
        // Redraw grid after navigation
        drawGrid();
        // Update culling after navigation
        updateViewportCulling(stage, layer);
        layer.batchDraw();
      };

      // Initial viewport culling and fit to view for large pipelines
      if (placedNodes.length > 10) {
        document.getElementById("zoomFit").click();
      } else {
        // Initial culling for smaller pipelines
        updateViewportCulling(stage, layer);
        layer.batchDraw();
      }

      // If we have an initial start node to navigate to, do it after a short delay
      if (typeof initialStartNode === "string" && initialStartNode) {
        setTimeout(function() {
          var targetNode = findStartNode(initialStartNode);
          if (targetNode) {
            navigateToNode(targetNode.id, stage, layer, placedNodes);
            drawGrid();
            updateViewportCulling(stage, layer);
            layer.batchDraw();
          }
        }, 100);
      }
    })();
  `;
}
