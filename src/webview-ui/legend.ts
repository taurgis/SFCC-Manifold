/**
 * Legend rendering module
 */

import { NODE_COLORS } from "./constants";
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
}
