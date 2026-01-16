/**
 * Properties panel rendering and management
 */

import type Konva from "konva";
import { NODE_COLORS, getEdgeColor } from "./constants";
import { pipelineData, placedNodes, setSelectedNodeId, setSelectedEdgeId } from "./state";
import { iconSvgs, getNodeTypeIcon } from "./icons";
import { escapeHtml, escapeAttr, formatAttributeKey } from "./utils";
import type { PlacedNode, PipelineNode, PipelineEdge } from "./types";

/**
 * Find a node by ID (local implementation to avoid circular deps)
 */
function findNodeById(id: string): PipelineNode | PlacedNode | null {
  // First check placed nodes
  for (const node of placedNodes) {
    if (node.id === id) {
      return node;
    }
  }
  // Fall back to pipeline data
  for (const node of pipelineData.nodes) {
    if (node.id === id) {
      return node;
    }
  }
  return null;
}

/**
 * Initialize the properties panel with event handlers
 */
export function initPropertiesPanel(): void {
  const panel = document.getElementById("propertiesPanel");
  const closeBtn = document.getElementById("propertiesClose");
  const content = document.getElementById("propertiesContent");

  if (!panel || !closeBtn || !content) return;

  closeBtn.addEventListener("click", () => {
    hidePropertiesPanel();
    // Clear selection state directly to avoid circular dependency
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  });

  // Close panel on escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("visible")) {
      hidePropertiesPanel();
      // Clear selection state directly to avoid circular dependency
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  });

  // Event delegation for connection item clicks
  content.addEventListener("click", (e) => {
    let target = e.target as HTMLElement | null;
    while (target && target !== content) {
      if (target.classList?.contains("connection-item")) {
        const nodeId = target.getAttribute("data-node-id");
        if (nodeId && window.handleConnectionClick) {
          window.handleConnectionClick(nodeId);
        }
        return;
      }
      target = target.parentElement;
    }
  });

  // Initialize resize functionality
  initPanelResize();
}

/**
 * Initialize panel resize drag functionality
 */
function initPanelResize(): void {
  const panel = document.getElementById("propertiesPanel");
  const handle = document.getElementById("propertiesResizeHandle");
  if (!panel || !handle) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  const minWidth = 280;
  const maxWidth = 600;

  handle.addEventListener("mousedown", (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = panel.offsetWidth;

    panel.classList.add("resizing");
    handle.classList.add("dragging");
    document.body.classList.add("resizing-panel");

    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    const delta = startX - e.clientX;
    const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
    panel.style.width = `${newWidth}px`;
    panel.style.minWidth = `${newWidth}px`;
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      panel.classList.remove("resizing");
      handle.classList.remove("dragging");
      document.body.classList.remove("resizing-panel");
    }
  });
}

/**
 * Show the properties panel
 */
export function showPropertiesPanel(): void {
  const panel = document.getElementById("propertiesPanel");
  if (panel) {
    panel.classList.add("visible");
  }
}

/**
 * Hide the properties panel
 */
export function hidePropertiesPanel(): void {
  const panel = document.getElementById("propertiesPanel");
  if (panel) {
    panel.classList.remove("visible");
  }
}

/**
 * Render node properties in the panel
 */
export function renderNodeProperties(node: PlacedNode | PipelineNode): void {
  const content = document.getElementById("propertiesContent");
  if (!content) return;

  const color = NODE_COLORS[node.type] || NODE_COLORS.unknown;

  // Find connections
  const incoming: PipelineEdge[] = [];
  const outgoing: PipelineEdge[] = [];

  for (const edge of pipelineData.edges) {
    if (edge.to === node.id) {
      incoming.push(edge);
    }
    if (edge.from === node.id) {
      outgoing.push(edge);
    }
  }

  content.innerHTML =
    renderNodeHeader(node, color) +
    renderConfigPropertiesSection(node) +
    renderBindingsSection(node) +
    renderAttributesSection(node) +
    renderTemplateSection(node) +
    renderDescriptionSection(node) +
    renderConnectionsSection(incoming, outgoing) +
    renderLocationSection(node);
}

/**
 * Render edge properties in the panel
 */
export function renderEdgeProperties(edge: PipelineEdge): void {
  const content = document.getElementById("propertiesContent");
  if (!content) return;

  const fromNode = findNodeById(edge.from);
  const toNode = findNodeById(edge.to);
  const edgeColor = getEdgeColor(edge.label);

  let html = renderEdgeHeader(edge, edgeColor);
  html += renderEdgeFromSection(fromNode);
  html += renderEdgeToSection(toNode);
  html += renderEdgeDetailsSection(edge);

  content.innerHTML = html;
}

function renderNodeHeader(node: PlacedNode | PipelineNode, color: string): string {
  const typeIcon = getNodeTypeIcon(node.type);

  return `<div class="node-header">
    <div class="node-type-badge" style="background: ${color}22; color: ${color};">
      ${typeIcon}
      <span>${escapeHtml(node.type)}</span>
    </div>
    <div class="node-name">${escapeHtml(node.label)}</div>
    <div class="node-id">${escapeHtml(node.id)}</div>
  </div>`;
}

