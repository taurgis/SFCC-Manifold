/**
 * Main script orchestrator - combines all script modules
 */

import { getConstantsScript } from "./constants";
import { getLayoutScript } from "./layout";
import { getCanvasScript } from "./canvas";
import { getControlsScript } from "./controls";

/**
 * Generate the complete initialization script
 */
export function getMainScript(): string {
  return `
    (function() {
      ${getConstantsScript()}
      ${getLayoutScript()}
      ${getCanvasScript()}
      ${getControlsScript()}

      // Initialize
      var placedNodes = calculateLayout(pipelineData.nodes);
      var nodeMap = buildNodeMap(placedNodes);
      var bounds = calculateBounds(placedNodes);

      // Render legend
      renderLegend(placedNodes);

      // Initialize Konva
      var konva = initializeStage("konva-container");
      var stage = konva.stage;
      var layer = konva.layer;
      var gridLayer = konva.gridLayer;
      var container = document.getElementById("konva-container");

      // Setup sidebar toggle and get container rect accessor
      var sidebarControls = setupSidebarToggle(stage, container);
      var getContainerRect = sidebarControls.getContainerRect;
      var updateContainerRect = sidebarControls.updateContainerRect;

      // Create draw grid function
      var drawGrid = createDrawGrid(stage, gridLayer, getContainerRect);

      // Draw canvas
      drawEdges(layer, pipelineData.edges, nodeMap);
      drawNodes(layer, placedNodes);
      drawGrid();
      layer.batchDraw();

      // Setup controls
      var updateZoomLevel = createUpdateZoomLevel(stage);
      setupWheelZoom(stage, drawGrid, updateZoomLevel);
      setupZoomButtons(stage, getContainerRect, drawGrid, updateZoomLevel, bounds);
      setupResizeHandler(stage, container, drawGrid, updateContainerRect);

      // Initial fit to view if many nodes
      if (placedNodes.length > 10) {
        document.getElementById("zoomFit").click();
      }
    })();
  `;
}
