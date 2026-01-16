/**
 * Stage initialization module
 * Handles Konva stage setup
 */

export function getStageScript(): string {
  return `
    /**
     * Initialize Konva stage and layers
     */
    function initializeStage(containerId) {
      var container = document.getElementById(containerId);
      var containerRect = container.getBoundingClientRect();
      
      var stage = new Konva.Stage({
        container: containerId,
        width: containerRect.width,
        height: containerRect.height,
        draggable: true
      });

      // Main layer for nodes and edges
      var layer = new Konva.Layer({
        // Enable hit graph caching for better performance
        hitGraphEnabled: true
      });
      stage.add(layer);

      // Grid layer with caching for performance
      var gridLayer = new Konva.Layer({
        listening: false,  // Grid doesn't need mouse events
        hitGraphEnabled: false  // Disable hit detection for grid
      });
      stage.add(gridLayer);
      gridLayer.moveToBottom();

      return { stage: stage, layer: layer, gridLayer: gridLayer, containerRect: containerRect };
    }
  `;
}
