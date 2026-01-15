/**
 * Konva canvas initialization and rendering script (embedded JavaScript)
 */

export function getCanvasScript(): string {
  return `
    /**
     * Edge groups storage for selection
     */
    var edgeGroups = {};
    var selectedEdgeId = null;

    /**
     * Render legend items in the sidebar
     */
    function renderLegend(placedNodes) {
      var legendEl = document.getElementById("legend");
      if (!legendEl) return;
      
      var seenTypes = {};
      
      for (var i = 0; i < placedNodes.length; i++) {
        var node = placedNodes[i];
        if (seenTypes[node.type]) continue;
        seenTypes[node.type] = true;
        
        var item = document.createElement("div");
        item.className = "legend-item";

        var swatch = document.createElement("div");
        swatch.className = "legend-swatch";
        swatch.style.background = colors[node.type] || colors.unknown;

        var label = document.createElement("span");
        label.textContent = node.type;

        item.appendChild(swatch);
        item.appendChild(label);
        legendEl.appendChild(item);
      }
    }

    /**
     * Initialize Konva stage and layers
     */
    function initializeStage(containerId) {
      var container = document.getElementById(containerId);
      var containerRect = container.getBoundingClientRect();
      
      var stage = new Konva.Stage({
        container: containerId,
        width: containerRect.width,
        height: containerRect.height,
        draggable: true
      });

      var layer = new Konva.Layer();
      stage.add(layer);

      var gridLayer = new Konva.Layer();
      stage.add(gridLayer);
      gridLayer.moveToBottom();

      return { stage: stage, layer: layer, gridLayer: gridLayer, containerRect: containerRect };
    }

    /**
     * Draw background grid
     */
    function createDrawGrid(stage, gridLayer, getContainerRect) {
      return function drawGrid() {
        var containerRect = getContainerRect();
        gridLayer.destroyChildren();
        var gridSize = 50;
        var stagePos = stage.position();
        var scale = stage.scaleX();
        
        var startX = Math.floor(-stagePos.x / scale / gridSize) * gridSize - gridSize;
        var endX = Math.ceil((containerRect.width - stagePos.x) / scale / gridSize) * gridSize + gridSize;
        var startY = Math.floor(-stagePos.y / scale / gridSize) * gridSize - gridSize;
        var endY = Math.ceil((containerRect.height - stagePos.y) / scale / gridSize) * gridSize + gridSize;

        for (var x = startX; x <= endX; x += gridSize) {
          gridLayer.add(new Konva.Line({
            points: [x, startY, x, endY],
            stroke: "#1a2340",
            strokeWidth: 1 / scale,
            listening: false
          }));
        }
        for (var y = startY; y <= endY; y += gridSize) {
          gridLayer.add(new Konva.Line({
            points: [startX, y, endX, y],
            stroke: "#1a2340",
            strokeWidth: 1 / scale,
            listening: false
          }));
        }
        gridLayer.batchDraw();
      };
    }

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
          arrowLine.stroke(originalColor);
          arrowLine.strokeWidth(2);
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
        arrowLine.stroke(highlightColor);
        arrowLine.strokeWidth(3);
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
     * Render edge properties in the panel
     */
    function renderEdgeProperties(edge) {
      var content = document.getElementById("propertiesContent");
      var fromNode = findNodeById(edge.from);
      var toNode = findNodeById(edge.to);
      var edgeColor = getEdgeColor(edge.label);

      var html = '<div class="node-header">' +
        '<div class="node-type-badge" style="background: ' + edgeColor + '22; color: ' + edgeColor + ';">' +
          iconSvgs.connections +
          '<span>connection</span>' +
        '</div>' +
        '<div class="node-name">' + (edge.label || 'Default Connection') + '</div>' +
      '</div>';

      // From node section
      html += '<div class="properties-section">' +
        '<div class="properties-section-title">' +
          iconSvgs.arrowUp +
          'From Node' +
        '</div>';
      
      if (fromNode) {
        var fromColor = colors[fromNode.type] || colors.unknown;
        html += '<div class="connection-item" onclick="handleConnectionClick(\\'' + escapeAttr(fromNode.id) + '\\')">' +
          '<div class="connection-info" style="flex: 1;">' +
            '<div class="connection-node-name">' + escapeHtml(fromNode.label) + '</div>' +
            '<div class="connection-edge-label">' + escapeHtml(fromNode.branch) + '</div>' +
          '</div>' +
          '<div class="connection-badge" style="background: ' + fromColor + '22; color: ' + fromColor + ';">' +
            escapeHtml(fromNode.type) +
          '</div>' +
        '</div>';
      } else {
        html += '<div class="no-connections">Node not found</div>';
      }
      html += '</div>';

      // To node section
      html += '<div class="properties-section">' +
        '<div class="properties-section-title">' +
          iconSvgs.arrowDown +
          'To Node' +
        '</div>';
      
      if (toNode) {
        var toColor = colors[toNode.type] || colors.unknown;
        html += '<div class="connection-item" onclick="handleConnectionClick(\\'' + escapeAttr(toNode.id) + '\\')">' +
          '<div class="connection-info" style="flex: 1;">' +
            '<div class="connection-node-name">' + escapeHtml(toNode.label) + '</div>' +
            '<div class="connection-edge-label">' + escapeHtml(toNode.branch) + '</div>' +
          '</div>' +
          '<div class="connection-badge" style="background: ' + toColor + '22; color: ' + toColor + ';">' +
            escapeHtml(toNode.type) +
          '</div>' +
        '</div>';
      } else {
        html += '<div class="no-connections">Node not found</div>';
      }
      html += '</div>';

      // Edge details
      html += '<div class="properties-section">' +
        '<div class="properties-section-title">' +
          iconSvgs.settings +
          'Details' +
        '</div>' +
        '<div class="attributes-grid">' +
          '<div class="attribute-item">' +
            '<div class="attribute-key">Label</div>' +
            '<div class="attribute-value">' + (edge.label ? escapeHtml(edge.label) : '<span class="empty">none</span>') + '</div>' +
          '</div>' +
          '<div class="attribute-item">' +
            '<div class="attribute-key">From ID</div>' +
            '<div class="attribute-value">' + escapeHtml(edge.from) + '</div>' +
          '</div>' +
          '<div class="attribute-item">' +
            '<div class="attribute-key">To ID</div>' +
            '<div class="attribute-value">' + escapeHtml(edge.to) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

      content.innerHTML = html;
    }

    /**
     * Draw edges between nodes
     */
    function drawEdges(layer, edges, nodeMap) {
      var EDGE_PAD = 26;
      var EDGE_SPACING = 12;

      function normalizeLabel(label) {
        if (!label) return "";
        return String(label).toLowerCase().replace(/[\s-]/g, "_");
      }

      function isErrorEdge(label) {
        var l = normalizeLabel(label);
        return l === "error" || l.indexOf("error") !== -1 || l === "pipelet_error";
      }

      function isDecisionYes(label) {
        var l = normalizeLabel(label);
        return l === "yes" || l === "true";
      }

      function isDecisionNo(label) {
        var l = normalizeLabel(label);
        return l === "no" || l === "false";
      }

      /**
       * Get anchor point based on connector name from XML
       * Legacy connectors: in, in1, in2, out, out1, out2, error, yes, no, loop
       */
      function getConnectorAnchor(node, connector, offset) {
        offset = offset || 0;
        var cx = node.x + nodeWidth / 2;
        var cy = node.y + nodeHeight / 2;
        
        // Normalize connector name
        var conn = (connector || "").toLowerCase();
        
        // Top connectors (inputs)
        if (conn === "in" || conn === "in1") {
          return { x: cx + offset, y: node.y, side: "top" };
        }
        if (conn === "in2") {
          return { x: cx + 30 + offset, y: node.y, side: "top" };
        }
        if (conn === "loop") {
          return { x: cx - 30 + offset, y: node.y, side: "top" };
        }
        
        // Bottom connectors (outputs - default flow)
        if (conn === "out" || conn === "out1" || conn === "next" || conn === "") {
          return { x: cx + offset, y: node.y + nodeHeight, side: "bottom" };
        }
        if (conn === "out2") {
          return { x: cx + 30 + offset, y: node.y + nodeHeight, side: "bottom" };
        }
        
        // Right connectors (error, yes)
        if (conn === "error" || conn === "pipelet_error") {
          return { x: node.x + nodeWidth, y: cy + offset, side: "right" };
        }
        if (conn === "yes" || conn === "true") {
          return { x: node.x + nodeWidth, y: cy + offset, side: "right" };
        }
        
        // Left connectors (no)
        if (conn === "no" || conn === "false") {
          return { x: node.x, y: cy + offset, side: "left" };
        }
        
        // Default to bottom
        return { x: cx + offset, y: node.y + nodeHeight, side: "bottom" };
      }

      function getAnchor(node, side, offset) {
        // Special handling for join nodes which are rendered as circles
        if (node.type === "join") {
          var circleRadius = 15;
          var cx = node.x + nodeWidth / 2;
          var cy = node.y + nodeHeight / 2;
          
          if (side === "top") return { x: cx + offset, y: cy - circleRadius };
          if (side === "bottom") return { x: cx + offset, y: cy + circleRadius };
          if (side === "left") return { x: cx - circleRadius, y: cy + offset };
          return { x: cx + circleRadius, y: cy + offset }; // right
        }
        
        // Standard rectangular node anchors
        if (side === "top") return { x: node.x + nodeWidth / 2 + offset, y: node.y };
        if (side === "bottom") return { x: node.x + nodeWidth / 2 + offset, y: node.y + nodeHeight };
        if (side === "left") return { x: node.x, y: node.y + nodeHeight / 2 + offset };
        return { x: node.x + nodeWidth, y: node.y + nodeHeight / 2 + offset }; // right
      }

      function getArrowAngleForSide(side) {
        if (side === "top") return -Math.PI / 2;
        if (side === "bottom") return Math.PI / 2;
        if (side === "left") return Math.PI;
        return 0;
      }

      /**
       * Convert bend point grid coordinates to pixel coordinates
       * Bend points are specified relative to either source or target node
       * The x,y values are GRID offsets (not pixels)
       */
      function bendPointToPixel(bendPoint, fromNode, toNode) {
        var refNode = bendPoint.relativeTo === "target" ? toNode : fromNode;
        // Use node center as reference point
        var refX = refNode.x + nodeWidth / 2;
        var refY = refNode.y + nodeHeight / 2;
        
        // Scale bend point offsets - they're in grid units but smaller scale
        // Typically x=1 means "offset by about half a node width"
        var scaleFactor = 50; // Smaller scale for bend point offsets
        
        return {
          x: refX + (bendPoint.x * scaleFactor),
          y: refY + (bendPoint.y * scaleFactor)
        };
      }

      /**
       * Check if a point is inside a node's bounding box (with padding)
       */
      function isPointInsideNode(px, py, node, padding) {
        padding = padding || 10;
        return px >= node.x - padding && 
               px <= node.x + nodeWidth + padding &&
               py >= node.y - padding && 
               py <= node.y + nodeHeight + padding;
      }

      /**
       * Check if a line segment intersects with a node's bounding box
       */
      function lineIntersectsNode(x1, y1, x2, y2, node, padding) {
        padding = padding || 10;
        var left = node.x - padding;
        var right = node.x + nodeWidth + padding;
        var top = node.y - padding;
        var bottom = node.y + nodeHeight + padding;
        
        // Check if line is completely outside the box
        if ((x1 < left && x2 < left) || (x1 > right && x2 > right)) return false;
        if ((y1 < top && y2 < top) || (y1 > bottom && y2 > bottom)) return false;
        
        // Check if either endpoint is inside
        if (isPointInsideNode(x1, y1, node, padding) || isPointInsideNode(x2, y2, node, padding)) return true;
        
        // Check line intersection with each side
        var minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
        var minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
        
        // Horizontal line
        if (Math.abs(y2 - y1) < 1) {
          return y1 >= top && y1 <= bottom && minX <= right && maxX >= left;
        }
        // Vertical line
        if (Math.abs(x2 - x1) < 1) {
          return x1 >= left && x1 <= right && minY <= bottom && maxY >= top;
        }
        
        // Diagonal line - check intersection with box sides
        var m = (y2 - y1) / (x2 - x1);
        var b = y1 - m * x1;
        
        // Check left and right edges
        var yAtLeft = m * left + b;
        var yAtRight = m * right + b;
        if ((yAtLeft >= top && yAtLeft <= bottom && left >= minX && left <= maxX) ||
            (yAtRight >= top && yAtRight <= bottom && right >= minX && right <= maxX)) return true;
        
        // Check top and bottom edges
        var xAtTop = (top - b) / m;
        var xAtBottom = (bottom - b) / m;
        if ((xAtTop >= left && xAtTop <= right && top >= minY && top <= maxY) ||
            (xAtBottom >= left && xAtBottom <= right && bottom >= minY && bottom <= maxY)) return true;
        
        return false;
      }

      /**
       * Get all nodes that an edge path might intersect with (excluding source and target)
       */
      function getBlockingNodes(fromNode, toNode, allNodes) {
        var blocking = [];
        for (var id in allNodes) {
          if (id === fromNode.id || id === toNode.id) continue;
          blocking.push(allNodes[id]);
        }
        return blocking;
      }

      /**
       * Find the clearance needed to route around blocking nodes
       */
      function findClearance(start, end, blockingNodes, direction, side) {
        var clearance = 0;
        var padding = 20;
        
        for (var i = 0; i < blockingNodes.length; i++) {
          var node = blockingNodes[i];
          
          if (direction === "horizontal") {
            // Check if node is in the horizontal path
            var minY = Math.min(start.y, end.y) - padding;
            var maxY = Math.max(start.y, end.y) + padding;
            var nodeTop = node.y - padding;
            var nodeBottom = node.y + nodeHeight + padding;
            
            if (!(nodeBottom < minY || nodeTop > maxY)) {
              // Node is in vertical range, check horizontal overlap
              if (side === "right") {
                var nodeRight = node.x + nodeWidth + padding;
                if (nodeRight > clearance && nodeRight > start.x) {
                  clearance = nodeRight;
                }
              } else {
                var nodeLeft = node.x - padding;
                if (clearance === 0 || nodeLeft < clearance) {
                  if (nodeLeft < start.x) {
                    clearance = nodeLeft;
                  }
                }
              }
            }
          } else {
            // Vertical direction
            var minX = Math.min(start.x, end.x) - padding;
            var maxX = Math.max(start.x, end.x) + padding;
            var nodeLeft = node.x - padding;
            var nodeRight = node.x + nodeWidth + padding;
            
            if (!(nodeRight < minX || nodeLeft > maxX)) {
              // Node is in horizontal range, check vertical overlap
              if (side === "bottom") {
                var nodeBottom = node.y + nodeHeight + padding;
                if (nodeBottom > clearance && nodeBottom > start.y) {
                  clearance = nodeBottom;
                }
              } else {
                var nodeTop = node.y - padding;
                if (clearance === 0 || nodeTop < clearance) {
                  if (nodeTop < start.y) {
                    clearance = nodeTop;
                  }
                }
              }
            }
          }
        }
        
        return clearance;
      }

      /**
       * Build path through waypoints with node avoidance
       * Creates orthogonal (right-angle) paths connecting start → waypoints → end
       * Routes around other nodes to prevent overlapping
       */
      function buildOrthogonalPath(start, end, bendPoints, fromNode, toNode, outSide, inSide, startOffset, endOffset, blockingNodes, edgeIndex) {
        edgeIndex = edgeIndex || 0;
        var points = [start.x, start.y];
        
        // Debug: log all edge routing
        console.log("buildOrthogonalPath:", fromNode.id, "→", toNode.id, "outSide:", outSide, "inSide:", inSide, "hasBendPoints:", !!(bendPoints && bendPoints.length));
        
        // Use offsets for routing to prevent overlap
        startOffset = startOffset || 0;
        endOffset = endOffset || 0;
        blockingNodes = blockingNodes || [];
        
        var padding = 25; // Clearance around nodes
        
        if (bendPoints && bendPoints.length > 0) {
          console.log("  Using BEND POINTS path");
          // Convert bend points to waypoints
          var waypoints = [];
          for (var i = 0; i < bendPoints.length; i++) {
            waypoints.push(bendPointToPixel(bendPoints[i], fromNode, toNode));
          }
          
          // Build path through waypoints with orthogonal segments
          var currentX = start.x;
          var currentY = start.y;
          
          // Determine initial direction based on exit side
          var goHorizontalFirst = (outSide === "right" || outSide === "left");
          
          for (var i = 0; i < waypoints.length; i++) {
            var wp = waypoints[i];
            var dx = wp.x - currentX;
            var dy = wp.y - currentY;
            
            // Skip if waypoint is very close to current position
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
              continue;
            }
            
            // Create orthogonal path to this waypoint
            if (goHorizontalFirst) {
              // Go horizontal first, then vertical
              if (Math.abs(dx) > 5) {
                currentX = wp.x;
                points.push(currentX, currentY);
              }
              if (Math.abs(dy) > 5) {
                currentY = wp.y;
                points.push(currentX, currentY);
              }
            } else {
              // Go vertical first, then horizontal
              if (Math.abs(dy) > 5) {
                currentY = wp.y;
                points.push(currentX, currentY);
              }
              if (Math.abs(dx) > 5) {
                currentX = wp.x;
                points.push(currentX, currentY);
              }
            }
            
            // Alternate direction for next segment
            goHorizontalFirst = !goHorizontalFirst;
          }
          
          // Final segment to end point
          var finalDx = end.x - currentX;
          var finalDy = end.y - currentY;
          
          if (Math.abs(finalDx) > 5 && Math.abs(finalDy) > 5) {
            // Need one more turn
            if (inSide === "top" || inSide === "bottom") {
              // Enter vertically - go horizontal first
              points.push(end.x, currentY);
            } else {
              // Enter horizontally - go vertical first
              points.push(currentX, end.y);
            }
          }
        } else {
          // No bend points - use smart routing based on sides with node avoidance
          var dx = end.x - start.x;
          var dy = end.y - start.y;
          
          if (outSide === "bottom" && inSide === "top") {
            // Standard downward flow
            if (Math.abs(dx) > 5) {
              // Check if direct path would cross any nodes
              var midY = (start.y + end.y) / 2;
              var needsDetour = false;
              
              for (var i = 0; i < blockingNodes.length; i++) {
                var bn = blockingNodes[i];
                // Check if node is between start and end vertically
                if (bn.y + nodeHeight > start.y && bn.y < end.y) {
                  // Check if our horizontal path would cross this node
                  var minX = Math.min(start.x, end.x) - padding;
                  var maxX = Math.max(start.x, end.x) + padding;
                  if (bn.x < maxX && bn.x + nodeWidth > minX) {
                    needsDetour = true;
                    break;
                  }
                }
              }
              
              if (needsDetour) {
                // Route around - go further right or left
                var routeX = dx > 0 ? 
                  Math.max(start.x, end.x) + nodeWidth / 2 + padding :
                  Math.min(start.x, end.x) - nodeWidth / 2 - padding;
                points.push(start.x, start.y + padding);
                points.push(routeX, start.y + padding);
                points.push(routeX, end.y - padding);
                points.push(end.x, end.y - padding);
              } else {
                var routeX = start.x + startOffset;
                points.push(routeX, midY);
                points.push(end.x + endOffset, midY);
              }
            }
          } else if (outSide === "right" && inSide === "top") {
            // Exiting right, entering top - need to go around nodes below
            var routeX = start.x + nodeWidth / 2 + padding;
            
            // Find how far right we need to go to clear blocking nodes
            for (var i = 0; i < blockingNodes.length; i++) {
              var bn = blockingNodes[i];
              // Check if node is between source exit and target entry
              if (bn.y >= start.y - padding && bn.y <= end.y + padding) {
                var nodeRight = bn.x + nodeWidth + padding;
                if (nodeRight > routeX && bn.x < end.x + nodeWidth) {
                  routeX = nodeRight;
                }
              }
            }
            
            routeX = Math.max(routeX, start.x + padding);
            points.push(routeX, start.y);
            points.push(routeX, end.y - padding);
            points.push(end.x, end.y - padding);
          } else if (outSide === "right" && inSide === "right") {
            // Exiting right, entering right - loop around to the right side
            // Start to the right of both source and target, then go down/up to target
            var routeX = Math.max(start.x, end.x) + padding;
            
            // For join nodes (circles), end.x is already at the circle edge
            // For regular nodes, we need to go past the right edge
            if (toNode.type !== "join") {
              routeX = Math.max(routeX, end.x + padding);
            }
            
            // Find clearance - ensure we go far enough right to clear all blocking nodes
            for (var i = 0; i < blockingNodes.length; i++) {
              var bn = blockingNodes[i];
              var minY = Math.min(start.y, end.y) - padding;
              var maxY = Math.max(start.y, end.y) + padding;
              if (bn.y + nodeHeight > minY && bn.y < maxY) {
                var nodeRight = bn.x + nodeWidth + padding;
                if (nodeRight > routeX) {
                  routeX = nodeRight;
                }
              }
            }
            
            points.push(routeX, start.y);
            points.push(routeX, end.y);
          } else if (outSide === "left" && inSide === "top") {
            // Decision NO going to node below
            var routeX = start.x - nodeWidth / 2 - padding;
            
            // Find how far left we need to go to clear blocking nodes
            for (var i = 0; i < blockingNodes.length; i++) {
              var bn = blockingNodes[i];
              if (bn.y >= start.y - padding && bn.y <= end.y + padding) {
                var nodeLeft = bn.x - padding;
                if (nodeLeft < routeX && bn.x + nodeWidth > end.x - nodeWidth) {
                  routeX = nodeLeft;
                }
              }
            }
            
            routeX = Math.min(routeX, start.x - padding);
            points.push(routeX, start.y);
            points.push(routeX, end.y - padding);
            points.push(end.x, end.y - padding);
          } else if (outSide === "left" && inSide === "left") {
            // Exiting left, entering left
            var routeX = Math.min(start.x, end.x) - nodeWidth / 2 - padding;
            
            for (var i = 0; i < blockingNodes.length; i++) {
              var bn = blockingNodes[i];
              var minY = Math.min(start.y, end.y) - padding;
              var maxY = Math.max(start.y, end.y) + padding;
              if (bn.y + nodeHeight > minY && bn.y < maxY) {
                var nodeLeft = bn.x - padding;
                if (nodeLeft < routeX) {
                  routeX = nodeLeft;
                }
              }
            }
            
            points.push(routeX, start.y);
            points.push(routeX, end.y);
          } else if (outSide === "right" && inSide === "left") {
            // Horizontal connection right to left
            if (Math.abs(dy) > 10) {
              var midX = (start.x + end.x) / 2;
              
              // Check for blocking nodes
              var needsDetour = false;
              for (var i = 0; i < blockingNodes.length; i++) {
                var bn = blockingNodes[i];
                var minY = Math.min(start.y, end.y) - padding;
                var maxY = Math.max(start.y, end.y) + padding;
                if (bn.y + nodeHeight > minY && bn.y < maxY) {
                  if (bn.x < midX + padding && bn.x + nodeWidth > midX - padding) {
                    needsDetour = true;
                    break;
                  }
                }
              }
              
              if (needsDetour) {
                // Route above or below blocking nodes
                var routeY = dy > 0 ? 
                  Math.min(start.y, end.y) - padding :
                  Math.max(start.y, end.y) + nodeHeight + padding;
                points.push(start.x + padding, start.y);
                points.push(start.x + padding, routeY);
                points.push(end.x - padding, routeY);
                points.push(end.x - padding, end.y);
              } else {
                var routeY = start.y + startOffset;
                points.push(midX, routeY);
                points.push(midX, end.y + endOffset);
              }
            }
            // For nearly horizontal (dy close to 0), just draw straight line - no intermediate points needed
          } else if (outSide === "left" && inSide === "right") {
            if (Math.abs(dy) > 10) {
              var midX = (start.x + end.x) / 2;
              var routeY = start.y + startOffset;
              points.push(midX, routeY);
              points.push(midX, end.y + endOffset);
            }
          } else if (outSide === "bottom" && inSide === "left") {
            // Go down then right
            var routeX = start.x + startOffset;
            var routeY = end.y;
            
            // Check if we need to route around nodes
            for (var i = 0; i < blockingNodes.length; i++) {
              var bn = blockingNodes[i];
              if (bn.y > start.y && bn.y < end.y + nodeHeight) {
                if (bn.x < start.x + padding && bn.x + nodeWidth > start.x - padding) {
                  routeX = bn.x - padding;
                }
              }
            }
            
            points.push(routeX, routeY);
          } else if (outSide === "bottom" && inSide === "right") {
            // Go down then curve to enter from right
            // Need to route around any blocking nodes
            
            console.log("BOTTOM->RIGHT routing debug:");
            console.log("  start:", start.x, start.y, "end:", end.x, end.y);
            console.log("  fromNode:", fromNode.id, "toNode:", toNode.id);
            console.log("  blockingNodes count:", blockingNodes.length);
            
            // Start with minimum route X - right side of target plus padding
            var routeX = end.x + nodeWidth + padding;
            
            // Check if there's a node directly below us that we'd hit going straight down
            var nodeDirectlyBelow = false;
            for (var i = 0; i < blockingNodes.length; i++) {
              var bn = blockingNodes[i];
              console.log("  Checking node:", bn.id, "x:", bn.x, "y:", bn.y, "w:", nodeWidth, "h:", nodeHeight);
              console.log("    bn.y > start.y:", bn.y, ">", start.y, "=", bn.y > start.y);
              console.log("    bn.y < end.y + nodeHeight:", bn.y, "<", end.y + nodeHeight, "=", bn.y < end.y + nodeHeight);
              // Node is below our start point and above or at target level
              if (bn.y > start.y && bn.y < end.y + nodeHeight) {
                // Check if going straight down from our bottom center would hit this node
                // Use wider detection - node overlaps with our x position at all
                console.log("    In vertical range. Checking horizontal:");
                console.log("    start.x >= bn.x - padding:", start.x, ">=", bn.x - padding, "=", start.x >= bn.x - padding);
                console.log("    start.x <= bn.x + nodeWidth + padding:", start.x, "<=", bn.x + nodeWidth + padding, "=", start.x <= bn.x + nodeWidth + padding);
                if (start.x >= bn.x - padding && start.x <= bn.x + nodeWidth + padding) {
                  nodeDirectlyBelow = true;
                  console.log("    NODE DIRECTLY BELOW DETECTED:", bn.id);
                  // We need to go right of this node
                  routeX = Math.max(routeX, bn.x + nodeWidth + padding);
                }
              }
            }
            
            console.log("  nodeDirectlyBelow:", nodeDirectlyBelow, "routeX:", routeX);
            
            // Also find max right extent of any node we'd need to clear
            for (var i = 0; i < blockingNodes.length; i++) {
              var bn = blockingNodes[i];
              // Check if node is in our path (between start and target vertically)
              if (bn.y + nodeHeight > start.y && bn.y < end.y + nodeHeight) {
                var nodeRight = bn.x + nodeWidth + padding;
                // If this node's right edge would block our vertical path
                if (bn.x <= routeX && nodeRight > end.x) {
                  routeX = Math.max(routeX, nodeRight);
                }
              }
            }
            
            // Add extra spacing for parallel lines (multiple edges to same target)
            routeX = routeX + (edgeIndex * 15);
            
            console.log("  Final routeX:", routeX, "edgeIndex:", edgeIndex);
            
            if (nodeDirectlyBelow) {
              // Need to go right first to avoid node below
              // Path: right, then down, then to target
              var clearanceX = routeX;
              console.log("  Routing: right first to", clearanceX, "then down to", end.y);
              points.push(clearanceX, start.y);  // Go right from bottom of source
              points.push(clearanceX, end.y);    // Go down to target Y
            } else {
              // Can go down first, then right
              // Path: go down a bit, then right to clear nodes, then down to target Y
              var initialDropY = start.y + padding;
              console.log("  Routing: down first to", initialDropY, "then right to", routeX);
              points.push(start.x, initialDropY);
              points.push(routeX, initialDropY);
              points.push(routeX, end.y);
            }
          } else if (outSide === "top" && inSide === "bottom") {
            // Going upward
            if (Math.abs(dx) > 5) {
              var midY = (start.y + end.y) / 2;
              var routeX = start.x + startOffset;
              points.push(routeX, midY);
              points.push(end.x + endOffset, midY);
            }
          } else if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            // Default: L-shape based on exit direction
            if (outSide === "right" || outSide === "left") {
              points.push(end.x, start.y);
            } else {
              points.push(start.x, end.y);
            }
          }
        }
        
        points.push(end.x, end.y);
        return points;
      }

      /**
       * Determine the best side for connection based on relative position
       * Used when no explicit connector is specified
       */
      function determineBestSide(fromNode, toNode, isSource) {
        var fromCx = fromNode.x + nodeWidth / 2;
        var fromCy = fromNode.y + nodeHeight / 2;
        var toCx = toNode.x + nodeWidth / 2;
        var toCy = toNode.y + nodeHeight / 2;
        
        var dx = toCx - fromCx;
        var dy = toCy - fromCy;
        var absDx = Math.abs(dx);
        var absDy = Math.abs(dy);
        
        if (isSource) {
          // Determine which side to EXIT from
          // Prefer the side closest to the target
          if (absDx > absDy * 1.5) {
            // Predominantly horizontal
            return dx > 0 ? "right" : "left";
          } else if (absDy > absDx * 1.5) {
            // Predominantly vertical
            return dy > 0 ? "bottom" : "top";
          } else {
            // Diagonal - prefer vertical exit for cleaner routing
            return dy > 0 ? "bottom" : "top";
          }
        } else {
          // Determine which side to ENTER from
          // Enter from the side closest to where the connection is coming from
          if (absDx > absDy * 1.5) {
            // Coming from side
            return dx > 0 ? "left" : "right";
          } else if (absDy > absDx * 1.5) {
            // Coming from above/below
            return dy > 0 ? "top" : "bottom";
          } else {
            // Diagonal - prefer entering from the side the connection comes from
            if (absDx > absDy) {
              return dx > 0 ? "left" : "right";
            } else {
              return dy > 0 ? "top" : "bottom";
            }
          }
        }
      }

      function determineSides(edge, fromNode, toNode, allNodes) {
        var label = edge.label;
        var isError = isErrorEdge(label);
        var dx = (toNode.x + nodeWidth / 2) - (fromNode.x + nodeWidth / 2);
        var dy = (toNode.y + nodeHeight / 2) - (fromNode.y + nodeHeight / 2);

        // Check if edge has connector info from XML - this takes priority
        var sourceConn = (edge.sourceConnector || "").toLowerCase();
        var targetConn = (edge.targetConnector || "").toLowerCase();
        
        // Default sides
        var outSide = "bottom";
        var inSide = "top";
        
        // Handle numbered target connectors - use string ops instead of regex for reliability
        var inConnNum = -1;
        if (targetConn.indexOf("in") === 0 && targetConn.length > 2) {
          var numPart = targetConn.substring(2);
          var parsed = parseInt(numPart, 10);
          if (!isNaN(parsed)) {
            inConnNum = parsed;
          }
        }
        
        // Check if there's a blocking node between source and target (for same-column routing)
        function hasBlockingNodeBetween() {
          var minY = Math.min(fromNode.y + nodeHeight, toNode.y);
          var maxY = Math.max(fromNode.y + nodeHeight, toNode.y);
          var checkX = fromNode.x + nodeWidth / 2;
          
          for (var id in allNodes) {
            if (id === fromNode.id || id === toNode.id) continue;
            var bn = allNodes[id];
            // Node is between source and target vertically
            if (bn.y + nodeHeight > minY && bn.y < maxY) {
              // Node overlaps horizontally with the straight-down path
              if (checkX >= bn.x && checkX <= bn.x + nodeWidth) {
                console.log("  BLOCKING NODE DETECTED:", bn.id, "between", fromNode.id, "and", toNode.id);
                return true;
              }
            }
          }
          return false;
        }
        
        // Debug logging - comprehensive
        console.log("DETERMINE_SIDES:", fromNode.id, "→", toNode.id);
        console.log("  sourceConn:", sourceConn, "targetConn:", targetConn);
        console.log("  dx:", dx, "dy:", dy);
        console.log("  fromNode pos:", fromNode.x, fromNode.y, "toNode pos:", toNode.x, toNode.y);
        
        // Target connector determines entry side - RESPECT XML if specified
        if (targetConn === "in" || targetConn === "in1" || targetConn === "in2") {
          // Standard input connectors - default to top, but use side entry for horizontal adjacency
          var absDxLocal = Math.abs(dx);
          var absDyLocal = Math.abs(dy);
          if (absDyLocal < nodeHeight * 0.5 && absDxLocal > nodeWidth * 0.5) {
            // Horizontally adjacent - enter from the side facing the source
            inSide = dx > 0 ? "left" : "right";
            // Also set outSide to match the direction
            outSide = dx > 0 ? "right" : "left";
            console.log("  IN connector with horizontal adjacency - outSide:", outSide, "inSide:", inSide);
          } else if (toNode.type === "join" && dx > nodeWidth * 0.3) {
            // Join node is to the right (even if not strictly horizontal) - route right to left
            outSide = "right";
            inSide = "left";
            console.log("  IN to Join on right - exit right, enter left");
          } else {
            inSide = "top";
            
            // For in1 connections to Join nodes that are to the right, exit from right side
            // This prevents overlap with the main downward flow (which exits from bottom)
            if ((targetConn === "in1" || targetConn === "in") && toNode.type === "join" && dx > nodeWidth * 0.3) {
              // Target Join is to the right - exit from right side, enter from top
              outSide = "right";
              // inSide stays "top" - we go right then down to top of Join
              console.log("  IN1 to Join on right - exit right, enter top");
            }
          }
        } else if (inConnNum >= 3) {
          // in3, in4, etc. - determine best entry side based on where connection comes from
          // Also check for blocking nodes that would require routing around
          console.log("  ENTERING in3+ block, inConnNum:", inConnNum);
          
          // First check if there's a blocking node - if so, always go around
          var hasBlocker = hasBlockingNodeBetween();
          
          if (dx < -nodeWidth * 0.3) {
            // Source is to the right of target - enter from right
            inSide = "right";
            console.log("  Setting inSide = right (dx < threshold)");
          } else if (dx > nodeWidth * 0.3) {
            // Source is to the left of target - enter from left  
            inSide = "left";
            console.log("  Setting inSide = left (dx > threshold)");
          } else if (hasBlocker) {
            // Same column but blocking node in between - route around from the right
            // (prefer right side as it's typically less cluttered)
            inSide = "right";
            console.log("  Setting inSide = right (blocking node detected)");
          } else if (dy < 0) {
            // Source is above - enter from top
            inSide = "top";
          } else {
            // Source is below - enter from bottom
            inSide = "bottom";
          }
        } else if (targetConn === "loop") {
          inSide = "top";
        } else if (targetConn === "left") {
          inSide = "left";
        } else if (targetConn === "right") {
          inSide = "right";
        } else if (targetConn === "top") {
          inSide = "top";
        } else if (targetConn === "bottom") {
          inSide = "bottom";
        }
        
        // Source connector determines exit side
        // Decision branches ALWAYS exit from their designated side for visual clarity
        if (sourceConn === "error" || sourceConn === "pipelet_error" || isError) {
          outSide = "right";
        } else if (sourceConn === "yes" || sourceConn === "true") {
          outSide = "right";  // YES always exits right
        } else if (sourceConn === "no" || sourceConn === "false") {
          outSide = "left";   // NO always exits left
        } else if (!sourceConn && !targetConn) {
          // NEITHER source nor target connector specified - choose optimal sides based on spatial relationship
          var absDx = Math.abs(dx);
          var absDy = Math.abs(dy);
          
          if (absDy > absDx * 1.5) {
            // Primarily vertical relationship
            if (dy > 0) {
              outSide = "bottom";
              inSide = "top";
            } else {
              outSide = "top";
              inSide = "bottom";
            }
          } else if (absDx > absDy * 1.5) {
            // Primarily horizontal relationship - use horizontal routing
            if (dx > 0) {
              outSide = "right";
              inSide = "left";
            } else {
              outSide = "left";
              inSide = "right";
            }
          } else {
            // Diagonal - prefer vertical-first routing (exit bottom/top, enter from side)
            if (dy > 0) {
              outSide = "bottom";
              if (dx > 0) {
                inSide = "left";
              } else {
                inSide = "right";
              }
            } else {
              outSide = "top";
              if (dx > 0) {
                inSide = "left";
              } else {
                inSide = "right";
              }
            }
          }
          console.log("  NO CONNECTORS - choosing optimal: outSide:", outSide, "inSide:", inSide, "absDx:", absDx, "absDy:", absDy);
        } else if (!sourceConn) {
          // No source connector specified
          // If target has a specific inSide, choose outSide that routes cleanly to it
          // BUT only if outSide wasn't already set by target connector logic
          if (outSide) {
            console.log("  outSide already set to:", outSide, "- keeping it");
          } else if (inSide === "top") {
            // Target enters from top - prefer exiting bottom for clean vertical flow
            outSide = "bottom";
          } else if (inSide === "right") {
            // Target enters from right - we need to approach from the right side
            // Check if there's a blocking node directly below that we need to route around
            var hasBlocker = hasBlockingNodeBetween();
            if (hasBlocker) {
              // Blocking node below - exit right to go around it
              outSide = "right";
              console.log("  BLOCKING detected: exiting RIGHT instead of BOTTOM");
            } else if (dx < 0 && dy > nodeHeight) {
              // Source is to the right AND target is significantly below - exit bottom
              outSide = "bottom";
            } else if (dx < 0) {
              // Source is to the right but target is roughly same level or above - exit right
              outSide = "right";
            } else {
              // Source is to the left of target - exit right and go around to approach from right
              outSide = "right";
            }
          } else if (inSide === "left") {
            // Target enters from left - we need to approach from the left side
            // If source is above and to the left, exit bottom (cleaner vertical-first path)
            // If source is below and to the left, exit left to loop around
            if (dx > 0 && dy > nodeHeight) {
              // Source is to the left AND target is significantly below - exit bottom
              outSide = "bottom";
            } else if (dx > 0) {
              // Source is to the left but target is roughly same level or above - exit left
              outSide = "left";
            } else {
              // Source is to the right of target - exit bottom then go left
              outSide = "bottom";
            }
          } else if (inSide === "bottom") {
            outSide = "top";
          } else {
            // Fallback to best side determination
            outSide = determineBestSide(fromNode, toNode, true);
          }
        }
        
        // If no target connector was specified, determine entry based on exit side
        if (!targetConn && inConnNum < 0) {
          if (outSide === "right") {
            // Exiting right
            if (dx > nodeWidth * 0.5) {
              inSide = "left";  // Target to right - enter from left
            } else if (dy > nodeHeight * 0.5) {
              inSide = "top";   // Target below - enter from top
            } else if (dy < -nodeHeight * 0.5) {
              inSide = "bottom"; // Target above - enter from bottom
            } else {
              inSide = "left";
            }
          } else if (outSide === "left") {
            // Exiting left
            if (dx < -nodeWidth * 0.5) {
              inSide = "right"; // Target to left - enter from right
            } else if (dy > nodeHeight * 0.5) {
              inSide = "top";   // Target below - enter from top
            } else if (dy < -nodeHeight * 0.5) {
              inSide = "bottom"; // Target above - enter from bottom
            } else {
              inSide = "right";
            }
          } else if (outSide === "bottom") {
            // Exiting bottom - prefer entering from top for vertical flow
            inSide = "top";
          } else if (outSide === "top") {
            // Exiting top
            inSide = "bottom";
          }
        }
        
        // Handle back edges (target above source)
        if (dy < -nodeHeight && !targetConn && !sourceConn) {
          if (outSide === "bottom") outSide = "top";
          if (inSide === "top") inSide = "bottom";
        }

        // Debug logging for in3 connections
        if (targetConn === "in3") {
          console.log("  RESULT: outSide:", outSide, "inSide:", inSide);
        }

        console.log("  RESULT: outSide:", outSide, "inSide:", inSide);
        return { outSide: outSide, inSide: inSide };
      }

      // First pass: plan routes and count per-side exits/entries so we can offset them
      var planned = [];
      var outCounts = {};
      var inCounts = {};

      function incCount(map, key) {
        map[key] = (map[key] || 0) + 1;
      }

      for (var i = 0; i < edges.length; i++) {
        var edge = edges[i];
        var fromNode = nodeMap[edge.from];
        var toNode = nodeMap[edge.to];
        if (!fromNode || !toNode) continue;

        var edgeId = "edge-" + i + "-" + edge.from + "-" + edge.to;
        var sides = determineSides(edge, fromNode, toNode, nodeMap);

        var outKey = edge.from + "|" + sides.outSide;
        var inKey = edge.to + "|" + sides.inSide;
        incCount(outCounts, outKey);
        incCount(inCounts, inKey);

        planned.push({
          i: i,
          edgeId: edgeId,
          edge: edge,
          fromNode: fromNode,
          toNode: toNode,
          outSide: sides.outSide,
          inSide: sides.inSide
        });
      }

      // Second pass: draw
      var outIndex = {};
      var inIndex = {};

      function nextOffset(indexMap, countMap, key) {
        var idx = indexMap[key] || 0;
        indexMap[key] = idx + 1;
        var total = countMap[key] || 1;
        return { offset: (idx - (total - 1) / 2) * EDGE_SPACING, index: idx };
      }

      for (var p = 0; p < planned.length; p++) {
        var plan = planned[p];
        var edge = plan.edge;
        var fromNode = plan.fromNode;
        var toNode = plan.toNode;

        // Get color based on edge label
        var edgeColor = getEdgeColor(edge.label);
        var isBackEdge = isLoopBackEdge(edge.label);
        var isError = isErrorEdge(edge.label);

        // Offsets distribute multiple edges leaving/entering the same side
        var outKey = edge.from + "|" + plan.outSide;
        var inKey = edge.to + "|" + plan.inSide;
        var outResult = nextOffset(outIndex, outCounts, outKey);
        var inResult = nextOffset(inIndex, inCounts, inKey);
        var outOffset = outResult.offset;
        var inOffset = inResult.offset;
        var edgeToTargetIndex = inResult.index;

        var start = getAnchor(fromNode, plan.outSide, (plan.outSide === "top" || plan.outSide === "bottom") ? outOffset : outOffset);
        var end = getAnchor(toNode, plan.inSide, (plan.inSide === "top" || plan.inSide === "bottom") ? inOffset : inOffset);

        // Check if edge has bend points from XML
        var bendPoints = (edge.display && edge.display.bendPoints) ? edge.display.bendPoints : null;
        var hasBendPoints = bendPoints && bendPoints.length > 0;

        // Get blocking nodes for this edge (all nodes except source and target)
        var blockingNodes = getBlockingNodes(fromNode, toNode, nodeMap);

        // Calculate the optimal route distance
        var dx = (toNode.x + nodeWidth / 2) - (fromNode.x + nodeWidth / 2);
        var dy = (toNode.y + nodeHeight / 2) - (fromNode.y + nodeHeight / 2);
        var absDx = Math.abs(dx);
        var absDy = Math.abs(dy);

        // Check if XML bend points should be ignored in favor of smart routing
        if (hasBendPoints) {
          // Case 1: blocking node in the path
          if (blockingNodes.length > 0) {
            var minY = Math.min(fromNode.y, toNode.y);
            var maxY = Math.max(fromNode.y, toNode.y) + nodeHeight;
            var minX = Math.min(fromNode.x, toNode.x);
            var maxX = Math.max(fromNode.x, toNode.x) + nodeWidth;
            
            for (var bi = 0; bi < blockingNodes.length; bi++) {
              var bn = blockingNodes[bi];
              var bnTop = bn.y;
              var bnBottom = bn.y + nodeHeight;
              var bnLeft = bn.x;
              var bnRight = bn.x + nodeWidth;
              
              var verticalOverlap = bnBottom > minY && bnTop < maxY;
              var horizontalOverlap = bnRight > minX && bnLeft < maxX;
              
              if (verticalOverlap && horizontalOverlap) {
                console.log("IGNORING XML BEND POINTS - blocking node " + bn.id + " is in path");
                hasBendPoints = false;
                break;
              }
            }
          }
          
          // Case 2: nodes are horizontally adjacent (same Y, different X) - use direct horizontal route
          // The XML bend points may specify a long detour that we want to avoid
          if (hasBendPoints && absDy < nodeHeight * 0.5 && absDx > nodeWidth * 0.5) {
            // Primarily horizontal relationship - a direct right→left or left→right is optimal
            console.log("IGNORING XML BEND POINTS - horizontal adjacency, direct route is better. absDx:", absDx, "absDy:", absDy);
            hasBendPoints = false;
          }
          
          // Debug: log when we're keeping bend points for horizontal/similar-level nodes
          if (hasBendPoints && absDy < nodeHeight) {
            console.log("KEEPING BEND POINTS for edge:", fromNode.id, "→", toNode.id, "absDx:", absDx, "absDy:", absDy, "outSide:", plan.outSide, "inSide:", plan.inSide);
          }
        }

        // Backward edges (or target above) keep the existing left-loop curve
        var isGoingUp = end.y < start.y - 5;
        
        // Check if this is a primarily horizontal edge (should use straight path, not loop curve)
        var isPrimarilyHorizontal = (plan.outSide === "right" && plan.inSide === "left") || 
                                    (plan.outSide === "left" && plan.inSide === "right");
        
        console.log("EDGE ROUTING:", fromNode.id, "→", toNode.id, "start:", start.x, start.y, "end:", end.x, end.y, "isBackEdge:", isBackEdge, "isGoingUp:", isGoingUp, "isPrimarilyHorizontal:", isPrimarilyHorizontal, "hasBendPoints:", hasBendPoints);

        var points;
        var arrowAngle;

        if (isBackEdge || (isGoingUp && !hasBendPoints && !isPrimarilyHorizontal)) {
          // Use bottom->top anchors for loops to look like the legacy editor
          var x1 = fromNode.x + nodeWidth / 2;
          var y1 = fromNode.y + nodeHeight;
          var x2 = toNode.x + nodeWidth / 2;
          var y2 = toNode.y;

          var loopOffset = 50;
          var leftX = Math.min(fromNode.x, toNode.x) - loopOffset;
          
          // Check for blocking nodes to the left and adjust loop offset
          for (var bi = 0; bi < blockingNodes.length; bi++) {
            var bn = blockingNodes[bi];
            var bnRight = bn.x + nodeWidth + 20;
            if (bn.y + nodeHeight > Math.min(y1, y2) && bn.y < Math.max(y1, y2)) {
              if (bn.x < leftX + loopOffset && bnRight > leftX) {
                leftX = bn.x - 30;
              }
            }
          }
          
          points = [];
          var steps = 30;

          for (var t = 0; t <= 1; t += 1/steps) {
            var px, py;
            if (t < 0.33) {
              var lt = t * 3;
              px = (1-lt)*(1-lt)*x1 + 2*(1-lt)*lt*x1 + lt*lt*leftX;
              py = (1-lt)*(1-lt)*y1 + 2*(1-lt)*lt*(y1 + 30) + lt*lt*((y1+y2)/2);
            } else if (t < 0.66) {
              var lt = (t - 0.33) * 3;
              px = leftX;
              py = (1-lt)*((y1+y2)/2 + 20) + lt*((y1+y2)/2 - 20);
            } else {
              var lt = (t - 0.66) * 3;
              px = (1-lt)*(1-lt)*leftX + 2*(1-lt)*lt*x2 + lt*lt*x2;
              py = (1-lt)*(1-lt)*((y1+y2)/2 - 20) + 2*(1-lt)*lt*(y2-30) + lt*lt*y2;
            }
            points.push(px, py);
          }

          end = { x: x2, y: y2 };
          arrowAngle = -Math.PI / 2;
        } else if (hasBendPoints) {
          // Use XML bend points for routing
          points = buildOrthogonalPath(start, end, bendPoints, fromNode, toNode, plan.outSide, plan.inSide, outOffset, inOffset, blockingNodes, edgeToTargetIndex);
          arrowAngle = getArrowAngleForSide(plan.inSide);
        } else {
          // No bend points - use smart routing with node avoidance
          points = buildOrthogonalPath(start, end, null, fromNode, toNode, plan.outSide, plan.inSide, outOffset, inOffset, blockingNodes, edgeToTargetIndex);
          arrowAngle = getArrowAngleForSide(plan.inSide);
        }

        var edgeId = plan.edgeId;

        // Create a group for the edge
        var edgeGroup = new Konva.Group({
          name: "edge-group"
        });
        edgeGroup.setAttr("edgeData", edge);
        edgeGroups[edgeId] = edgeGroup;

        // Draw invisible hit area (wider for easier clicking)
        var hitLine = new Konva.Line({
          points: points,
          stroke: "transparent",
          strokeWidth: 20,
          lineCap: "round",
          lineJoin: "round",
          hitStrokeWidth: 20
        });
        edgeGroup.add(hitLine);

        // Draw visible line with color based on edge type
        var visibleLine = new Konva.Line({
          name: "edge-line",
          points: points,
          stroke: edgeColor,
          strokeWidth: 2,
          lineCap: "round",
          lineJoin: "round",
          listening: false
        });
        edgeGroup.add(visibleLine);

        // Arrow head at the end point
        var arrowSize = 10;
        var x2a = end.x;
        var y2a = end.y;
        var arrowLine = new Konva.Line({
          name: "edge-arrow",
          points: [
            x2a - arrowSize * Math.cos(arrowAngle - Math.PI / 6),
            y2a - arrowSize * Math.sin(arrowAngle - Math.PI / 6),
            x2a,
            y2a,
            x2a - arrowSize * Math.cos(arrowAngle + Math.PI / 6),
            y2a - arrowSize * Math.sin(arrowAngle + Math.PI / 6)
          ],
          stroke: edgeColor,
          strokeWidth: 2,
          lineCap: "round",
          lineJoin: "round",
          listening: false
        });
        edgeGroup.add(arrowLine);

        // Label placement: use midpoint with slight nudge based on primary direction
        if (edge.label) {
          var labelX = (start.x + end.x) / 2;
          var labelY = (start.y + end.y) / 2;
          if (plan.outSide === "right" || plan.outSide === "left") {
            labelY -= 10;
          } else {
            labelX += 10;
            labelY -= 12;
          }

          var text = new Konva.Text({
            x: labelX,
            y: labelY,
            text: edge.label,
            fontSize: 11,
            fontFamily: "IBM Plex Sans, system-ui, sans-serif",
            fill: edgeColor,
            listening: false
          });
          text.offsetX(text.width() / 2);
          edgeGroup.add(text);
        }

        // Edge hover effects
        (function(currentEdgeId, currentEdge) {
          edgeGroup.on("mouseenter", function() {
            document.body.style.cursor = "pointer";
            if (selectedEdgeId !== currentEdgeId) {
              var group = edgeGroups[currentEdgeId];
              var edgeLine = group.findOne(".edge-line");
              if (edgeLine) {
                edgeLine.strokeWidth(4);
              }
              layer.batchDraw();
            }
          });

          edgeGroup.on("mouseleave", function() {
            document.body.style.cursor = "default";
            if (selectedEdgeId !== currentEdgeId) {
              var group = edgeGroups[currentEdgeId];
              var edgeLine = group.findOne(".edge-line");
              if (edgeLine) {
                edgeLine.strokeWidth(2);
              }
              layer.batchDraw();
            }
          });

          edgeGroup.on("click tap", function(e) {
            e.cancelBubble = true;
            selectEdge(currentEdgeId, currentEdge, layer);
          });
        })(edgeId, edge);

        layer.add(edgeGroup);
      }
    }

    /**
     * Draw a single node
     */
    function drawNode(layer, node) {
      var color = colors[node.type] || colors.unknown;

      var group = new Konva.Group({
        x: node.x,
        y: node.y,
        name: "node-group"
      });

      // Store reference for selection
      nodeGroups[node.id] = group;

      // Special rendering for join nodes - draw as circle like legacy editor
      if (node.type === "join") {
        var circleRadius = 15;
        var circleX = nodeWidth / 2;
        var circleY = nodeHeight / 2;
        
        // Circle background
        var circle = new Konva.Circle({
          x: circleX,
          y: circleY,
          radius: circleRadius,
          fill: "#0d1328",
          stroke: color,
          strokeWidth: 2,
          shadowColor: "#000",
          shadowBlur: 10,
          shadowOpacity: 0.4,
          shadowOffsetY: 3
        });
        group.add(circle);
        
        // Inner highlight
        group.add(new Konva.Circle({
          x: circleX,
          y: circleY - 3,
          radius: circleRadius - 4,
          fill: "rgba(255,255,255,0.05)",
          listening: false
        }));

        // Hover effects for join node
        group.on("mouseenter", function() {
          document.body.style.cursor = "pointer";
          if (selectedNodeId !== node.id) {
            circle.shadowBlur(20);
            circle.shadowOpacity(0.6);
            layer.batchDraw();
          }
        });

        group.on("mouseleave", function() {
          document.body.style.cursor = "default";
          if (selectedNodeId !== node.id) {
            circle.shadowBlur(10);
            circle.shadowOpacity(0.4);
            layer.batchDraw();
          }
        });

        // Click to select
        group.on("click tap", function(e) {
          e.cancelBubble = true;
          clearEdgeSelection(layer);
          selectNode(node, layer);
        });

        layer.add(group);
        return;
      }

      // Standard node rendering for non-join nodes
      // Node background
      var rect = new Konva.Rect({
        width: nodeWidth,
        height: nodeHeight,
        fill: "#0d1328",
        stroke: color,
        strokeWidth: 2,
        cornerRadius: 10,
        shadowColor: "#000",
        shadowBlur: 15,
        shadowOpacity: 0.4,
        shadowOffsetY: 5
      });
      group.add(rect);

      // Inner gradient overlay
      group.add(new Konva.Rect({
        x: 1,
        y: 1,
        width: nodeWidth - 2,
        height: nodeHeight / 2,
        fill: "rgba(255,255,255,0.03)",
        cornerRadius: [9, 9, 0, 0],
        listening: false
      }));

      // Type pill
      var pillText = new Konva.Text({
        text: node.type,
        fontSize: 10,
        fontFamily: "IBM Plex Sans, system-ui, sans-serif",
        fill: "#0b1021",
        padding: 0
      });
      var pillWidth = pillText.width() + 12;
      
      group.add(new Konva.Rect({
        x: 10,
        y: 10,
        width: pillWidth,
        height: 18,
        fill: color,
        cornerRadius: 9
      }));

      pillText.x(10 + 6);
      pillText.y(10 + 4);
      group.add(pillText);

      // Node title
      group.add(new Konva.Text({
        x: 10,
        y: 34,
        width: nodeWidth - 20,
        text: node.label,
        fontSize: 13,
        fontFamily: "IBM Plex Sans, system-ui, sans-serif",
        fontStyle: "bold",
        fill: "#d8e2ff",
        ellipsis: true,
        wrap: "none"
      }));

      // Branch subtitle
      group.add(new Konva.Text({
        x: 10,
        y: 52,
        width: nodeWidth - 20,
        text: node.branch,
        fontSize: 10,
        fontFamily: "IBM Plex Sans, system-ui, sans-serif",
        fill: "#93a4c8",
        ellipsis: true,
        wrap: "none"
      }));

      // Add navigation indicator for jump/call nodes
      if (node.type === "jump" || node.type === "call") {
        // External link icon in bottom right corner
        var iconGroup = new Konva.Group({
          x: nodeWidth - 28,
          y: nodeHeight - 28
        });
        
        iconGroup.add(new Konva.Rect({
          width: 20,
          height: 20,
          fill: "rgba(242, 192, 120, 0.2)",
          cornerRadius: 4
        }));
        
        // Draw external link icon
        iconGroup.add(new Konva.Line({
          points: [5, 15, 15, 5],
          stroke: "#f2c078",
          strokeWidth: 1.5,
          lineCap: "round"
        }));
        iconGroup.add(new Konva.Line({
          points: [9, 5, 15, 5, 15, 11],
          stroke: "#f2c078",
          strokeWidth: 1.5,
          lineCap: "round",
          lineJoin: "round"
        }));
        iconGroup.add(new Konva.Line({
          points: [5, 9, 5, 15, 11, 15],
          stroke: "#f2c078",
          strokeWidth: 1.5,
          lineCap: "round",
          lineJoin: "round"
        }));
        
        group.add(iconGroup);
      }

      // Hover effects
      group.on("mouseenter", function() {
        document.body.style.cursor = "pointer";
        if (selectedNodeId !== node.id) {
          this.findOne("Rect").shadowBlur(25);
          this.findOne("Rect").shadowOpacity(0.6);
          layer.batchDraw();
        }
      });

      group.on("mouseleave", function() {
        document.body.style.cursor = "default";
        if (selectedNodeId !== node.id) {
          this.findOne("Rect").shadowBlur(15);
          this.findOne("Rect").shadowOpacity(0.4);
          layer.batchDraw();
        }
      });

      // Click to select
      group.on("click tap", function(e) {
        e.cancelBubble = true;
        // Clear edge selection when selecting a node
        clearEdgeSelection(layer);
        selectNode(node, layer);
      });

      // Double-click to navigate (for jump and call nodes)
      if (node.type === "jump" || node.type === "call") {
        group.on("dblclick dbltap", function(e) {
          e.cancelBubble = true;
          handleNodeDoubleClick(node);
        });
      }

      layer.add(group);
    }

    /**
     * Draw all nodes
     */
    function drawNodes(layer, placedNodes) {
      for (var i = 0; i < placedNodes.length; i++) {
        drawNode(layer, placedNodes[i]);
      }
    }
  `;
}
