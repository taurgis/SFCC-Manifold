/**
 * Konva canvas initialization and rendering script (embedded JavaScript)
 */

export function getCanvasScript(): string {
  return `
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
     * Draw edges between nodes
     */
    function drawEdges(layer, edges, nodeMap) {
      for (var i = 0; i < edges.length; i++) {
        var edge = edges[i];
        var fromNode = nodeMap[edge.from];
        var toNode = nodeMap[edge.to];
        
        if (!fromNode || !toNode) continue;

        // Get color based on edge label
        var edgeColor = getEdgeColor(edge.label);
        var isBackEdge = isLoopBackEdge(edge.label);

        var x1 = fromNode.x + nodeWidth / 2;
        var y1 = fromNode.y + nodeHeight;
        var x2 = toNode.x + nodeWidth / 2;
        var y2 = toNode.y;

        var points;
        var arrowAngle;
        
        // Check if this is a backward edge (target is above source)
        var isGoingUp = y2 < y1;
        
        if (isBackEdge || isGoingUp) {
          // Loop back-edge: curve to the left side
          var loopOffset = 50; // How far left the curve goes
          var leftX = Math.min(fromNode.x, toNode.x) - loopOffset;
          
          // Start from bottom of source, curve left, go up, curve right to top of target
          points = [];
          var steps = 30;
          
          // Control points for smooth S-curve on left side
          var cp1x = x1;           // Start going straight down briefly
          var cp1y = y1 + 30;
          var cp2x = leftX;        // Go to left side
          var cp2y = y1 + 30;
          var cp3x = leftX;        // Travel up on left side
          var cp3y = y2 - 30;
          var cp4x = x2;           // Curve back to target
          var cp4y = y2 - 30;
          
          // Draw the path as a cubic bezier approximation
          for (var t = 0; t <= 1; t += 1/steps) {
            var px, py;
            if (t < 0.33) {
              // First segment: source to left side
              var lt = t * 3;
              px = (1-lt)*(1-lt)*x1 + 2*(1-lt)*lt*cp1x + lt*lt*leftX;
              py = (1-lt)*(1-lt)*y1 + 2*(1-lt)*lt*cp1y + lt*lt*((y1+y2)/2);
            } else if (t < 0.66) {
              // Middle segment: travel up on left side
              var lt = (t - 0.33) * 3;
              px = leftX;
              py = (1-lt)*((y1+y2)/2 + 20) + lt*((y1+y2)/2 - 20);
            } else {
              // Last segment: left side to target
              var lt = (t - 0.66) * 3;
              px = (1-lt)*(1-lt)*leftX + 2*(1-lt)*lt*cp4x + lt*lt*x2;
              py = (1-lt)*(1-lt)*((y1+y2)/2 - 20) + 2*(1-lt)*lt*(y2-30) + lt*lt*y2;
            }
            points.push(px, py);
          }
          
          // Arrow points upward into the target
          arrowAngle = -Math.PI / 2; // Pointing up
        } else if (Math.abs(x1 - x2) < 20) {
          // Straight vertical line
          points = [x1, y1, x2, y2];
          arrowAngle = Math.PI / 2; // Pointing down
        } else {
          // Bezier curve for horizontal offset
          var midY = (y1 + y2) / 2;
          points = [];
          for (var t = 0; t <= 1; t += 0.05) {
            var px = Math.pow(1-t, 3) * x1 + 3 * Math.pow(1-t, 2) * t * x1 + 3 * (1-t) * t * t * x2 + Math.pow(t, 3) * x2;
            var py = Math.pow(1-t, 3) * y1 + 3 * Math.pow(1-t, 2) * t * midY + 3 * (1-t) * t * t * midY + Math.pow(t, 3) * y2;
            points.push(px, py);
          }
          arrowAngle = Math.atan2(y2 - points[points.length - 4], x2 - points[points.length - 3]);
        }

        // Draw line with color based on edge type
        layer.add(new Konva.Line({
          points: points,
          stroke: edgeColor,
          strokeWidth: 2,
          lineCap: "round",
          lineJoin: "round",
          listening: false
        }));

        // Draw arrow head with matching color
        var arrowSize = 10;
        layer.add(new Konva.Line({
          points: [
            x2 - arrowSize * Math.cos(arrowAngle - Math.PI / 6),
            y2 - arrowSize * Math.sin(arrowAngle - Math.PI / 6),
            x2,
            y2,
            x2 - arrowSize * Math.cos(arrowAngle + Math.PI / 6),
            y2 - arrowSize * Math.sin(arrowAngle + Math.PI / 6)
          ],
          stroke: edgeColor,
          strokeWidth: 2,
          lineCap: "round",
          lineJoin: "round",
          listening: false
        }));

        // Draw edge label with matching color
        if (edge.label) {
          var labelX, labelY;
          if (isBackEdge || isGoingUp) {
            // Place label on the left side of the loop curve
            labelX = Math.min(fromNode.x, toNode.x) - 50 - 10;
            labelY = (y1 + y2) / 2;
          } else {
            labelX = (x1 + x2) / 2;
            labelY = (y1 + y2) / 2 - 12;
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
          layer.add(text);
        }
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
