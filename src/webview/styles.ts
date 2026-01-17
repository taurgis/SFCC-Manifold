/**
 * CSS styles for the pipeline visualizer webview
 */

import { getPropertiesPanelStyles } from "./styles/propertiesPanel";

export function getStyles(): string {
  return `
    :root {
      --bg: #0b1021;
      --panel: #11162d;
      --border: #1f2a44;
      --text: #d8e2ff;
      --muted: #93a4c8;
      --accent: #6dd3ff;
      --danger: #ff8a7a;
      --success: #6be8c7;
      --warning: #f2c078;
      --edge: #6dd3ff66;
      --edge-strong: #6dd3ff;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--bg);
      color: var(--text);
      font-family: "IBM Plex Sans", "Segoe UI", "SF Pro Display", system-ui, -apple-system, sans-serif;
    }

    .app-container {
      display: flex;
      width: 100%;
      height: 100%;
    }

    ${getCanvasStyles()}
    ${getControlStyles()}
    ${getFloatingPanelStyles()}
    ${getSearchStyles()}
    ${getPropertiesPanelStyles()}
  `;
}

function getCanvasStyles(): string {
  return `
    /* Canvas Area */
    .canvas-area {
      flex: 1;
      height: 100%;
      position: relative;
      background: radial-gradient(circle at 30% 30%, #131a36, #0b1021 60%);
      overflow: hidden;
    }

    #konva-container {
      width: 100%;
      height: 100%;
    }
  `;
}

function getControlStyles(): string {
  return `
    /* Bottom Controls Bar - Miro/Canva style */
    .bottom-controls {
      position: absolute;
      bottom: 16px;
      right: 16px;
      z-index: 200;
      display: flex;
      align-items: center;
      gap: 4px;
      background: linear-gradient(180deg, #161d38, #11162d);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }

    .control-group {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .control-btn {
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .control-btn:hover {
      background: #1f2a44;
    }

    .control-btn.active {
      background: var(--accent);
      color: var(--bg);
    }

    .control-btn svg {
      width: 16px;
      height: 16px;
    }

    .zoom-level {
      font-size: 11px;
      color: var(--muted);
      text-align: center;
      padding: 0 8px;
      min-width: 48px;
      font-family: "SF Mono", "Fira Code", monospace;
    }

    .control-divider {
      width: 1px;
      height: 20px;
      background: var(--border);
      margin: 0 4px;
    }

    /* Help hint */
    .canvas-hint {
      position: absolute;
      bottom: 16px;
      left: 16px;
      z-index: 200;
      font-size: 11px;
      color: var(--muted);
      background: rgba(11, 16, 33, 0.9);
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .hint-key {
      background: #1f2a44;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: "SF Mono", monospace;
      font-size: 10px;
    }
  `;
}

function getFloatingPanelStyles(): string {
  return `
    /* Floating Panels - Miro/Canva style */
    .floating-panel {
      position: absolute;
      z-index: 300;
      background: linear-gradient(180deg, #11162d 0%, #0d1226 100%);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      opacity: 0;
      visibility: hidden;
      transform: translateY(8px) scale(0.98);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      max-height: calc(100vh - 120px);
      display: flex;
      flex-direction: column;
    }

    .floating-panel.visible {
      opacity: 1;
      visibility: visible;
      transform: translateY(0) scale(1);
    }

    .floating-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .floating-panel-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
    }

    .floating-panel-close {
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .floating-panel-close:hover {
      background: rgba(255, 255, 255, 0.1);
      color: var(--text);
    }

    .floating-panel-close svg {
      width: 14px;
      height: 14px;
    }

    .floating-panel-content {
      padding: 14px;
      overflow-y: auto;
      flex: 1;
    }

    /* Info Panel */
    .info-panel {
      bottom: 64px;
      right: 16px;
      width: 280px;
    }

    .info-section {
      margin-bottom: 14px;
    }

    .info-section:last-child {
      margin-bottom: 0;
    }

    .info-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--muted);
      margin-bottom: 6px;
    }

    .info-value {
      font-size: 13px;
      color: var(--text);
      line-height: 1.4;
    }

    .info-value.name {
      font-size: 15px;
      font-weight: 600;
      color: var(--accent);
    }

    .info-value.path {
      font-family: "SF Mono", "Fira Code", monospace;
      font-size: 10px;
      background: #0a0e1a;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      word-break: break-all;
    }

    .info-value.description {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.5;
    }

    .info-stats {
      display: flex;
      gap: 8px;
    }

    .info-stat {
      flex: 1;
      background: #0a0e1a;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px;
      text-align: center;
    }

    .info-stat-value {
      display: block;
      font-size: 18px;
      font-weight: 600;
      color: var(--accent);
    }

    .info-stat-label {
      display: block;
      font-size: 10px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-top: 2px;
    }

    /* Legend Panel */
    .legend-panel {
      bottom: 64px;
      right: 16px;
      width: 260px;
      max-height: 320px;
    }

    .legend-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: #0a0e1a;
      font-size: 11px;
    }

    .legend-swatch {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      border: 1px solid #ffffff22;
      flex-shrink: 0;
    }
  `;
}

