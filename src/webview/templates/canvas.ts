/**
 * Canvas area HTML template with controls
 */

import { icons } from "../icons";
import { renderPropertiesPanel } from "./propertiesPanel";

export function renderCanvas(): string {
  return `
    <main class="canvas-area">
      ${renderSidebarToggle()}
      <div id="konva-container"></div>
      ${renderZoomControls()}
      ${renderHint()}
      ${renderPropertiesPanel()}
    </main>
  `;
}

function renderSidebarToggle(): string {
  return `
    <button class="sidebar-toggle" id="sidebarToggle" title="Toggle sidebar">
      ${icons.chevronLeft}
    </button>
  `;
}

function renderZoomControls(): string {
  return `
    <div class="zoom-controls">
      <button class="zoom-btn" id="zoomIn" title="Zoom in">
        ${icons.zoomIn}
      </button>
      <button class="zoom-btn" id="zoomOut" title="Zoom out">
        ${icons.zoomOut}
      </button>
      <div class="zoom-divider"></div>
      <div class="zoom-level" id="zoomLevel">100%</div>
      <div class="zoom-divider"></div>
      <button class="zoom-btn" id="zoomReset" title="Reset view">
        ${icons.home}
      </button>
      <button class="zoom-btn" id="zoomFit" title="Fit to view">
        ${icons.maximize}
      </button>
    </div>
  `;
}

function renderHint(): string {
  return `
    <div class="canvas-hint">
      <span class="hint-key">Scroll</span> to zoom
      <span class="hint-key">Drag</span> to pan
    </div>
  `;
}
