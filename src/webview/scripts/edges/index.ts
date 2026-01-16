/**
 * Edge drawing module
 * Orchestrates edge rendering using routing and selection modules
 */

import { getEdgeRoutingScript } from "./routing";
import { getEdgeSelectionScript } from "./selection";
import { getEdgePropertiesScript } from "./properties";

export function getEdgeScript(): string {
  return `
    ${getEdgeRoutingScript()}
    ${getEdgeSelectionScript()}
    ${getEdgePropertiesScript()}

    /**
     * Draw edges between nodes
     */
    function drawEdges(layer, edges, nodeMap) {
      // First pass: plan routes and count per-side exits/entries
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
          inSide: sides.inSide,
          blockingNode: sides.blockingNode
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
          var alignedX = fromCenterX;
          
          var startY = fromNode.type === "join" 
            ? fromNode.y + nodeHeight / 2 + 10
            : fromNode.y + nodeHeight;
          var endY = toNode.type === "join"
            ? toNode.y + nodeHeight / 2 - 10
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
          var result = buildBackEdgePath(fromNode, toNode);
          points = result.points;
          end = result.end;
          arrowAngle = -Math.PI / 2;
        } else if (hasBendPoints) {
          points = buildOrthogonalPath(start, end, bendPoints, fromNode, toNode, plan.outSide, plan.inSide, outOffset, inOffset, nodeMap, plan.blockingNode);
          arrowAngle = getArrowAngleForSide(plan.inSide);
        } else {
          points = buildOrthogonalPath(start, end, null, fromNode, toNode, plan.outSide, plan.inSide, outOffset, inOffset, nodeMap, plan.blockingNode);
          arrowAngle = getArrowAngleForSide(plan.inSide);
        }

        var edgeId = plan.edgeId;

        // Create edge group and add to layer
        createEdgeGroup(layer, edgeId, edge, points, edgeColor, arrowAngle, end, start, plan.outSide);
      }
    }

    /**
     * Build back edge (loop) path
     */
    function buildBackEdgePath(fromNode, toNode) {
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
      var points = [];
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

      return { points: points, end: { x: x2, y: y2 } };
    }

    /**
     * Create edge group with all visual elements
     */
    function createEdgeGroup(layer, edgeId, edge, points, edgeColor, arrowAngle, end, start, outSide) {
      // Create a group for the edge
      var edgeGroup = new Konva.Group({
        name: "edge-group",
        perfectDrawEnabled: false
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

      // Arrow head at the entry point
      var arrowOffset = 12;
      var arrowX = end.x + arrowOffset * Math.cos(arrowAngle);
      var arrowY = end.y + arrowOffset * Math.sin(arrowAngle);
      
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

      // Label placement
      if (edge.label) {
        var labelX = (start.x + end.x) / 2;
        var labelY = (start.y + end.y) / 2;
        if (outSide === "right" || outSide === "left") {
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

      // Setup edge hover effects
      setupEdgeHover(edgeGroup, edgeId, edge, layer);

      layer.add(edgeGroup);
    }
  `;
}