function getSearchStyles(): string {
  return `
    /* Search Overlay - VS Code / Spotlight style */
    .search-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 15vh;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s ease, visibility 0.15s ease;
    }

    .search-overlay.visible {
      opacity: 1;
      visibility: visible;
    }

    .search-panel {
      width: 100%;
      max-width: 580px;
      background: linear-gradient(180deg, #161d38 0%, #11162d 100%);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(109, 211, 255, 0.1);
      overflow: hidden;
      transform: translateY(-10px) scale(0.98);
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .search-overlay.visible .search-panel {
      transform: translateY(0) scale(1);
    }

    .search-input-wrapper {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }

    .search-input-wrapper svg {
      width: 20px;
      height: 20px;
      color: var(--muted);
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      font-size: 16px;
      color: var(--text);
      font-family: inherit;
    }

    .search-input::placeholder {
      color: var(--muted);
      opacity: 0.7;
    }

    .search-shortcut {
      font-size: 11px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.05);
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid var(--border);
      white-space: nowrap;
    }

    .search-results {
      max-height: 360px;
      overflow-y: auto;
    }

    .search-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 40px 20px;
      color: var(--muted);
    }

    .search-empty-icon svg {
      width: 32px;
      height: 32px;
      opacity: 0.4;
    }

    .search-empty-text {
      font-size: 13px;
      text-align: center;
    }

    .search-results-list {
      padding: 8px;
    }

    .search-result-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.1s ease;
    }

    .search-result-item:hover,
    .search-result-item.selected {
      background: rgba(109, 211, 255, 0.1);
    }

    .search-result-item.selected {
      outline: 1px solid var(--accent);
      outline-offset: -1px;
    }

    .search-result-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .search-result-icon svg {
      width: 16px;
      height: 16px;
    }

    .search-result-info {
      flex: 1;
      min-width: 0;
    }

    .search-result-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .search-result-name mark {
      background: rgba(109, 211, 255, 0.3);
      color: var(--accent);
      border-radius: 2px;
      padding: 0 2px;
    }

    .search-result-meta {
      font-size: 11px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }

    .search-result-type {
      font-size: 10px;
      font-weight: 500;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      flex-shrink: 0;
    }

    .search-no-results {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 20px;
      color: var(--muted);
    }

    .search-no-results-text {
      font-size: 13px;
    }

    .search-no-results-query {
      font-family: "SF Mono", "Fira Code", monospace;
      color: var(--accent);
    }

    .search-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 10px 16px;
      border-top: 1px solid var(--border);
      background: rgba(0, 0, 0, 0.2);
    }

    .search-hint {
      font-size: 11px;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .search-key {
      background: rgba(255, 255, 255, 0.08);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: "SF Mono", "Fira Code", monospace;
      font-size: 10px;
      border: 1px solid var(--border);
    }

    .search-results-count {
      padding: 8px 20px;
      font-size: 11px;
      color: var(--muted);
      border-bottom: 1px solid var(--border);
      background: rgba(0, 0, 0, 0.1);
    }
  `;
}
