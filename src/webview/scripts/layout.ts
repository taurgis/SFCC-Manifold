/**
 * Node layout calculation script (embedded JavaScript)
 * 
 * This module implements layout logic that mirrors the SFCC pipeline editor.
 * Key insights from the XML format:
 * 
 * 1. The `node-display` element contains x, y coordinates in GRID units (not pixels)
 * 2. Start nodes and first nodes in top-level branches use ABSOLUTE grid positions
 * 3. Subsequent nodes within a segment use RELATIVE positions from the previous node
 * 4. Nested branch nodes use RELATIVE positions from the parent (branch-off) node
 * 5. The `orientation="horizontal"` attribute indicates a node flowing horizontally
 * 
 * Grid coordinate system:
 * - x=0 means same column as previous node
 * - x=1 means one column to the right
 * - x=-1 means one column to the left
 * - y=0 means same row as previous node  
 * - y=1 means one row below
 * - y=-1 means one row above
 */

export function getLayoutScript(): string {
  return `
    /**
     * Calculate node positions using XML grid coordinates
     * This faithfully reproduces the legacy SFCC pipeline editor positioning.
     */
    function calculateLayout(nodes) {
      var placedNodes = [];
      
      try {
        // Track absolute grid positions for each node
        var nodeGridPositions = {}; // nodeId -> {gridX, gridY}
        var occupiedCells = {}; // "gridX,gridY" -> true
        
        // First pass: identify top-level branches (those without '/' in the branch path)
        var topLevelBranches = {};
        for (var i = 0; i < nodes.length; i++) {
          var branch = nodes[i].branch;
          if (branch.indexOf('/') === -1) {
            topLevelBranches[branch] = true;
          }
        }
        
        // Process all nodes
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          var pos = node.position;
          
          // Determine the absolute grid position
          var gridX, gridY;
          
          // Check if this is the first node in its branch (ever)
          var isFirstInBranch = isFirstNodeInBranch(node.id, nodes, i);
          var isTopLevelBranch = topLevelBranches[node.branch];
          var isNestedBranch = !isTopLevelBranch;
          
          // Get XML position values (default to 0)
          var xmlX = (pos && pos.x !== undefined) ? pos.x : 0;
          var xmlY = (pos && pos.y !== undefined) ? pos.y : 1;
          
          if (isFirstInBranch && isTopLevelBranch) {
            // First node in a top-level branch: use ABSOLUTE positioning
            gridX = xmlX;
            gridY = xmlY;
          } else if (isFirstInBranch && isNestedBranch) {
            // First node in a nested branch: RELATIVE to parent branch node
            var parentPos = findParentNodePosition(node, nodeGridPositions, nodes, i);
            if (parentPos) {
              gridX = parentPos.gridX + xmlX;
              gridY = parentPos.gridY + xmlY;
            } else {
              // Fallback: use absolute positioning
              gridX = xmlX;
              gridY = xmlY;
            }
          } else {
            // Subsequent node in any branch: RELATIVE to previous node in same branch
            var prevPos = findPreviousNodePosition(node, nodeGridPositions, nodes, i);
            if (prevPos) {
              gridX = prevPos.gridX + xmlX;
              gridY = prevPos.gridY + xmlY;
            } else {
              // Fallback: use absolute positioning
              gridX = xmlX;
              gridY = xmlY;
            }
          }
          
          // Store the computed position
          nodeGridPositions[node.id] = { gridX: gridX, gridY: gridY };
          
          // Mark cell as occupied (for debugging, not used for collision avoidance here)
          var cellKey = gridX + ',' + gridY;
          occupiedCells[cellKey] = true;
          
          placedNodes.push({
            id: node.id,
            label: node.label,
            type: node.type,
            branch: node.branch,
            attributes: node.attributes || {},
            bindings: node.bindings || [],
            template: node.template || null,
            description: node.description || null,
            orientation: (pos ? pos.orientation : null),
            gridX: gridX,
            gridY: gridY
          });
        }
        
        // Find minimum grid coordinates (some may be negative due to relative positioning)
        var minGridX = 0, minGridY = 0;
        for (var i = 0; i < placedNodes.length; i++) {
          if (placedNodes[i].gridX < minGridX) minGridX = placedNodes[i].gridX;
          if (placedNodes[i].gridY < minGridY) minGridY = placedNodes[i].gridY;
        }
        
        // Convert grid coordinates to pixel coordinates, normalizing to ensure all positions are positive
        for (var i = 0; i < placedNodes.length; i++) {
          var n = placedNodes[i];
          n.x = baseX + ((n.gridX - minGridX) * horizontalGap);
          n.y = baseY + ((n.gridY - minGridY) * verticalGap);
          // Clean up temporary properties
          delete n.gridX;
          delete n.gridY;
        }
        
      } catch (e) {
        console.error("Layout error:", e);
        // Fallback to simple grid layout
        placedNodes = [];
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          placedNodes.push({
            id: node.id,
            label: node.label,
            type: node.type,
            branch: node.branch,
            attributes: node.attributes || {},
            bindings: node.bindings || [],
            template: node.template || null,
            description: node.description || null,
            x: baseX + (i % 5) * horizontalGap,
            y: baseY + Math.floor(i / 5) * verticalGap
          });
        }
      }
      
      return placedNodes;
    }
    
    /**
     * Check if this is the first node encountered in its branch
     */
    function isFirstNodeInBranch(nodeId, allNodes, currentIndex) {
      // Use the branch property from the node, not parsed from ID
      var currentNode = allNodes[currentIndex];
      var branchPath = currentNode.branch;
      
      for (var i = 0; i < currentIndex; i++) {
        if (allNodes[i].branch === branchPath) {
          return false;
        }
      }
      return true;
    }
    
    /**
     * Find the position of the parent branch's node (the one that spawned this branch)
     * Branch format: "ParentBranch:segmentIndex:nodeIndex/branchBasename"
     * e.g., "Show:0:3/b2" means the parent node is "Show:0:3" in branch "Show"
     */
    function findParentNodePosition(node, nodeGridPositions, allNodes, currentIndex) {
      var branch = node.branch;
      var slashIndex = branch.lastIndexOf('/');
      if (slashIndex === -1) return null;
      
      // The part before the last '/' contains the parent node's ID
      // e.g., for "Show:0:3/b2", parentNodeId is "Show:0:3"
      var parentNodeId = branch.substring(0, slashIndex);
      
      // Look for this exact node ID
      var pos = nodeGridPositions[parentNodeId];
      if (pos) return pos;
      
      // If not found by exact ID, try to find by branch matching
      // Extract parent branch (everything before the last segment:index part)
      var lastColonBeforeSlash = parentNodeId.lastIndexOf(':');
      if (lastColonBeforeSlash > 0) {
        var secondLastColon = parentNodeId.lastIndexOf(':', lastColonBeforeSlash - 1);
        if (secondLastColon > 0) {
          var parentBranch = parentNodeId.substring(0, secondLastColon);
          // Look backwards for the most recent node in the parent branch
          for (var i = currentIndex - 1; i >= 0; i--) {
            var otherNode = allNodes[i];
            if (otherNode.id === parentNodeId) {
              var pos = nodeGridPositions[otherNode.id];
              if (pos) return pos;
            }
          }
        }
      }
      
      // Fallback: look for any node whose ID matches the parent path
      for (var i = currentIndex - 1; i >= 0; i--) {
        if (allNodes[i].id === parentNodeId) {
          var pos = nodeGridPositions[allNodes[i].id];
          if (pos) return pos;
        }
      }
      
      return null;
    }
    
    /**
     * Find the position of the previous node in the same branch
     */
    function findPreviousNodePosition(node, nodeGridPositions, allNodes, currentIndex) {
      // Look for the most recent node in the same branch
      for (var i = currentIndex - 1; i >= 0; i--) {
        if (allNodes[i].branch === node.branch) {
          var pos = nodeGridPositions[allNodes[i].id];
          if (pos) return pos;
        }
      }
      return null;
    }

    /**
     * Build a lookup map from node ID to node data
     */
    function buildNodeMap(placedNodes) {
      var nodeMap = {};
      for (var i = 0; i < placedNodes.length; i++) {
        nodeMap[placedNodes[i].id] = placedNodes[i];
      }
      return nodeMap;
    }

    /**
     * Calculate canvas bounds based on placed nodes
     */
    function calculateBounds(placedNodes) {
      var maxX = baseX;
      var maxY = baseY;
      
      for (var i = 0; i < placedNodes.length; i++) {
        var n = placedNodes[i];
        if (n.x + nodeWidth > maxX) maxX = n.x + nodeWidth;
        if (n.y + nodeHeight > maxY) maxY = n.y + nodeHeight;
      }
      
      return {
        maxX: maxX + horizontalGap,
        maxY: maxY + verticalGap
      };
    }
  `;
}

