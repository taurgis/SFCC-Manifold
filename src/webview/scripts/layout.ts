/**
 * Node layout calculation script (embedded JavaScript)
 */

export function getLayoutScript(): string {
  return `
    /**
     * Calculate node positions using branch-based column layout
     */
    function calculateLayout(nodes) {
      var placedNodes = [];
      
      try {
        // Group nodes by their top-level branch
        var branchGroups = {};
        var branchOrder = [];
        
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          var topBranch = node.branch.split('/')[0];
          if (!branchGroups[topBranch]) {
            branchGroups[topBranch] = [];
            branchOrder.push(topBranch);
          }
          branchGroups[topBranch].push(node);
        }

        // Assign column index to each top-level branch
        var branchColumns = {};
        for (var i = 0; i < branchOrder.length; i++) {
          branchColumns[branchOrder[i]] = i;
        }

        // Track Y positions and sub-branch offsets
        var columnNextY = {};
        var subBranchOffsets = {};
        
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          var branchParts = node.branch.split('/');
          var topBranch = branchParts[0];
          var columnIndex = branchColumns[topBranch];
          
          // Calculate X position
          var subBranchDepth = branchParts.length - 1;
          var x = baseX + (columnIndex * horizontalGap);
          
          // Offset sub-branches horizontally
          if (subBranchDepth > 0) {
            var subBranchKey = branchParts[0] + '/' + branchParts[1];
            if (subBranchOffsets[subBranchKey] === undefined) {
              var existingOffsets = 0;
              for (var key in subBranchOffsets) {
                if (key.indexOf(topBranch + '/') === 0) {
                  existingOffsets++;
                }
              }
              subBranchOffsets[subBranchKey] = (existingOffsets % 2 === 0) ? 1 : -1;
            }
            x += subBranchOffsets[subBranchKey] * (horizontalGap * 0.5);
          }
          
          // Calculate Y position
          var colKey = node.branch;
          if (columnNextY[colKey] === undefined) {
            if (subBranchDepth > 0) {
              var parentBranch = branchParts.slice(0, branchParts.length - 1).join('/');
              columnNextY[colKey] = (columnNextY[parentBranch] || baseY);
            } else {
              columnNextY[colKey] = baseY;
            }
          }
          
          var y = columnNextY[colKey];
          columnNextY[colKey] = y + verticalGap;
          
          // Advance parent branch Y to prevent overlap
          if (subBranchDepth > 0) {
            var parentKey = branchParts.slice(0, branchParts.length - 1).join('/');
            if (columnNextY[parentKey] === undefined || columnNextY[parentKey] < y + verticalGap) {
              columnNextY[parentKey] = y + verticalGap;
            }
          }
          
          placedNodes.push({
            id: node.id,
            label: node.label,
            type: node.type,
            branch: node.branch,
            attributes: node.attributes || {},
            bindings: node.bindings || [],
            template: node.template || null,
            description: node.description || null,
            x: x,
            y: y
          });
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
