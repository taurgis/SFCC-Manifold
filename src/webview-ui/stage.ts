/**
 * Konva stage initialization and grid rendering
 */

import Konva from "konva";

/**
 * Initialize Konva stage and layers
 */
export function initializeStage(containerId: string): {
  stage: Konva.Stage;
  layer: Konva.Layer;
  gridLayer: Konva.Layer;
  containerRect: DOMRect;
} {
  const container = document.getElementById(containerId) as HTMLElement;
  const containerRect = container.getBoundingClientRect();

  const stage = new Konva.Stage({
    container: containerId,
    width: containerRect.width,
    height: containerRect.height,
    draggable: true,
  });

  // Main layer for nodes and edges
  const layer = new Konva.Layer({
    hitGraphEnabled: true,
  });
  stage.add(layer);

  // Grid layer with caching for performance
  const gridLayer = new Konva.Layer({
    listening: false,
    hitGraphEnabled: false,
  });
  stage.add(gridLayer);
  gridLayer.moveToBottom();

  return { stage, layer, gridLayer, containerRect };
}

/**
 * Create grid drawing function with caching
 */
export function createDrawGrid(
  stage: Konva.Stage,
  gridLayer: Konva.Layer,
  getContainerRect: () => DOMRect
): () => void {
  let lastGridState: string | null = null;

  return function drawGrid(): void {
    const containerRect = getContainerRect();
    const gridSize = 50;
    const stagePos = stage.position();
    const scale = stage.scaleX();

    // Calculate visible grid bounds
    const startX =
      Math.floor(-stagePos.x / scale / gridSize) * gridSize - gridSize;
    const endX =
      Math.ceil((containerRect.width - stagePos.x) / scale / gridSize) *
        gridSize +
      gridSize;
    const startY =
      Math.floor(-stagePos.y / scale / gridSize) * gridSize - gridSize;
    const endY =
      Math.ceil((containerRect.height - stagePos.y) / scale / gridSize) *
        gridSize +
      gridSize;

    // Create a unique state key to check if we need to redraw
    const newState = `${startX},${endX},${startY},${endY},${scale}`;
    if (lastGridState === newState) {
      return;
    }
    lastGridState = newState;

    gridLayer.destroyChildren();

    // Use a single Shape with sceneFunc for efficient grid drawing
    const gridShape = new Konva.Shape({
      sceneFunc: (ctx) => {
        ctx.beginPath();
        ctx.strokeStyle = "#1a2340";
        ctx.lineWidth = 1 / scale;

        // Draw vertical lines
        for (let x = startX; x <= endX; x += gridSize) {
          ctx.moveTo(x, startY);
          ctx.lineTo(x, endY);
        }

        // Draw horizontal lines
        for (let y = startY; y <= endY; y += gridSize) {
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
        }

        ctx.stroke();
      },
      listening: false,
      perfectDrawEnabled: false,
    });

    gridLayer.add(gridShape);
    gridLayer.batchDraw();
  };
}
