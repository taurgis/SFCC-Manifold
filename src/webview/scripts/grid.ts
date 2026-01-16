/**
 * Grid rendering module
 * Handles drawing the background grid pattern
 */

export function getGridScript(): string {
  return `
    /**
     * Draw background grid with optimized caching
     * Uses a single Konva.Shape for the entire grid pattern instead of many Line objects
     */
    function createDrawGrid(stage, gridLayer, getContainerRect) {
      var lastGridState = null;
      
      return function drawGrid() {
        var containerRect = getContainerRect();
        var gridSize = 50;
        var stagePos = stage.position();
        var scale = stage.scaleX();
        
        // Calculate visible grid bounds
        var startX = Math.floor(-stagePos.x / scale / gridSize) * gridSize - gridSize;
        var endX = Math.ceil((containerRect.width - stagePos.x) / scale / gridSize) * gridSize + gridSize;
        var startY = Math.floor(-stagePos.y / scale / gridSize) * gridSize - gridSize;
        var endY = Math.ceil((containerRect.height - stagePos.y) / scale / gridSize) * gridSize + gridSize;
        
        // Create a unique state key to check if we need to redraw
        var newState = startX + "," + endX + "," + startY + "," + endY + "," + scale;
        if (lastGridState === newState) {
          return; // Grid hasn't changed, skip redraw
        }
        lastGridState = newState;

        gridLayer.destroyChildren();
        
        // Use a single Shape with sceneFunc for efficient grid drawing
        var gridShape = new Konva.Shape({
          sceneFunc: function(ctx, shape) {
            ctx.beginPath();
            ctx.strokeStyle = "#1a2340";
            ctx.lineWidth = 1 / scale;
            
            // Draw vertical lines
            for (var x = startX; x <= endX; x += gridSize) {
              ctx.moveTo(x, startY);
              ctx.lineTo(x, endY);
            }
            
            // Draw horizontal lines
            for (var y = startY; y <= endY; y += gridSize) {
              ctx.moveTo(startX, y);
              ctx.lineTo(endX, y);
            }
            
            ctx.stroke();
          },
          listening: false,
          perfectDrawEnabled: false
        });
        
        gridLayer.add(gridShape);
        gridLayer.batchDraw();
      };
    }
  `;
}
