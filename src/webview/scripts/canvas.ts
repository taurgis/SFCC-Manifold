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

      function getAnchor(node, side, offset) {
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

      function determineSides(edge, fromNode, toNode) {
        var label = edge.label;
        var isError = isErrorEdge(label);
        var dx = (toNode.x + nodeWidth / 2) - (fromNode.x + nodeWidth / 2);
        var dy = (toNode.y + nodeHeight / 2) - (fromNode.y + nodeHeight / 2);

        // Default: flow downward
        var outSide = "bottom";
        var inSide = "top";

        // Legacy-like behavior: errors leave from the right side of the source node.
        // Entry side depends on target placement:
        // - target directly below: enter on the right (matches legacy connector placement)
        // - target to the right: enter on the left
        // - target to the left: enter on the right
        if (isError) {
          outSide = "right";

          var mostlyBelow = dy > nodeHeight * 0.3;
          var targetRight = dx > nodeWidth * 0.3;
          var targetLeft = dx < -nodeWidth * 0.3;
          var horizontallyAligned = Math.abs(dx) <= nodeWidth * 0.3;

          if (targetRight) {
            inSide = "left";
          } else if (targetLeft) {
            inSide = "right";
          } else if (mostlyBelow && horizontallyAligned) {
            inSide = "right";
          } else {
            // Fallback: prefer left entry when roughly aligned or slightly right
            inSide = dx >= 0 ? "left" : "right";
          }

          return { outSide: outSide, inSide: inSide };
        }

        // Decision branches: push yes/right, no/left (helps reduce overlaps).
        // If the branch target is stacked below, enter from the top to avoid awkward side-entry.
        if (isDecisionYes(label)) {
          outSide = "right";
          inSide = (dy > nodeHeight * 0.3 && Math.abs(dy) >= Math.abs(dx)) ? "top" : "left";
          return { outSide: outSide, inSide: inSide };
        }
        if (isDecisionNo(label)) {
          outSide = "left";
          inSide = (dy > nodeHeight * 0.3 && Math.abs(dy) >= Math.abs(dx)) ? "top" : "right";
          return { outSide: outSide, inSide: inSide };
        }

        // If target is significantly to the side, prefer side exits/entries
        if (Math.abs(dx) > 220 && Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) {
            outSide = "right";
            inSide = "left";
          } else {
            outSide = "left";
            inSide = "right";
          }
          return { outSide: outSide, inSide: inSide };
        }

        // Otherwise keep top/bottom
        return { outSide: outSide, inSide: inSide };
      }

      function buildManhattanPoints(start, end, outSide, inSide) {
        function nudge(p, side, amount) {
          if (side === "top") return { x: p.x, y: p.y - amount };
          if (side === "bottom") return { x: p.x, y: p.y + amount };
          if (side === "left") return { x: p.x - amount, y: p.y };
          return { x: p.x + amount, y: p.y };
        }

        var p0 = start;
        var p3 = end;
        var p1 = nudge(p0, outSide, EDGE_PAD);
        var p2 = nudge(p3, inSide, EDGE_PAD);

        // Choose a dogleg that avoids running through the source/target rectangles
        var points = [p0.x, p0.y];

        // Simple orthogonal routing with a single bend or two bends depending on sides
        if ((outSide === "left" || outSide === "right") && (inSide === "left" || inSide === "right")) {
          var midX = (p1.x + p2.x) / 2;
          points.push(p1.x, p1.y);
          points.push(midX, p1.y);
          points.push(midX, p2.y);
          points.push(p2.x, p2.y);
        } else if ((outSide === "top" || outSide === "bottom") && (inSide === "top" || inSide === "bottom")) {
          var midY = (p1.y + p2.y) / 2;
          points.push(p1.x, p1.y);
          points.push(p1.x, midY);
          points.push(p2.x, midY);
          points.push(p2.x, p2.y);
        } else {
          points.push(p1.x, p1.y);
          points.push(p1.x, p2.y);
          points.push(p2.x, p2.y);
        }

        points.push(p3.x, p3.y);
        return points;
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
        var sides = determineSides(edge, fromNode, toNode);

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

        // Offsets distribute multiple edges leaving/entering the same side
        var outKey = edge.from + "|" + plan.outSide;
        var inKey = edge.to + "|" + plan.inSide;
        var outOffset = nextOffset(outIndex, outCounts, outKey);
        var inOffset = nextOffset(inIndex, inCounts, inKey);

        var start = getAnchor(fromNode, plan.outSide, (plan.outSide === "top" || plan.outSide === "bottom") ? outOffset : outOffset);
        var end = getAnchor(toNode, plan.inSide, (plan.inSide === "top" || plan.inSide === "bottom") ? inOffset : inOffset);

        // Backward edges (or target above) keep the existing left-loop curve
        var isGoingUp = end.y < start.y - 5;

        var points;
        var arrowAngle;

        if (isBackEdge || isGoingUp) {
          // Use bottom->top anchors for loops to look like the legacy editor
          var x1 = fromNode.x + nodeWidth / 2;
          var y1 = fromNode.y + nodeHeight;
          var x2 = toNode.x + nodeWidth / 2;
          var y2 = toNode.y;

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
        } else {
          // Prefer straight vertical for near-aligned top/bottom
          if (plan.outSide === "bottom" && plan.inSide === "top" && Math.abs(start.x - end.x) < 20) {
            points = [start.x, start.y, end.x, end.y];
          } else {
            points = buildManhattanPoints(start, end, plan.outSide, plan.inSide);
          }
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
