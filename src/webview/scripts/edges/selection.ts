/**
 * Edge selection module
 * Handles edge click, hover, and selection state
 */

export function getEdgeSelectionScript(): string {
  return `
    /**
     * Edge groups storage for selection
     */
    var edgeGroups = {};
    var selectedEdgeId = null;

    /**
     * Clear edge selection
     */
    function clearEdgeSelection(layer) {
      if (selectedEdgeId && edgeGroups[selectedEdgeId]) {
        var group = edgeGroups[selectedEdgeId];
        var edgeData = group.getAttr("edgeData");
        var originalColor = getEdgeColor(edgeData.label);
        
        // Reset visible line to original color
        var edgeLine = group.findOne(".edge-line");
        if (edgeLine) {
          edgeLine.stroke(originalColor);
          edgeLine.strokeWidth(2);
        }
        
        // Reset arrow to original color
        var arrowLine = group.findOne(".edge-arrow");
        if (arrowLine) {
          arrowLine.fill(originalColor);
          arrowLine.stroke(originalColor);
        }
        
        // Reset label text
        group.find("Text").forEach(function(text) {
          text.fill(originalColor);
        });
        
        // Remove glow effect
        var glow = group.findOne(".edge-glow");
        if (glow) {
          glow.destroy();
        }
      }
      selectedEdgeId = null;
    }

    /**
     * Select an edge
     */
    function selectEdge(edgeId, edge, layer) {
      // Clear node selection
      clearSelection();
      
      // Clear previous edge selection
      if (selectedEdgeId && selectedEdgeId !== edgeId) {
        clearEdgeSelection(layer);
      }

      selectedEdgeId = edgeId;
      var group = edgeGroups[edgeId];
      if (!group) return;

      var highlightColor = "#ffffff";
      
      // Highlight visible line
      var edgeLine = group.findOne(".edge-line");
      if (edgeLine) {
        edgeLine.stroke(highlightColor);
        edgeLine.strokeWidth(4);
      }
      
      // Highlight arrow
      var arrowLine = group.findOne(".edge-arrow");
      if (arrowLine) {
        arrowLine.fill(highlightColor);
        arrowLine.stroke(highlightColor);
      }
      
      // Highlight label
      group.find("Text").forEach(function(text) {
        text.fill(highlightColor);
      });

      // Add glow effect behind the main line
      if (edgeLine) {
        var glowLine = edgeLine.clone({
          name: "edge-glow",
          stroke: highlightColor,
          strokeWidth: 10,
          opacity: 0.3,
          listening: false
        });
        group.add(glowLine);
        glowLine.moveToBottom();
      }

      layer.batchDraw();

      // Show properties panel with edge info
      showPropertiesPanel();
      renderEdgeProperties(edge);
    }

    /**
     * Setup edge hover effects
     */
    function setupEdgeHover(edgeGroup, edgeId, edge, layer) {
      edgeGroup.on("mouseenter", function() {
        document.body.style.cursor = "pointer";
        if (selectedEdgeId !== edgeId) {
          var group = edgeGroups[edgeId];
          var edgeLine = group.findOne(".edge-line");
          if (edgeLine) {
            edgeLine.strokeWidth(4);
          }
          layer.batchDraw();
        }
      });

      edgeGroup.on("mouseleave", function() {
        document.body.style.cursor = "default";
        if (selectedEdgeId !== edgeId) {
          var group = edgeGroups[edgeId];
          var edgeLine = group.findOne(".edge-line");
          if (edgeLine) {
            edgeLine.strokeWidth(2);
          }
          layer.batchDraw();
        }
      });

      edgeGroup.on("click tap", function(e) {
        e.cancelBubble = true;
        selectEdge(edgeId, edge, layer);
      });
    }
  `;
}
