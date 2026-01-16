/**
 * Konva canvas initialization and rendering script (embedded JavaScript)
 * 
 * This module serves as the orchestrator for all canvas-related functionality.
 * It imports and combines scripts from specialized modules:
 * - viewport.ts: Viewport culling for performance optimization
 * - grid.ts: Background grid rendering
 * - stage.ts: Konva stage initialization
 * - legend.ts: Legend sidebar rendering
 * - edges/: Edge drawing, routing, selection, and properties
 * - nodes/: Node drawing and interactions
 */

import { getViewportScript } from "./viewport";
import { getGridScript } from "./grid";
import { getStageScript } from "./stage";
import { getLegendScript } from "./legend";
import { getEdgeScript } from "./edges";
import { getNodeScript } from "./nodes";

export function getCanvasScript(): string {
  return `
    ${getViewportScript()}
    ${getGridScript()}
    ${getStageScript()}
    ${getLegendScript()}
    ${getEdgeScript()}
    ${getNodeScript()}
  `;
}
