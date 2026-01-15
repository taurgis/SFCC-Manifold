/**
 * Sidebar HTML template for pipeline metadata
 */

import { ParsedPipeline } from "../../lib/types";
import { escapeHtml } from "../helpers";
import { icons } from "../icons";

export interface SidebarData {
  pipeline: ParsedPipeline;
  sourcePath: string;
}

export function renderSidebar(data: SidebarData): string {
  const { pipeline, sourcePath } = data;

  return `
    <aside class="sidebar" id="sidebar">
      ${renderHeader(pipeline)}
      ${renderSourceSection(sourcePath)}
      ${renderStatisticsSection(pipeline)}
      ${renderDescriptionSection(pipeline)}
      ${renderLegendSection()}
    </aside>
  `;
}

function renderHeader(pipeline: ParsedPipeline): string {
  return `
    <div class="sidebar-header">
      <div class="sidebar-title">Pipeline</div>
      <div class="pipeline-name">${escapeHtml(pipeline.name)}</div>
      ${pipeline.group ? `<div class="pipeline-group">${escapeHtml(pipeline.group)}</div>` : ""}
    </div>
  `;
}

function renderSourceSection(sourcePath: string): string {
  return `
    <div class="sidebar-section">
      <div class="section-title">
        ${icons.file}
        Source File
      </div>
      <div class="meta-value path">${escapeHtml(sourcePath)}</div>
    </div>
  `;
}

function renderStatisticsSection(pipeline: ParsedPipeline): string {
  return `
    <div class="sidebar-section">
      <div class="section-title">
        ${icons.table}
        Statistics
      </div>
      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-value">${pipeline.nodes.length}</div>
          <div class="stat-label">Nodes</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${pipeline.edges.length}</div>
          <div class="stat-label">Edges</div>
        </div>
      </div>
      ${pipeline.type ? `
        <div class="meta-item" style="margin-top: 10px;">
          <span class="meta-label">Type:</span>
          <span class="meta-value">${escapeHtml(pipeline.type)}</span>
        </div>
      ` : ""}
    </div>
  `;
}

function renderDescriptionSection(pipeline: ParsedPipeline): string {
  if (!pipeline.description) {
    return "";
  }

  return `
    <div class="sidebar-section">
      <div class="section-title">
        ${icons.text}
        Description
      </div>
      <div class="description-text">${escapeHtml(pipeline.description)}</div>
    </div>
  `;
}

function renderLegendSection(): string {
  return `
    <div class="sidebar-section" style="flex: 1; overflow-y: auto;">
      <div class="section-title">
        ${icons.grid}
        Legend
      </div>
      <div class="legend-grid" id="legend"></div>
    </div>
  `;
}
