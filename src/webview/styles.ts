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
      --sidebar-width: 280px;
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

    ${getSidebarStyles()}
    ${getCanvasStyles()}
    ${getControlStyles()}
    ${getPropertiesPanelStyles()}
  `;
}

function getSidebarStyles(): string {
  return `
    /* Property Panel / Sidebar */
    .sidebar {
      width: var(--sidebar-width);
      min-width: var(--sidebar-width);
      height: 100%;
      background: linear-gradient(180deg, #11162d 0%, #0d1226 100%);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: margin-left 0.2s ease;
      z-index: 100;
    }

    .sidebar.collapsed {
      margin-left: calc(-1 * var(--sidebar-width));
    }

    .sidebar-header {
      padding: 16px;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(90deg, #161d38, #11162d);
    }

    .sidebar-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--muted);
      margin-bottom: 8px;
    }

    .pipeline-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--text);
      word-break: break-word;
    }

    .pipeline-group {
      font-size: 12px;
      color: var(--accent);
      margin-top: 4px;
    }

    .sidebar-section {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }

    .section-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--muted);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-title svg {
      width: 12px;
      height: 12px;
      opacity: 0.7;
    }

    .meta-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 12px;
    }

    .meta-label {
      color: var(--muted);
      min-width: 50px;
      flex-shrink: 0;
    }

    .meta-value {
      color: var(--text);
      word-break: break-all;
    }

    .meta-value.path {
      font-family: "SF Mono", "Fira Code", monospace;
      font-size: 11px;
      background: #0a0e1a;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid var(--border);
    }

    .stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .stat-item {
      background: #0a0e1a;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 12px;
      text-align: center;
    }

    .stat-value {
      font-size: 18px;
      font-weight: 600;
      color: var(--accent);
    }

    .stat-label {
      font-size: 10px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
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
      padding: 4px 10px;
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

    .description-text {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.5;
    }
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
    /* Toggle Button */
    .sidebar-toggle {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 200;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: linear-gradient(180deg, #161d38, #11162d);
      color: var(--text);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }

    .sidebar-toggle:hover {
      background: linear-gradient(180deg, #1d2544, #161d38);
      border-color: var(--accent);
    }

    .sidebar-toggle svg {
      width: 16px;
      height: 16px;
      transition: transform 0.2s ease;
    }

    .sidebar-toggle.rotated svg {
      transform: rotate(180deg);
    }

    /* Zoom Controls */
    .zoom-controls {
      position: absolute;
      bottom: 16px;
      right: 16px;
      z-index: 200;
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: linear-gradient(180deg, #161d38, #11162d);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }

    .zoom-btn {
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
      transition: background 0.15s ease;
    }

    .zoom-btn:hover {
      background: #1f2a44;
    }

    .zoom-btn svg {
      width: 16px;
      height: 16px;
    }

    .zoom-divider {
      height: 1px;
      background: var(--border);
      margin: 2px 0;
    }

    .zoom-level {
      font-size: 10px;
      color: var(--muted);
      text-align: center;
      padding: 4px 0;
      min-width: 32px;
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