function renderLocationSection(node: PlacedNode | PipelineNode): string {
  const branchParts = node.branch.split("/");
  let branchHtml = "";

  for (let i = 0; i < branchParts.length; i++) {
    if (i > 0) {
      branchHtml += '<span class="branch-separator">›</span>';
    }
    branchHtml += `<span class="branch-segment">${escapeHtml(branchParts[i])}</span>`;
  }

  return `<div class="properties-section">
    <div class="properties-section-title">
      ${iconSvgs.location}
      Location
    </div>
    <div class="branch-path">${branchHtml}</div>
  </div>`;
}

function renderConnectionsSection(
  incoming: PipelineEdge[],
  outgoing: PipelineEdge[]
): string {
  let html = `<div class="properties-section">
    <div class="properties-section-title">
      ${iconSvgs.connections}
      Connections (${incoming.length + outgoing.length})
    </div>`;

  if (incoming.length === 0 && outgoing.length === 0) {
    html += '<div class="no-connections">No connections</div>';
  } else {
    html += '<div class="connection-list">';

    // Incoming connections
    for (const edge of incoming) {
      const fromNode = findNodeById(edge.from);
      html += renderConnectionItem(
        fromNode,
        edge,
        "incoming",
        fromNode ? NODE_COLORS[fromNode.type] : NODE_COLORS.unknown
      );
    }

    // Outgoing connections
    for (const edge of outgoing) {
      const toNode = findNodeById(edge.to);
      html += renderConnectionItem(
        toNode,
        edge,
        "outgoing",
        toNode ? NODE_COLORS[toNode.type] : NODE_COLORS.unknown
      );
    }

    html += "</div>";
  }

  html += "</div>";
  return html;
}

function renderConnectionItem(
  connectedNode: PipelineNode | PlacedNode | null,
  edge: PipelineEdge,
  direction: "incoming" | "outgoing",
  color: string
): string {
  const dirIcon = direction === "incoming" ? iconSvgs.arrowDown : iconSvgs.arrowUp;
  const nodeName = connectedNode ? connectedNode.label : edge.from || edge.to;
  const nodeType = connectedNode ? connectedNode.type : "unknown";
  const nodeId = direction === "incoming" ? edge.from : edge.to;

  return `<div class="connection-item" data-node-id="${escapeAttr(nodeId)}">
    <div class="connection-direction ${direction}">
      ${dirIcon}
    </div>
    <div class="connection-info">
      <div class="connection-node-name">${escapeHtml(nodeName)}</div>
      ${edge.label ? `<div class="connection-edge-label">${escapeHtml(edge.label)}</div>` : ""}
    </div>
    <div class="connection-badge" style="background: ${color}22; color: ${color};">
      ${escapeHtml(nodeType)}
    </div>
  </div>`;
}

function renderDescriptionSection(node: PlacedNode | PipelineNode): string {
  if (!node.description) {
    return "";
  }

  return `<div class="properties-section">
    <div class="properties-section-title">
      ${iconSvgs.text}
      Description
    </div>
    <div class="description-content">${escapeHtml(node.description)}</div>
  </div>`;
}

function renderConfigPropertiesSection(node: PlacedNode | PipelineNode): string {
  const configProps = node.configProperties;
  if (!configProps || configProps.length === 0) {
    return "";
  }

  let html = `<div class="properties-section">
    <div class="properties-section-title">
      ${iconSvgs.settings}
      Configuration (${configProps.length})
    </div>
    <div class="attributes-grid">`;

  for (const prop of configProps) {
    const displayValue =
      prop.value !== undefined && prop.value !== null && prop.value !== ""
        ? escapeHtml(String(prop.value))
        : '<span class="empty">empty</span>';

    html += `<div class="attribute-item">
      <div class="attribute-key">${escapeHtml(prop.key)}</div>
      <div class="attribute-value">${displayValue}</div>
    </div>`;
  }

  html += "</div></div>";
  return html;
}

function renderBindingsSection(node: PlacedNode | PipelineNode): string {
  const bindings = node.bindings;
  if (!bindings || bindings.length === 0) {
    return "";
  }

  let html = `<div class="properties-section">
    <div class="properties-section-title">
      ${iconSvgs.binding}
      Key Bindings (${bindings.length})
    </div>
    <div class="bindings-list">`;

  for (const binding of bindings) {
    html += `<div class="binding-item">
      <div class="binding-key">
        <span class="binding-key-label">Key</span>
        <span class="binding-key-value">${escapeHtml(binding.key)}</span>
      </div>
      <div class="binding-arrow">${iconSvgs.arrowRight}</div>
      <div class="binding-alias">
        <span class="binding-alias-label">Alias</span>
        <span class="binding-alias-value${binding.alias ? "" : " empty"}">
          ${binding.alias ? escapeHtml(binding.alias) : "empty"}
        </span>
      </div>
    </div>`;
  }

  html += "</div></div>";
  return html;
}

