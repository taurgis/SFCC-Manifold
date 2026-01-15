/**
 * Shared constants for canvas rendering
 * These are embedded as JavaScript in the webview
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
  nodeHeight: 100,
  horizontalGap: 380,
  verticalGap: 130,
  baseX: 60,
  baseY: 60,
};

export const ZOOM_CONFIG = {
  scaleBy: 1.15,
  minScale: 0.1,
  maxScale: 3,
};

export const EDGE_COLORS: Record<string, string> = {
  // Default/normal flow
  default: "#6dd3ff",      // Blue - regular connections
  next: "#6dd3ff",         // Blue - next step
  
  // Error paths
  error: "#ff8a7a",        // Red - error connections
  pipelet_error: "#ff8a7a", // Red - pipelet error
  
  // Loop paths  
  loop: "#f2c078",         // Yellow/Orange - loop back-edge
  do: "#f2c078",           // Yellow/Orange - loop body
  iterate: "#f2c078",      // Yellow/Orange - iteration
  
  // Decision/branch paths
  yes: "#6be8c7",          // Green - positive branch
  true: "#6be8c7",         // Green - true condition
  no: "#ff8a7a",           // Red - negative branch  
  false: "#ff8a7a",        // Red - false condition
  
  // Success paths
  success: "#6be8c7",      // Green - success
  pipelet_next: "#6be8c7", // Green - pipelet success
  ok: "#6be8c7",           // Green - ok
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
};

/**
 * Generate the constants as a JavaScript string for embedding
 */
export function getConstantsScript(): string {
  return `
    var colors = ${JSON.stringify(NODE_COLORS)};
    var edgeColors = ${JSON.stringify(EDGE_COLORS)};
    var nodeWidth = ${LAYOUT_CONFIG.nodeWidth};
    var nodeHeight = ${LAYOUT_CONFIG.nodeHeight};
    var horizontalGap = ${LAYOUT_CONFIG.horizontalGap};
    var verticalGap = ${LAYOUT_CONFIG.verticalGap};
    var baseX = ${LAYOUT_CONFIG.baseX};
    var baseY = ${LAYOUT_CONFIG.baseY};
    var scaleBy = ${ZOOM_CONFIG.scaleBy};
    var minScale = ${ZOOM_CONFIG.minScale};
    var maxScale = ${ZOOM_CONFIG.maxScale};

    /**
     * Get edge color based on label
     */
    function getEdgeColor(label) {
      if (!label) return edgeColors.default;
      
      var lowerLabel = label.toLowerCase().replace(/[_-]/g, '_');
      
      // Check for error patterns
      if (lowerLabel.indexOf('error') !== -1) return edgeColors.error;
      if (lowerLabel === 'pipelet_error') return edgeColors.pipelet_error;
      
      // Check for loop patterns
      if (lowerLabel === 'do') return edgeColors.do;
      if (lowerLabel === 'loop') return edgeColors.loop;
      if (lowerLabel.indexOf('iterate') !== -1) return edgeColors.iterate;
      if (lowerLabel === 'next_iteration') return edgeColors.loop;
      
      // Check for decision patterns
      if (lowerLabel === 'yes' || lowerLabel === 'true') return edgeColors.yes;
      if (lowerLabel === 'no' || lowerLabel === 'false') return edgeColors.no;
      
      // Check for success patterns
      if (lowerLabel.indexOf('success') !== -1) return edgeColors.success;
      if (lowerLabel === 'pipelet_next') return edgeColors.pipelet_next;
      if (lowerLabel === 'ok') return edgeColors.ok;
      if (lowerLabel === 'next') return edgeColors.next;
      
      return edgeColors.default;
    }

    /**
     * Check if this is a loop back-edge (going upward)
     */
    function isLoopBackEdge(label) {
      if (!label) return false;
      var lowerLabel = label.toLowerCase();
      return lowerLabel === 'loop' || lowerLabel === 'next_iteration';
    }
  `;
}
