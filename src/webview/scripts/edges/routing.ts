/**
 * Edge routing algorithms module
 * Handles path calculation and collision avoidance for edges
 */

export function getEdgeRoutingScript(): string {
  return `
    /**
     * Edge routing constants
     */
    var EDGE_PAD = 26;
    var EDGE_SPACING = 12;

    /**
     * Normalize edge label for comparison
     */
    function normalizeLabel(label) {
      if (!label) return "";
      return String(label).toLowerCase().replace(/[\\s-]/g, "_");
    }

    /**
     * Check if edge is an error edge
     */
    function isErrorEdge(label) {
      var l = normalizeLabel(label);
      return l === "error" || l.indexOf("error") !== -1 || l === "pipelet_error";
    }

    /**
     * Check if edge is a decision YES branch
     */
    function isDecisionYes(label) {
      var l = normalizeLabel(label);
      return l === "yes" || l === "true";
    }

    /**
     * Check if edge is a decision NO branch
     */
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

    /**
     * Get anchor point for a node side
     */
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

    /**
     * Get arrow angle for a given side
     */
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
     * Check if a horizontal line segment intersects any node (excluding from/to nodes)
     */
    function lineIntersectsNode(x1, y1, x2, y2, nodeMap, fromNodeId, toNodeId) {
      if (!nodeMap) return null;
      var padding = 10; // Extra padding around nodes
      
      for (var nodeId in nodeMap) {
        if (nodeId === fromNodeId || nodeId === toNodeId) continue;
        var node = nodeMap[nodeId];
        var nodeLeft = node.x - padding;
        var nodeRight = node.x + nodeWidth + padding;
        var nodeTop = node.y - padding;
        var nodeBottom = node.y + nodeHeight + padding;
        
        // Check if line segment passes through this node's bounding box
        var minX = Math.min(x1, x2);
        var maxX = Math.max(x1, x2);
        var minY = Math.min(y1, y2);
        var maxY = Math.max(y1, y2);
        
        // Check horizontal line (y1 == y2)
        if (Math.abs(y1 - y2) < 5) {
          if (y1 > nodeTop && y1 < nodeBottom) {
            if (maxX > nodeLeft && minX < nodeRight) {
              return node;
            }
          }
        }
        // Check vertical line (x1 == x2)
        else if (Math.abs(x1 - x2) < 5) {
          if (x1 > nodeLeft && x1 < nodeRight) {
            if (maxY > nodeTop && minY < nodeBottom) {
              return node;
            }
          }
        }
      }
      return null;
    }

    /**
     * Build path through waypoints
     * Creates orthogonal (right-angle) paths connecting start → waypoints → end
     * Uses startOffset and endOffset to prevent overlapping parallel lines
     */
    function buildOrthogonalPath(start, end, bendPoints, fromNode, toNode, outSide, inSide, startOffset, endOffset, nodeMap, blockingNode) {
      var points = [start.x, start.y];
      
      // Use offsets for routing to prevent overlap
      startOffset = startOffset || 0;
      endOffset = endOffset || 0;

      // If we have a blocking node, ignore XML bend points and use smart routing instead
      // The XML bend points may have been created in a different layout context
      if (bendPoints && bendPoints.length > 0 && !blockingNode) {
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
        routeWithoutBendPoints(points, start, end, outSide, inSide, startOffset, endOffset, fromNode, toNode, nodeMap, blockingNode);
      }
      
      points.push(end.x, end.y);
      
      // Post-process: ensure the final segment is long enough for the arrow
      ensureMinFinalSegment(points);
      
      return points;
    }

    /**
     * Route path without bend points using smart routing
     */
    function routeWithoutBendPoints(points, start, end, outSide, inSide, startOffset, endOffset, fromNode, toNode, nodeMap, blockingNode) {
      var dx = end.x - start.x;
      var dy = end.y - start.y;
      
      if (outSide === "bottom" && inSide === "top") {
        routeBottomToTop(points, start, end, dx, dy, fromNode, toNode, nodeMap);
      } else if (outSide === "right" && inSide === "top") {
        routeRightToTop(points, start, end, dy, startOffset, toNode, nodeMap, blockingNode);
      } else if (outSide === "left" && inSide === "top") {
        routeLeftToTop(points, start, end, dx, dy, startOffset, toNode, nodeMap, blockingNode);
      } else if (outSide === "left" && inSide === "left") {
        routeLeftToLeft(points, start, end, dy, startOffset, toNode, nodeMap, blockingNode);
      } else if (outSide === "bottom" && inSide === "right") {
        routeBottomToRight(points, start, end, toNode);
      } else if (outSide === "bottom" && inSide === "left") {
        routeBottomToLeft(points, start, end, toNode);
      } else if (outSide === "right" && inSide === "bottom") {
        routeRightToBottom(points, start, end, fromNode, toNode, nodeMap);
      } else if (outSide === "left" && inSide === "bottom") {
        routeLeftToBottom(points, start, end, fromNode, toNode, nodeMap);
      } else if (outSide === "right" && inSide === "left") {
        routeRightToLeft(points, start, end, dy, startOffset, endOffset, fromNode, toNode, nodeMap);
      } else if (outSide === "left" && inSide === "right") {
        routeLeftToRight(points, start, end, dy, startOffset, endOffset, fromNode, toNode, nodeMap);
      } else if (outSide === "top" && inSide === "bottom") {
        routeTopToBottom(points, start, end, dx, startOffset, endOffset);
      } else if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        // Default: L-shape based on exit direction
        if (outSide === "right" || outSide === "left") {
          points.push(end.x, start.y);
        } else {
          points.push(start.x, end.y);
        }
      }
    }

    /**
     * Route from bottom to top
     */
    function routeBottomToTop(points, start, end, dx, dy, fromNode, toNode, nodeMap) {
      if (Math.abs(dx) > 5) {
        // Nodes not aligned - need to route with a horizontal segment
        var midY = (start.y + end.y) / 2;
        
        // Check for collision on the horizontal segment
        var blocker = lineIntersectsNode(start.x, midY, end.x, midY, nodeMap, fromNode.id, toNode.id);
        if (blocker) {
          // Route around the blocking node
          var clearanceY = Math.min(start.y + 30, blocker.y - 25);
          
          // Determine which side to go around
          if (start.x > blocker.x + nodeWidth) {
            var clearX = blocker.x + nodeWidth + 25;
            points.push(start.x, clearanceY);
            points.push(clearX, clearanceY);
            points.push(clearX, end.y);
          } else if (start.x < blocker.x) {
            var clearX = blocker.x - 25;
            points.push(start.x, clearanceY);
            points.push(clearX, clearanceY);
            points.push(clearX, end.y);
          } else {
            var goRight = end.x > start.x;
            var clearX = goRight ? blocker.x + nodeWidth + 25 : blocker.x - 25;
            points.push(start.x, clearanceY);
            points.push(clearX, clearanceY);
            points.push(clearX, end.y);
          }
        } else {
          // Check if the vertical segments would collide
          var vertBlocker1 = lineIntersectsNode(start.x, start.y, start.x, midY, nodeMap, fromNode.id, toNode.id);
          var vertBlocker2 = lineIntersectsNode(end.x, midY, end.x, end.y, nodeMap, fromNode.id, toNode.id);
          
          if (vertBlocker1 || vertBlocker2) {
            var blocker = vertBlocker1 || vertBlocker2;
            var clearX = blocker.x + nodeWidth + 25;
            points.push(clearX, start.y);
            points.push(clearX, end.y);
          } else {
            points.push(start.x, midY);
            points.push(end.x, midY);
          }
        }
      } else {
        // Nodes are aligned - check for collision on straight vertical line
        var vertBlocker = lineIntersectsNode(start.x, start.y, end.x, end.y, nodeMap, fromNode.id, toNode.id);
        if (vertBlocker) {
          var clearanceX = vertBlocker.x + nodeWidth + 25;
          points.push(clearanceX, start.y);
          points.push(clearanceX, end.y);
        }
      }
    }

    /**
     * Route from right to top (YES branch or error going to node below)
     */
    function routeRightToTop(points, start, end, dy, startOffset, toNode, nodeMap, blockingNode) {
      var dx = end.x - start.x;
      var laneSpacing = Math.abs(startOffset) * 7.5;
      var baseClearance = 30;
      if (dx < 0) {
        baseClearance = 50;
      }
      var distanceOffset = Math.min(Math.abs(dy) / 7, 90);
      var clearanceX = start.x + nodeWidth / 2 + baseClearance + laneSpacing + distanceOffset;
      var aboveTargetY = end.y - 25;
      
      // Check for collision on vertical segment
      var vertBlocker = lineIntersectsNode(clearanceX, start.y, clearanceX, aboveTargetY, nodeMap, null, toNode.id);
      if (vertBlocker) {
        clearanceX = vertBlocker.x + nodeWidth + 25;
      }
      
      // Check for collision on the horizontal segment to target
      var horizBlocker = lineIntersectsNode(clearanceX, aboveTargetY, end.x, aboveTargetY, nodeMap, null, toNode.id);
      if (horizBlocker) {
        aboveTargetY = horizBlocker.y - 25;
      }
      
      points.push(clearanceX, start.y);
      points.push(clearanceX, aboveTargetY);
      points.push(end.x, aboveTargetY);
    }

    /**
     * Route from left to top (NO branch going to node below)
     */
    function routeLeftToTop(points, start, end, dx, dy, startOffset, toNode, nodeMap, blockingNode) {
      var laneSpacing = Math.abs(startOffset) * 7.5;
      var baseClearance = 30;
      if (dx > 0) {
        baseClearance = 50;
      }
      var distanceOffset = Math.min(Math.abs(dy) / 7, 90);
      var clearanceX = start.x - nodeWidth / 2 - baseClearance - laneSpacing - distanceOffset;
      var aboveTargetY = end.y - 25;
      
      if (blockingNode) {
        var blockerLeft = blockingNode.x - 25;
        if (clearanceX > blockerLeft) {
          clearanceX = blockerLeft;
        }
        var blockerTop = blockingNode.y;
        var blockerBottom = blockingNode.y + nodeHeight;
        if (aboveTargetY > blockerTop - 10 && aboveTargetY < blockerBottom + 10) {
          aboveTargetY = blockerBottom + 25;
        }
      }
      
      var vertBlocker = lineIntersectsNode(clearanceX, start.y, clearanceX, aboveTargetY, nodeMap, null, toNode.id);
      if (vertBlocker) {
        clearanceX = vertBlocker.x - 25;
      }
      
      var horizBlocker = lineIntersectsNode(clearanceX, aboveTargetY, end.x, aboveTargetY, nodeMap, null, toNode.id);
      if (horizBlocker) {
        aboveTargetY = horizBlocker.y + nodeHeight + 25;
      }
      
      points.push(clearanceX, start.y);
      points.push(clearanceX, aboveTargetY);
      points.push(end.x, aboveTargetY);
    }

    /**
     * Route from left to left (entering from left side)
     */
    function routeLeftToLeft(points, start, end, dy, startOffset, toNode, nodeMap, blockingNode) {
      var laneSpacing = Math.abs(startOffset) * 7.5;
      var baseClearance = 30;
      var distanceOffset = Math.min(Math.abs(dy) / 7, 90);
      var clearanceX = start.x - nodeWidth / 2 - baseClearance - laneSpacing - distanceOffset;
      
      if (blockingNode) {
        var blockerLeft = blockingNode.x - 25;
        if (clearanceX > blockerLeft) {
          clearanceX = blockerLeft;
        }
      }
      
      var targetLeftX = toNode.x - 25;
      if (clearanceX > targetLeftX) {
        clearanceX = targetLeftX - 25;
      }
      
      points.push(clearanceX, start.y);
      points.push(clearanceX, end.y);
    }

    /**
     * Route from bottom to right
     */
    function routeBottomToRight(points, start, end, toNode) {
      var targetRightX = toNode.x + nodeWidth + 25;
      if (targetRightX < start.x) {
        targetRightX = start.x;
      }
      points.push(start.x, end.y);
    }

    /**
     * Route from bottom to left
     */
    function routeBottomToLeft(points, start, end, toNode) {
      var targetLeftX = toNode.x - 25;
      if (targetLeftX > start.x) {
        targetLeftX = start.x;
      }
      points.push(start.x, end.y);
    }

    /**
     * Route from right to bottom
     */
    function routeRightToBottom(points, start, end, fromNode, toNode, nodeMap) {
      var horizBlocker = lineIntersectsNode(start.x, start.y, end.x, start.y, nodeMap, fromNode.id, toNode.id);
      if (horizBlocker) {
        var belowY = horizBlocker.y + nodeHeight + 25;
        points.push(start.x, belowY);
        points.push(end.x, belowY);
      } else {
        points.push(end.x, start.y);
      }
    }

    /**
     * Route from left to bottom
     */
    function routeLeftToBottom(points, start, end, fromNode, toNode, nodeMap) {
      var horizBlocker = lineIntersectsNode(start.x, start.y, end.x, start.y, nodeMap, fromNode.id, toNode.id);
      if (horizBlocker) {
        var belowY = horizBlocker.y + nodeHeight + 25;
        points.push(start.x, belowY);
        points.push(end.x, belowY);
      } else {
        points.push(end.x, start.y);
      }
    }

    /**
     * Route from right to left (horizontal connection)
     */
    function routeRightToLeft(points, start, end, dy, startOffset, endOffset, fromNode, toNode, nodeMap) {
      if (Math.abs(dy) > 10) {
        var midX = (start.x + end.x) / 2;
        var routeY = start.y + startOffset;
        
        var vertBlocker = lineIntersectsNode(midX, Math.min(start.y, end.y), midX, Math.max(start.y, end.y), nodeMap, fromNode.id, toNode.id);
        if (vertBlocker) {
          midX = vertBlocker.x + nodeWidth + 25;
        }
        
        points.push(midX, routeY);
        points.push(midX, end.y + endOffset);
      }
    }

    /**
     * Route from left to right
     */
    function routeLeftToRight(points, start, end, dy, startOffset, endOffset, fromNode, toNode, nodeMap) {
      if (Math.abs(dy) > 10) {
        var midX = (start.x + end.x) / 2;
        var routeY = start.y + startOffset;
        
        var vertBlocker = lineIntersectsNode(midX, Math.min(start.y, end.y), midX, Math.max(start.y, end.y), nodeMap, fromNode.id, toNode.id);
        if (vertBlocker) {
          midX = vertBlocker.x - 25;
        }
        
        points.push(midX, routeY);
        points.push(midX, end.y + endOffset);
      }
    }

    /**
     * Route from top to bottom (going upward)
     */
    function routeTopToBottom(points, start, end, dx, startOffset, endOffset) {
      if (Math.abs(dx) > 5) {
        var midY = (start.y + end.y) / 2;
        var routeX = start.x + startOffset;
        points.push(routeX, midY);
        points.push(end.x + endOffset, midY);
      }
    }

    /**
     * Ensure the final segment is long enough for the arrow
     * Arrow needs at least 25px of straight line to look good
     */
    function ensureMinFinalSegment(points) {
      var minFinalSegment = 25;
      if (points.length >= 4) {
        var lastX = points[points.length - 2];
        var lastY = points[points.length - 1];
        var prevX = points[points.length - 4];
        var prevY = points[points.length - 3];
        
        var finalDx = Math.abs(lastX - prevX);
        var finalDy = Math.abs(lastY - prevY);
        
        // Check if final segment is too short
        if (finalDx < 5 && finalDy < minFinalSegment && finalDy > 0) {
          // Vertical final segment is too short - extend it
          var extension = minFinalSegment - finalDy;
          if (lastY > prevY) {
            points[points.length - 3] = prevY - extension;
          } else {
            points[points.length - 3] = prevY + extension;
          }
        } else if (finalDy < 5 && finalDx < minFinalSegment && finalDx > 0) {
          // Horizontal final segment is too short - extend it
          var extension = minFinalSegment - finalDx;
          if (lastX > prevX) {
            points[points.length - 4] = prevX - extension;
          } else {
            points[points.length - 4] = prevX + extension;
          }
        }
      }
    }

    /**
     * Determine exit and entry sides for an edge
     */
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
      
      // Check if there's a blocking node in our vertical path to the target
      var cellBelowEmpty = true;
      var blockingNode = null;
      var sourceToRightOfTarget = dx < -nodeWidth * 0.8;
      var sourceToLeftOfTarget = dx > nodeWidth * 0.8;
      
      if (nodeMap) {
        var sourceBottomY = fromNode.y + nodeHeight;
        var targetTopY = toNode.y;
        var sourceCenterX = fromNode.x + nodeWidth / 2;
        
        if (dy > 0) {
          for (var nodeId in nodeMap) {
            if (nodeId === fromNode.id || nodeId === toNode.id) continue;
            var otherNode = nodeMap[nodeId];
            var otherCenterX = otherNode.x + nodeWidth / 2;
            var otherTop = otherNode.y;
            var otherBottom = otherNode.y + nodeHeight;
            
            if (Math.abs(otherCenterX - sourceCenterX) < nodeWidth * 0.8) {
              if (otherTop >= sourceBottomY - 10 && otherTop < targetTopY) {
                cellBelowEmpty = false;
                blockingNode = otherNode;
                break;
              }
            }
          }
        }
      }
      
      // Source connector determines exit side
      if (sourceConn === "error" || sourceConn === "pipelet_error" || isError) {
        outSide = "right";
      } else if (sourceConn === "yes" || sourceConn === "true") {
        if (targetDirectlyBelow && cellBelowEmpty) {
          outSide = "bottom";
        } else {
          outSide = "right";
        }
      } else if (sourceConn === "no" || sourceConn === "false") {
        if (targetDirectlyBelow && cellBelowEmpty) {
          outSide = "bottom";
        } else {
          outSide = "left";
        }
      } else {
        if (!cellBelowEmpty) {
          if (targetToLeft) {
            outSide = "left";
            inSide = "right";
          } else if (targetToRight) {
            outSide = "right";
            inSide = "left";
          } else {
            outSide = "left";
            inSide = "left";
          }
        }
      }
      
      // Target connector determines entry side
      var targetOnSameRow = Math.abs(dy) < nodeHeight * 0.5;
      var targetDirectlyToRight = targetToRight && targetOnSameRow;
      var targetDirectlyToLeft = targetToLeft && targetOnSameRow;
      
      if (outSide === "right" && targetDirectlyToRight) {
        inSide = "left";
      } else if (outSide === "left" && targetDirectlyToLeft) {
        inSide = "right";
      } else if (outSide === "bottom" && targetOnSameRow) {
        if (targetToRight) {
          outSide = "right";
          inSide = "left";
        } else if (targetToLeft) {
          outSide = "left";
          inSide = "right";
        }
      } else if (outSide === "bottom" && sourceToRightOfTarget) {
        inSide = "right";
      } else if (outSide === "bottom" && sourceToLeftOfTarget) {
        inSide = "left";
      } else if (blockingNode) {
        // Keep the inSide we set during blocker detection
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
        if (outSide === "right") {
          if (targetToRight) {
            inSide = "left";
          } else {
            inSide = "top";
          }
        } else if (outSide === "left") {
          if (targetToLeft) {
            inSide = "right";
          } else {
            inSide = "top";
          }
        }
      }
      
      // Handle back edges (target above source)
      var targetAbove = dy < -nodeHeight * 0.3;
      if (targetAbove) {
        if (outSide === "bottom") outSide = "top";
        if ((outSide === "right" || outSide === "left") && inSide === "top") {
          inSide = "bottom";
        }
      }

      return { outSide: outSide, inSide: inSide, blockingNode: blockingNode };
    }
  `;
}
