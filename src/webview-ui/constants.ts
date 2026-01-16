/**
 * Shared constants for canvas rendering
 * These are exported as typed values for use in the webview
 */

export const NODE_COLORS: Record<string, string> = {
  start: "#6be8c7",
  end: "#ff8a7a",
  pipelet: "#6dd3ff",
  call: "#f2c078",
  jump: "#f2c078",
  interaction: "#9c6dff",
  decision: "#f2c078",
  join: "#93a4c8",
  loop: "#6be8c7",
  text: "#93a4c8",
  unknown: "#93a4c8",
};

export const LAYOUT_CONFIG = {
  nodeWidth: 180,
  nodeHeight: 80,
  horizontalGap: 220,
  verticalGap: 110,
  baseX: 60,
  baseY: 60,
} as const;

export const ZOOM_CONFIG = {
  scaleBy: 1.08,
  wheelScaleBy: 1.03,
  minScale: 0.1,
  maxScale: 3,
} as const;

export const EDGE_COLORS: Record<string, string> = {
  default: "#6dd3ff",
  next: "#6dd3ff",
  error: "#ff8a7a",
  pipelet_error: "#ff8a7a",
  loop: "#f2c078",
  do: "#f2c078",
  iterate: "#f2c078",
  yes: "#6be8c7",
  true: "#6be8c7",
  no: "#ff8a7a",
  false: "#ff8a7a",
  success: "#6be8c7",
  pipelet_next: "#6be8c7",
  ok: "#6be8c7",
};

export const THEME = {
  nodeFill: "#0d1328",
  nodeOverlay: "rgba(255,255,255,0.03)",
  edgeColor: "#6dd3ff",
  gridColor: "#1a2340",
  textColor: "#d8e2ff",
  mutedColor: "#93a4c8",
  darkBg: "#0b1021",
  fontFamily: "IBM Plex Sans, system-ui, sans-serif",
} as const;

// Edge routing constants
export const EDGE_PAD = 26;
export const EDGE_SPACING = 12;

// Viewport culling configuration
export const CULLING_MARGIN = 200;

/**
 * Get edge color based on label
 */
export function getEdgeColor(label: string | null | undefined): string {
  if (!label) return EDGE_COLORS.default;

  const lowerLabel = label.toLowerCase().replace(/[_-]/g, "_");

  // Check for error patterns
  if (lowerLabel.indexOf("error") !== -1) return EDGE_COLORS.error;
  if (lowerLabel === "pipelet_error") return EDGE_COLORS.pipelet_error;

  // Check for loop patterns
  if (lowerLabel === "do") return EDGE_COLORS.do;
  if (lowerLabel === "loop") return EDGE_COLORS.loop;
  if (lowerLabel.indexOf("iterate") !== -1) return EDGE_COLORS.iterate;
  if (lowerLabel === "next_iteration") return EDGE_COLORS.loop;

  // Check for decision patterns
  if (lowerLabel === "yes" || lowerLabel === "true") return EDGE_COLORS.yes;
  if (lowerLabel === "no" || lowerLabel === "false") return EDGE_COLORS.no;

  // Check for success patterns
  if (lowerLabel.indexOf("success") !== -1) return EDGE_COLORS.success;
  if (lowerLabel === "pipelet_next") return EDGE_COLORS.pipelet_next;
  if (lowerLabel === "ok") return EDGE_COLORS.ok;
  if (lowerLabel === "next") return EDGE_COLORS.next;

  return EDGE_COLORS.default;
}

/**
 * Check if this is a loop back-edge (going upward)
 */
export function isLoopBackEdge(label: string | null | undefined): boolean {
  if (!label) return false;
  const lowerLabel = label.toLowerCase();
  return lowerLabel === "loop" || lowerLabel === "next_iteration";
}