function renderTemplateSection(node: PlacedNode | PipelineNode): string {
  const template = node.template;
  if (!template) {
    return "";
  }

  return `<div class="properties-section">
    <div class="properties-section-title">
      ${iconSvgs.template}
      Template
    </div>
    <div class="template-info">
      <div class="template-name">${escapeHtml(template.name)}</div>
      <div class="template-flags">
        ${template.buffered ? '<span class="template-flag buffered">Buffered</span>' : ""}
        ${template.dynamic ? '<span class="template-flag dynamic">Dynamic</span>' : '<span class="template-flag static">Static</span>'}
      </div>
    </div>
  </div>`;
}

function renderAttributesSection(node: PlacedNode | PipelineNode): string {
  const attrs = node.attributes || {};
  const keys = Object.keys(attrs);

  if (keys.length === 0) {
    return `<div class="properties-section">
      <div class="properties-section-title">
        ${iconSvgs.settings}
        Attributes
      </div>
      <div class="no-connections">No attributes</div>
    </div>`;
  }

  let html = `<div class="properties-section">
    <div class="properties-section-title">
      ${iconSvgs.settings}
      Attributes (${keys.length})
    </div>
    <div class="attributes-grid">`;

  keys.sort();

  for (const key of keys) {
    const value = attrs[key];
    const displayValue =
      value !== undefined && value !== null && value !== ""
        ? escapeHtml(String(value))
        : '<span class="empty">empty</span>';

    html += `<div class="attribute-item">
      <div class="attribute-key">${escapeHtml(formatAttributeKey(key))}</div>
      <div class="attribute-value">${displayValue}</div>
    </div>`;
  }

  html += "</div></div>";
  return html;
}

function renderEdgeHeader(edge: PipelineEdge, edgeColor: string): string {
  return `<div class="node-header">
    <div class="node-type-badge" style="background: ${edgeColor}22; color: ${edgeColor};">
      ${iconSvgs.connections}
      <span>connection</span>
    </div>
    <div class="node-name">${edge.label || "Default Connection"}</div>
  </div>`;
}

function renderEdgeFromSection(fromNode: PipelineNode | PlacedNode | null): string {
  let html = `<div class="properties-section">
    <div class="properties-section-title">
      ${iconSvgs.arrowUp}
      From Node
    </div>`;

  if (fromNode) {
    const fromColor = NODE_COLORS[fromNode.type] || NODE_COLORS.unknown;
    html += `<div class="connection-item" data-node-id="${escapeAttr(fromNode.id)}">
      <div class="connection-info" style="flex: 1;">
        <div class="connection-node-name">${escapeHtml(fromNode.label)}</div>
        <div class="connection-edge-label">${escapeHtml(fromNode.branch)}</div>
      </div>
      <div class="connection-badge" style="background: ${fromColor}22; color: ${fromColor};">
        ${escapeHtml(fromNode.type)}
      </div>
    </div>`;
  } else {
    html += '<div class="no-connections">Node not found</div>';
  }
  html += "</div>";
  return html;
}

function renderEdgeToSection(toNode: PipelineNode | PlacedNode | null): string {
  let html = `<div class="properties-section">
    <div class="properties-section-title">
      ${iconSvgs.arrowDown}
      To Node
    </div>`;

  if (toNode) {
    const toColor = NODE_COLORS[toNode.type] || NODE_COLORS.unknown;
    html += `<div class="connection-item" data-node-id="${escapeAttr(toNode.id)}">
      <div class="connection-info" style="flex: 1;">
        <div class="connection-node-name">${escapeHtml(toNode.label)}</div>
        <div class="connection-edge-label">${escapeHtml(toNode.branch)}</div>
      </div>
      <div class="connection-badge" style="background: ${toColor}22; color: ${toColor};">
        ${escapeHtml(toNode.type)}
      </div>
    </div>`;
  } else {
    html += '<div class="no-connections">Node not found</div>';
  }
  html += "</div>";
  return html;
}

function renderEdgeDetailsSection(edge: PipelineEdge): string {
  return `<div class="properties-section">
    <div class="properties-section-title">
      ${iconSvgs.settings}
      Details
    </div>
    <div class="attributes-grid">
      <div class="attribute-item">
        <div class="attribute-key">Label</div>
        <div class="attribute-value">${edge.label ? escapeHtml(edge.label) : '<span class="empty">none</span>'}</div>
      </div>
      <div class="attribute-item">
        <div class="attribute-key">From ID</div>
        <div class="attribute-value">${escapeHtml(edge.from)}</div>
      </div>
      <div class="attribute-item">
        <div class="attribute-key">To ID</div>
        <div class="attribute-value">${escapeHtml(edge.to)}</div>
      </div>
    </div>
  </div>`;
}
