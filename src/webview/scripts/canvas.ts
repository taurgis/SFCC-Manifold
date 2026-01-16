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
     * Viewport culling configuration
     * Used to skip rendering of elements outside visible area
     */
    var CULLING_MARGIN = 200; // Extra margin around viewport for smoother scrolling
    var viewportCullingEnabled = true;

    /**
     * Check if a bounding box is visible in the current viewport
     * @param {Object} bounds - {x, y, width, height} of the element
     * @param {Object} stage - Konva stage
     * @returns {boolean} - true if visible
     */
    function isInViewport(bounds, stage) {
      if (!viewportCullingEnabled) return true;
      
      var scale = stage.scaleX();
      var stagePos = stage.position();
      var container = stage.container();
      var viewWidth = container.clientWidth;
      var viewHeight = container.clientHeight;
      
      // Calculate viewport bounds in stage coordinates
      var vpLeft = (-stagePos.x / scale) - CULLING_MARGIN;
      var vpTop = (-stagePos.y / scale) - CULLING_MARGIN;
      var vpRight = (viewWidth - stagePos.x) / scale + CULLING_MARGIN;
      var vpBottom = (viewHeight - stagePos.y) / scale + CULLING_MARGIN;
      
      // Check if bounds intersect viewport
      return !(bounds.x + bounds.width < vpLeft ||
               bounds.x > vpRight ||
               bounds.y + bounds.height < vpTop ||
               bounds.y > vpBottom);
    }

    /**
     * Check if a node is visible in the viewport
     */
    function isNodeVisible(node, stage) {
      return isInViewport({
        x: node.x,
        y: node.y,
        width: nodeWidth,
        height: nodeHeight
      }, stage);
    }

    /**
     * Check if an edge is visible in the viewport
     * Uses bounding box of edge points
     */
    function isEdgeVisible(points, stage) {
      if (!points || points.length < 4) return true;
      
      var minX = points[0], maxX = points[0];
      var minY = points[1], maxY = points[1];
      
      for (var i = 2; i < points.length; i += 2) {
        if (points[i] < minX) minX = points[i];
        if (points[i] > maxX) maxX = points[i];
        if (points[i + 1] < minY) minY = points[i + 1];
        if (points[i + 1] > maxY) maxY = points[i + 1];
      }
      
      return isInViewport({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      }, stage);
    }

    /**
     * Update visibility of all nodes and edges based on viewport
     * Called on pan/zoom for efficient culling
     */
    function updateViewportCulling(stage, layer) {
      // Update node visibility
      for (var nodeId in nodeGroups) {
        var group = nodeGroups[nodeId];
        if (group) {
          var nodeData = findNodeById(nodeId);
          if (nodeData) {
            var shouldBeVisible = isNodeVisible(nodeData, stage);
            if (group.visible() !== shouldBeVisible) {
              group.visible(shouldBeVisible);
            }
          }
        }
      }
      
      // Update edge visibility
      for (var edgeId in edgeGroups) {
        var group = edgeGroups[edgeId];
        if (group) {
          var edgeLine = group.findOne(".edge-line");
          if (edgeLine) {
            var points = edgeLine.points();
            var shouldBeVisible = isEdgeVisible(points, stage);
            if (group.visible() !== shouldBeVisible) {
              group.visible(shouldBeVisible);
            }
          }
        }
      }
    }

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

      // Main layer for nodes and edges
      var layer = new Konva.Layer({
        // Enable hit graph caching for better performance
        hitGraphEnabled: true
      });
      stage.add(layer);

      // Grid layer with caching for performance
      var gridLayer = new Konva.Layer({
        listening: false,  // Grid doesn't need mouse events
        hitGraphEnabled: false  // Disable hit detection for grid
      });
      stage.add(gridLayer);
      gridLayer.moveToBottom();

      return { stage: stage, layer: layer, gridLayer: gridLayer, containerRect: containerRect };
    }

    /**
     * Draw background grid with optimized caching
     * Uses a single Konva.Shape for the entire grid pattern instead of many Line objects
     */
    function createDrawGrid(stage, gridLayer, getContainerRect) {
      var lastGridState = null;
      
      return function drawGrid() {
        var containerRect = getContainerRect();
        var gridSize = 50;
        var stagePos = stage.position();
        var scale = stage.scaleX();
        
        // Calculate visible grid bounds
        var startX = Math.floor(-stagePos.x / scale / gridSize) * gridSize - gridSize;
        var endX = Math.ceil((containerRect.width - stagePos.x) / scale / gridSize) * gridSize + gridSize;
        var startY = Math.floor(-stagePos.y / scale / gridSize) * gridSize - gridSize;
        var endY = Math.ceil((containerRect.height - stagePos.y) / scale / gridSize) * gridSize + gridSize;
        
        // Create a unique state key to check if we need to redraw
        var newState = startX + "," + endX + "," + startY + "," + endY + "," + scale;
        if (lastGridState === newState) {
          return; // Grid hasn't changed, skip redraw
        }
        lastGridState = newState;

        gridLayer.destroyChildren();
        
        // Use a single Shape with sceneFunc for efficient grid drawing
        var gridShape = new Konva.Shape({
          sceneFunc: function(ctx, shape) {
            ctx.beginPath();
            ctx.strokeStyle = "#1a2340";
            ctx.lineWidth = 1 / scale;
            
            // Draw vertical lines
            for (var x = startX; x <= endX; x += gridSize) {
              ctx.moveTo(x, startY);
              ctx.lineTo(x, endY);
            }
            
            // Draw horizontal lines
            for (var y = startY; y <= endY; y += gridSize) {
              ctx.moveTo(startX, y);
              ctx.lineTo(endX, y);
            }
            
            ctx.stroke();
          },
          listening: false,
          perfectDrawEnabled: false
        });
        
        gridLayer.add(gridShape);
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
        html += '<div class="connection-item" data-node-id="' + escapeAttr(fromNode.id) + '">' +
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
        html += '<div class="connection-item" data-node-id="' + escapeAttr(toNode.id) + '">' +
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
        // Join nodes are small circles centered in the cell
        // All anchors point to/from the center with a small radius offset
        if (node.type === "join") {
          var joinRadius = 10;
          var centerX = node.x + nodeWidth / 2;
          var centerY = node.y + nodeHeight / 2;
          
          if (side === "top") return { x: centerX + offset, y: centerY - joinRadius };
          if (side === "bottom") return { x: centerX + offset, y: centerY + joinRadius };
          if (side === "left") return { x: centerX - joinRadius, y: centerY + offset };
          return { x: centerX + joinRadius, y: centerY + offset }; // right
        }
        
        // Regular nodes
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
       * Build path through waypoints
       * Creates orthogonal (right-angle) paths connecting start → waypoints → end
       * Uses startOffset and endOffset to prevent overlapping parallel lines
       */
      function buildOrthogonalPath(start, end, bendPoints, fromNode, toNode, outSide, inSide, startOffset, endOffset) {
        var points = [start.x, start.y];
        
        // Use offsets for routing to prevent overlap
        startOffset = startOffset || 0;
        endOffset = endOffset || 0;
        
        if (bendPoints && bendPoints.length > 0) {
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
          // No bend points - use smart routing based on sides
          var dx = end.x - start.x;
          var dy = end.y - start.y;
          
          if (outSide === "bottom" && inSide === "top") {
            // Standard downward flow
            if (Math.abs(dx) > 5) {
              // Nodes not aligned - need to route with a horizontal segment
              var midY = (start.y + end.y) / 2;
              points.push(start.x, midY);
              points.push(end.x, midY);
            }
            // If aligned (dx <= 5), just go straight down - no intermediate points needed
          } else if (outSide === "right" && inSide === "top") {
            // Decision YES or error going to node below
            // Go RIGHT first to clear the source node, then DOWN, then LEFT above target, then DOWN to target
            // Use startOffset for lane spacing when multiple edges exit same node
            // Also use relative Y position to offset lanes for edges from different nodes
            var laneSpacing = Math.abs(startOffset) * 7.5;
            var baseClearance = 30;
            // If target is to the left, we need to go even further right to clear
            if (dx < 0) {
              baseClearance = 50;
            }
            // Add additional offset based on vertical distance to prevent overlap
            // Edges going further down get lanes further right
            var distanceOffset = Math.min(Math.abs(dy) / 7, 90);
            var clearanceX = start.x + nodeWidth / 2 + baseClearance + laneSpacing + distanceOffset;
            // Go above the target first, then come straight down to enter from top
            var aboveTargetY = end.y - 20;
            points.push(clearanceX, start.y);
            points.push(clearanceX, aboveTargetY);
            points.push(end.x, aboveTargetY);
          } else if (outSide === "left" && inSide === "top") {
            // Decision NO going to node below
            // Go LEFT first to clear, then DOWN, then RIGHT above target, then DOWN to target
            // Use startOffset for lane spacing when multiple edges exit same node
            var laneSpacing = Math.abs(startOffset) * 7.5;
            var baseClearance = 30;
            // If target is to the right, need to go further left
            if (dx > 0) {
              baseClearance = 50;
            }
            // Add additional offset based on vertical distance to prevent overlap
            var distanceOffset = Math.min(Math.abs(dy) / 7, 90);
            var clearanceX = start.x - nodeWidth / 2 - baseClearance - laneSpacing - distanceOffset;
            // Go above the target first, then come straight down to enter from top
            var aboveTargetY = end.y - 20;
            points.push(clearanceX, start.y);
            points.push(clearanceX, aboveTargetY);
            points.push(end.x, aboveTargetY);
          } else if (outSide === "right" && inSide === "bottom") {
            // Going right then up to enter from bottom (target is above-right)
            // Simple L-shape: go right to target's X, then up to target
            points.push(end.x, start.y);
          } else if (outSide === "left" && inSide === "bottom") {
            // Going left then up to enter from bottom (target is above-left)
            // Simple L-shape: go left to target's X, then up to target
            points.push(end.x, start.y);
          } else if (outSide === "right" && inSide === "left") {
            // Horizontal connection
            if (Math.abs(dy) > 10) {
              var midX = (start.x + end.x) / 2;
              var routeY = start.y + startOffset;
              points.push(midX, routeY);
              points.push(midX, end.y + endOffset);
            }
          } else if (outSide === "left" && inSide === "right") {
            if (Math.abs(dy) > 10) {
              var midX = (start.x + end.x) / 2;
              var routeY = start.y + startOffset;
              points.push(midX, routeY);
              points.push(midX, end.y + endOffset);
            }
          } else if (outSide === "bottom" && inSide === "left") {
            // Go down then right - use offset on vertical segment
            var routeX = start.x + startOffset;
            points.push(routeX, end.y);
          } else if (outSide === "bottom" && inSide === "right") {
            // Go down then left - use offset on vertical segment
            var routeX = start.x + startOffset;
            points.push(routeX, end.y);
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

      function determineSides(edge, fromNode, toNode, nodeMap) {
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
        
        // Target positions
        var targetToRight = dx > nodeWidth * 0.3;
        var targetToLeft = dx < -nodeWidth * 0.3;
        var targetBelow = dy > nodeHeight * 0.3;
        var targetDirectlyBelow = Math.abs(dx) < nodeWidth * 0.5 && dy > 0;
        
        // Check if the cell directly below the source node is empty
        // This helps determine if we can go straight down
        var cellBelowEmpty = true;
        if (nodeMap) {
          var sourceBottomY = fromNode.y + nodeHeight;
          var targetTopY = toNode.y;
          // Check if any node occupies the space between source and target
          for (var nodeId in nodeMap) {
            if (nodeId === fromNode.id || nodeId === toNode.id) continue;
            var otherNode = nodeMap[nodeId];
            var otherCenterX = otherNode.x + nodeWidth / 2;
            var sourceCenterX = fromNode.x + nodeWidth / 2;
            // Check if node is in the vertical path
            if (Math.abs(otherCenterX - sourceCenterX) < nodeWidth * 0.8) {
              // Node is in same column
              if (otherNode.y > sourceBottomY && otherNode.y < targetTopY) {
                // Node is between source and target
                cellBelowEmpty = false;
                break;
              }
            }
          }
        }
        
        // Source connector determines exit side
        // Decision branches ALWAYS exit from their designated side for visual clarity
        // EXCEPTION: if target is directly below AND path is clear, go straight down
        if (sourceConn === "error" || sourceConn === "pipelet_error" || isError) {
          outSide = "right";
        } else if (sourceConn === "yes" || sourceConn === "true") {
          // YES branch: normally exits right, but if target is directly below
          // and path is clear, go straight down (simpler routing)
          if (targetDirectlyBelow && cellBelowEmpty) {
            outSide = "bottom";
          } else {
            outSide = "right";  // YES always exits right
          }
        } else if (sourceConn === "no" || sourceConn === "false") {
          // NO branch: normally exits left, but if target is directly below
          // and path is clear, go straight down (simpler routing)
          if (targetDirectlyBelow && cellBelowEmpty) {
            outSide = "bottom";
          } else {
            outSide = "left";   // NO always exits left
          }
        }
        
        // Target connector determines entry side - RESPECT XML if specified
        // EXCEPTION: override when target is directly adjacent for cleaner routing
        var targetOnSameRow = Math.abs(dy) < nodeHeight * 0.5;
        var targetDirectlyToRight = targetToRight && targetOnSameRow;
        var targetDirectlyToLeft = targetToLeft && targetOnSameRow;
        
        // Smart override: if exiting right and target is directly to the right on same row,
        // enter from left regardless of XML target connector (cleaner horizontal line)
        if (outSide === "right" && targetDirectlyToRight) {
          inSide = "left";
        } else if (outSide === "left" && targetDirectlyToLeft) {
          inSide = "right";
        } else if (outSide === "bottom" && targetOnSameRow) {
          // Target is on same row but we're exiting from bottom - prefer horizontal entry
          // This happens when default routing goes down but target is actually beside us
          if (targetToRight) {
            outSide = "right";
            inSide = "left";
          } else if (targetToLeft) {
            outSide = "left";
            inSide = "right";
          }
        } else if (targetConn === "in" || targetConn === "in1" || targetConn === "in2") {
          inSide = "top";
        } else if (targetConn === "loop") {
          inSide = "top";
        } else if (targetConn === "left") {
          inSide = "left";
        } else if (targetConn === "right") {
          inSide = "right";
        } else if (targetConn === "bottom") {
          inSide = "bottom";
        } else if (targetConn) {
          inSide = "top";
        } else {
          // No target connector - determine based on position and exit side
          if (outSide === "right") {
            // Exiting right (yes branch or error)
            if (targetToRight) {
              inSide = "left";  // Target to right - enter from left
            } else {
              inSide = "top";   // Target below or left - enter from top
            }
          } else if (outSide === "left") {
            // Exiting left (no branch)
            if (targetToLeft) {
              inSide = "right"; // Target to left - enter from right
            } else {
              inSide = "top";   // Target below or right - enter from top
            }
          }
        }
        
        // Handle back edges (target above source)
        // When target is above, prefer entering from bottom instead of top
        // This creates cleaner routing for error/yes branches going to nodes above
        var targetAbove = dy < -nodeHeight * 0.3;
        if (targetAbove) {
          if (outSide === "bottom") outSide = "top";
          // When exiting right/left and target is above, enter from bottom for cleaner L-shape
          if ((outSide === "right" || outSide === "left") && inSide === "top") {
            inSide = "bottom";
          }
        }

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
        return (idx - (total - 1) / 2) * EDGE_SPACING;
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
        var outOffset = nextOffset(outIndex, outCounts, outKey);
        var inOffset = nextOffset(inIndex, inCounts, inKey);

        var start = getAnchor(fromNode, plan.outSide, (plan.outSide === "top" || plan.outSide === "bottom") ? outOffset : outOffset);
        var end = getAnchor(toNode, plan.inSide, (plan.inSide === "top" || plan.inSide === "bottom") ? inOffset : inOffset);

        // For straight vertical connections (bottom→top), align X coordinates if nodes are nearly aligned
        var fromCenterX = fromNode.x + nodeWidth / 2;
        var toCenterX = toNode.x + nodeWidth / 2;
        var nodesAligned = Math.abs(fromCenterX - toCenterX) < 5;
        
        if (plan.outSide === "bottom" && plan.inSide === "top" && nodesAligned) {
          // Use the same X for both anchors to ensure a perfectly straight line
          var alignedX = fromCenterX;
          
          // Calculate proper Y positions accounting for join nodes
          var startY = fromNode.type === "join" 
            ? fromNode.y + nodeHeight / 2 + 10  // Bottom of join node circle
            : fromNode.y + nodeHeight;
          var endY = toNode.type === "join"
            ? toNode.y + nodeHeight / 2 - 10    // Top of join node circle
            : toNode.y;
            
          start = { x: alignedX, y: startY };
          end = { x: alignedX, y: endY };
        }

        // Check if edge has bend points from XML
        var bendPoints = (edge.display && edge.display.bendPoints) ? edge.display.bendPoints : null;
        var hasBendPoints = bendPoints && bendPoints.length > 0;

        // Backward edges (or target above) keep the existing left-loop curve
        var isGoingUp = end.y < start.y - 5;

        var points;
        var arrowAngle;

        if (isBackEdge || (isGoingUp && !hasBendPoints)) {
          // Use bottom->top anchors for loops to look like the legacy editor
          // Account for join nodes having different anchor points
          var x1 = fromNode.x + nodeWidth / 2;
          var y1 = fromNode.type === "join" 
            ? fromNode.y + nodeHeight / 2 + 10 
            : fromNode.y + nodeHeight;
          var x2 = toNode.x + nodeWidth / 2;
          var y2 = toNode.type === "join"
            ? toNode.y + nodeHeight / 2 - 10
            : toNode.y;

          var loopOffset = 50;
          var leftX = Math.min(fromNode.x, toNode.x) - loopOffset;
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
          points = buildOrthogonalPath(start, end, bendPoints, fromNode, toNode, plan.outSide, plan.inSide, outOffset, inOffset);
          arrowAngle = getArrowAngleForSide(plan.inSide);
        } else {
          // No bend points - use simple routing
          points = buildOrthogonalPath(start, end, null, fromNode, toNode, plan.outSide, plan.inSide, outOffset, inOffset);
          arrowAngle = getArrowAngleForSide(plan.inSide);
        }

        var edgeId = plan.edgeId;

        // Create a group for the edge
        var edgeGroup = new Konva.Group({
          name: "edge-group",
          perfectDrawEnabled: false  // Performance optimization
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
          hitStrokeWidth: 20,
          perfectDrawEnabled: false
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
          listening: false,
          perfectDrawEnabled: false
        });
        edgeGroup.add(visibleLine);

        // Arrow head at the entry point - filled triangle pointing in the direction of flow
        // Position arrow BEFORE the node entry point (offset backward along the incoming line)
        var arrowOffset = 12;
        // Add offset in the opposite direction of flow (where the line came from)
        var arrowX = end.x + arrowOffset * Math.cos(arrowAngle);
        var arrowY = end.y + arrowOffset * Math.sin(arrowAngle);
        
        // Convert arrowAngle to rotation for Konva.RegularPolygon
        // arrowAngle represents the direction the line is GOING INTO the node
        // RegularPolygon with sides=3: rotation 0=pointing up, 90=right, 180=down, 270=left
        // We want the arrow to point in the direction of flow (INTO the node)
        var rotationDegrees = (arrowAngle * 180 / Math.PI) - 90;
        
        var arrowHead = new Konva.RegularPolygon({
          name: "edge-arrow",
          x: arrowX,
          y: arrowY,
          sides: 3,
          radius: 5,
          fill: edgeColor,
          stroke: edgeColor,
          strokeWidth: 1,
          rotation: rotationDegrees,
          listening: false,
          perfectDrawEnabled: false
        });
        edgeGroup.add(arrowHead);

        // Label placement: use midpoint with slight nudge based on primary direction
        if (edge.label) {
          var labelX = (start.x + end.x) / 2;
          var labelY = (start.y + end.y) / 2;
          if (plan.outSide === "right" || plan.outSide === "left") {
            labelY -= 14;
          } else {
            labelX += 14;
            labelY -= 16;
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
     * Draw a join node (small circle connector)
     */
    function drawJoinNode(layer, node) {
      var color = colors[node.type] || colors.join || "#6b7394";
      var radius = 10;

      var group = new Konva.Group({
        x: node.x + nodeWidth / 2,  // Center in the cell
        y: node.y + nodeHeight / 2,
        name: "node-group",
        perfectDrawEnabled: false  // Performance optimization
      });

      // Store reference for selection
      nodeGroups[node.id] = group;

      // Outer circle
      var circle = new Konva.Circle({
        x: 0,
        y: 0,
        radius: radius,
        fill: "#0d1328",
        stroke: color,
        strokeWidth: 2,
        shadowColor: "#000",
        shadowBlur: 10,
        shadowOpacity: 0.4,
        shadowOffsetY: 2,
        perfectDrawEnabled: false
      });
      group.add(circle);

      // Inner dot
      group.add(new Konva.Circle({
        x: 0,
        y: 0,
        radius: 4,
        fill: color,
        listening: false,
        perfectDrawEnabled: false
      }));

      // Hover effects
      group.on("mouseenter", function() {
        document.body.style.cursor = "pointer";
        if (selectedNodeId !== node.id) {
          circle.shadowBlur(15);
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
    }

    /**
     * Draw a single node
     */
    function drawNode(layer, node) {
      // Join nodes are rendered as small circles
      if (node.type === "join") {
        drawJoinNode(layer, node);
        return;
      }

      var color = colors[node.type] || colors.unknown;

      var group = new Konva.Group({
        x: node.x,
        y: node.y,
        name: "node-group",
        perfectDrawEnabled: false  // Performance optimization
      });

      // Store reference for selection
      nodeGroups[node.id] = group;

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
        shadowOffsetY: 5,
        perfectDrawEnabled: false
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
        listening: false,
        perfectDrawEnabled: false
      }));

      // Type pill
      var pillText = new Konva.Text({
        text: node.type,
        fontSize: 10,
        fontFamily: "IBM Plex Sans, system-ui, sans-serif",
        fill: "#0b1021",
        padding: 0,
        perfectDrawEnabled: false
      });
      var pillWidth = pillText.width() + 12;
      
      group.add(new Konva.Rect({
        x: 10,
        y: 10,
        width: pillWidth,
        height: 18,
        fill: color,
        cornerRadius: 9,
        perfectDrawEnabled: false
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
        wrap: "none",
        listening: false,
        perfectDrawEnabled: false
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
        wrap: "none",
        listening: false,
        perfectDrawEnabled: false
      }));

      // Add navigation indicator for jump/call nodes
      if (node.type === "jump" || node.type === "call") {
        // External link icon in bottom right corner
        var iconGroup = new Konva.Group({
          x: nodeWidth - 28,
          y: nodeHeight - 28,
          listening: false,
          perfectDrawEnabled: false
        });
        
        iconGroup.add(new Konva.Rect({
          width: 20,
          height: 20,
          fill: "rgba(242, 192, 120, 0.2)",
          cornerRadius: 4,
          listening: false,
          perfectDrawEnabled: false
        }));
        
        // Draw external link icon
        iconGroup.add(new Konva.Line({
          points: [5, 15, 15, 5],
          stroke: "#f2c078",
          strokeWidth: 1.5,
          lineCap: "round",
          listening: false,
          perfectDrawEnabled: false
        }));
        iconGroup.add(new Konva.Line({
          points: [9, 5, 15, 5, 15, 11],
          stroke: "#f2c078",
          strokeWidth: 1.5,
          lineCap: "round",
          lineJoin: "round",
          listening: false,
          perfectDrawEnabled: false
        }));
        iconGroup.add(new Konva.Line({
          points: [5, 9, 5, 15, 11, 15],
          stroke: "#f2c078",
          strokeWidth: 1.5,
          lineCap: "round",
          lineJoin: "round",
          listening: false,
          perfectDrawEnabled: false
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
