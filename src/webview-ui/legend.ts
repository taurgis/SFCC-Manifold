/**
 * Legend rendering module
 */

import { NODE_COLORS, BENDPOINT_INDICATOR_COLOR } from "./constants";
import type { PlacedNode } from "./types";

/**
 * Render legend items in the sidebar
 */
export function renderLegend(placedNodes: PlacedNode[]): void {
  const legendEl = document.getElementById("legend");
  if (!legendEl) return;

  const seenTypes: Record<string, boolean> = {};

  for (const node of placedNodes) {
    if (seenTypes[node.type]) continue;
    seenTypes[node.type] = true;

    const item = document.createElement("div");
    item.className = "legend-item";

    const swatch = document.createElement("div");
    swatch.className = "legend-swatch";
    swatch.style.background = NODE_COLORS[node.type] || NODE_COLORS.unknown;

    const label = document.createElement("span");
    label.textContent = node.type;

    item.appendChild(swatch);
    item.appendChild(label);
    legendEl.appendChild(item);
  }

  // Add bendpoint indicator to legend
  addBendpointLegendItem(legendEl);
}

/**
 * Add bendpoint indicator legend item
 */
function addBendpointLegendItem(legendEl: HTMLElement): void {
  const item = document.createElement("div");
  item.className = "legend-item";

  const swatch = document.createElement("div");
  swatch.className = "legend-swatch legend-swatch-circle";
  swatch.style.background = BENDPOINT_INDICATOR_COLOR;
  swatch.style.borderRadius = "50%";
  swatch.style.border = "1px solid #ffffff";

  const label = document.createElement("span");
  label.textContent = "bendpoint (forced route)";

  item.appendChild(swatch);
  item.appendChild(label);
  legendEl.appendChild(item);
}
