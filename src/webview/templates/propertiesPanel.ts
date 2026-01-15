/**
 * Properties Panel template for displaying selected node details
 * Shows node attributes, connections, and metadata when a node is selected
 */

import { icons } from "../icons";

export function renderPropertiesPanel(): string {
  return `
    <aside class="properties-panel" id="propertiesPanel">
      <div class="properties-resize-handle" id="propertiesResizeHandle"></div>
      ${renderPanelHeader()}
      <div class="properties-content" id="propertiesContent">
        ${renderEmptyState()}
      </div>
    </aside>
  `;
}

function renderPanelHeader(): string {
  return `
    <div class="properties-header">
      <div class="properties-header-content">
        <span class="properties-title">
          ${icons.info}
          Properties
        </span>
        <button class="properties-close" id="propertiesClose" title="Close panel">
          ${icons.close}
        </button>
      </div>
    </div>
  `;
}

function renderEmptyState(): string {
  return `
    <div class="properties-empty" id="propertiesEmpty">
      <div class="empty-icon">${icons.pointerClick}</div>
      <div class="empty-text">Select a node to view its properties</div>
      <div class="empty-hint">Click on any node in the canvas</div>
    </div>
  `;
}
