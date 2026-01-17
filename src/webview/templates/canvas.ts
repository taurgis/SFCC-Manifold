/**
 * Canvas area HTML template with controls
 */

import { ParsedPipeline } from "../../lib/types";
import { escapeHtml } from "../helpers";
import { icons } from "../icons";
import { renderPropertiesPanel } from "./propertiesPanel";

export interface CanvasData {
  pipeline: ParsedPipeline;
  sourcePath: string;
}

export function renderCanvas(data: CanvasData): string {
  return `
    <main class="canvas-area">
      <div id="konva-container"></div>
      ${renderHint()}
      ${renderBottomControls()}
      ${renderInfoPanel(data)}
      ${renderLegendPanel()}
      ${renderSearchPanel()}
      ${renderPropertiesPanel()}
    </main>
  `;
}

function renderBottomControls(): string {
  return `
    <div class="bottom-controls">
      <div class="control-group zoom-controls">
        <button class="control-btn" id="zoomOut" title="Zoom out">
          ${icons.zoomOut}
        </button>
        <div class="zoom-level" id="zoomLevel">100%</div>
        <button class="control-btn" id="zoomIn" title="Zoom in">
          ${icons.zoomIn}
        </button>
      </div>
      <div class="control-group view-controls">
        <button class="control-btn" id="zoomFit" title="Fit to view">
          ${icons.maximize}
        </button>
        <button class="control-btn" id="zoomReset" title="Reset view">
          ${icons.home}
        </button>
      </div>
      <div class="control-divider"></div>
      <div class="control-group utility-controls">
        <button class="control-btn" id="searchToggle" title="Search nodes (Cmd/Ctrl+F)">
          ${icons.search}
        </button>
        <button class="control-btn" id="legendToggle" title="Toggle legend">
          ${icons.grid}
        </button>
        <button class="control-btn" id="infoToggle" title="Pipeline info">
          ${icons.fileText}
        </button>
      </div>
    </div>
  `;
}

function renderInfoPanel(data: CanvasData): string {
  const { pipeline, sourcePath } = data;
  
  return `
    <div class="floating-panel info-panel" id="infoPanel">
      <div class="floating-panel-header">
        <span class="floating-panel-title">Pipeline Info</span>
        <button class="floating-panel-close" id="infoPanelClose" title="Close">
          ${icons.close}
        </button>
      </div>
      <div class="floating-panel-content">
        <div class="info-section">
          <div class="info-label">Name</div>
          <div class="info-value name">${escapeHtml(pipeline.name)}</div>
        </div>
        ${pipeline.group ? `
        <div class="info-section">
          <div class="info-label">Group</div>
          <div class="info-value">${escapeHtml(pipeline.group)}</div>
        </div>
        ` : ""}
        ${pipeline.type ? `
        <div class="info-section">
          <div class="info-label">Type</div>
          <div class="info-value">${escapeHtml(pipeline.type)}</div>
        </div>
        ` : ""}
        <div class="info-section">
          <div class="info-label">Statistics</div>
          <div class="info-stats">
            <div class="info-stat">
              <span class="info-stat-value">${pipeline.nodes.length}</span>
              <span class="info-stat-label">Nodes</span>
            </div>
            <div class="info-stat">
              <span class="info-stat-value">${pipeline.edges.length}</span>
              <span class="info-stat-label">Edges</span>
            </div>
          </div>
        </div>
        ${pipeline.description ? `
        <div class="info-section">
          <div class="info-label">Description</div>
          <div class="info-value description">${escapeHtml(pipeline.description)}</div>
        </div>
        ` : ""}
        <div class="info-section">
          <div class="info-label">Source</div>
          <div class="info-value path">${escapeHtml(sourcePath)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderLegendPanel(): string {
  return `
    <div class="floating-panel legend-panel" id="legendPanel">
      <div class="floating-panel-header">
        <span class="floating-panel-title">Legend</span>
        <button class="floating-panel-close" id="legendPanelClose" title="Close">
          ${icons.close}
        </button>
      </div>
      <div class="floating-panel-content">
        <div class="legend-grid" id="legend"></div>
      </div>
    </div>
  `;
}

function renderSearchPanel(): string {
  return `
    <div class="search-overlay" id="searchOverlay">
      <div class="search-panel" id="searchPanel">
        <div class="search-input-wrapper">
          ${icons.search}
          <input 
            type="text" 
            id="searchInput" 
            class="search-input" 
            placeholder="Search nodes by name, type, or ID..." 
            autocomplete="off"
            spellcheck="false"
          />
          <div class="search-shortcut">ESC to close</div>
        </div>
        <div class="search-results" id="searchResults">
          <div class="search-empty" id="searchEmpty">
            <span class="search-empty-icon">${icons.search}</span>
            <span class="search-empty-text">Type to search pipelets, decisions, and more...</span>
          </div>
        </div>
        <div class="search-footer" id="searchFooter">
          <span class="search-hint"><span class="search-key">↑↓</span> Navigate</span>
          <span class="search-hint"><span class="search-key">Enter</span> Select</span>
          <span class="search-hint"><span class="search-key">Esc</span> Close</span>
        </div>
      </div>
    </div>
  `;
}

function renderHint(): string {
  return `
    <div class="canvas-hint">
      <span class="hint-key">Scroll</span> zoom
      <span class="hint-key">Drag</span> pan
      <span class="hint-key">Click</span> select
      <span class="hint-key">⌘F</span> search
    </div>
  `;
}
