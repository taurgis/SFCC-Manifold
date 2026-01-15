/**
 * Node layout calculation script (embedded JavaScript)
 */

export function getLayoutScript(): string {
  return `
    /**
     * Calculate node positions using improved hierarchical layout
     * This algorithm:
     * 1. Groups nodes by their full branch path
     * 2. Builds a tree structure of branches
     * 3. Assigns X positions based on branch tree structure
     * 4. Places nodes vertically, avoiding overlaps with a grid
     */
    function calculateLayout(nodes) {
      var placedNodes = [];
      
      try {
        // Build branch tree and collect metadata
        var branchData = buildBranchTree(nodes);
        
        // Assign X positions to branches using tree traversal
        assignBranchPositions(branchData);
        
        // Track occupied grid cells (column, row) -> true
        var occupiedCells = {};
        
        // Place each node
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          var branchInfo = branchData.branches[node.branch];
          var col = branchInfo ? branchInfo.column : 0;
          
          // Get starting row from parent branch's current position
          var startRow = 0;
          var parts = node.branch.split('/');
          if (parts.length > 1) {
            var parentBranch = parts.slice(0, -1).join('/');
            var parentInfo = branchData.branches[parentBranch];
            if (parentInfo && parentInfo.currentRow !== undefined) {
              startRow = parentInfo.currentRow;
            }
          }
          
          // Find the next available row at this column
          var row = branchInfo && branchInfo.currentRow !== undefined ? branchInfo.currentRow : startRow;
          var cellKey = col + ',' + row;
          var attempts = 0;
          
          while (occupiedCells[cellKey] && attempts < 100) {
            row++;
            cellKey = col + ',' + row;
            attempts++;
          }
          
          // Mark cell as occupied
          occupiedCells[cellKey] = true;
          
          // Update branch's current row for next node
          if (branchInfo) {
            branchInfo.currentRow = row + 1;
          }
          
          // Propagate row position up to parent branches
          for (var j = parts.length - 1; j >= 1; j--) {
            var ancestorBranch = parts.slice(0, j).join('/');
            var ancestorInfo = branchData.branches[ancestorBranch];
            if (ancestorInfo) {
              if (ancestorInfo.currentRow === undefined || ancestorInfo.currentRow <= row) {
                ancestorInfo.currentRow = row + 1;
              }
            }
          }
          
          var x = baseX + (col * horizontalGap);
          var y = baseY + (row * verticalGap);
          
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
     * Build a tree structure from branch paths
     */
    function buildBranchTree(nodes) {
      var branches = {};
      var topLevel = [];
      
      // First pass: collect all branches
      for (var i = 0; i < nodes.length; i++) {
        var branch = nodes[i].branch;
        if (!branches[branch]) {
          branches[branch] = {
            path: branch,
            depth: branch.split('/').length - 1,
            children: [],
            nodeCount: 0,
            column: 0,
            currentRow: 0
          };
        }
        branches[branch].nodeCount++;
      }
      
      // Second pass: build parent-child relationships
      for (var branch in branches) {
        var parts = branch.split('/');
        if (parts.length === 1) {
          // Top-level branch
          if (topLevel.indexOf(branch) === -1) {
            topLevel.push(branch);
          }
        } else {
          // Has a parent
          var parentPath = parts.slice(0, -1).join('/');
          
          // Ensure parent exists in our map
          if (!branches[parentPath]) {
            branches[parentPath] = {
              path: parentPath,
              depth: parentPath.split('/').length - 1,
              children: [],
              nodeCount: 0,
              column: 0,
              currentRow: 0
            };
            
            // Check if this parent is top-level
            if (parentPath.indexOf('/') === -1 && topLevel.indexOf(parentPath) === -1) {
              topLevel.push(parentPath);
            }
          }
          
          // Add as child if not already
          if (branches[parentPath].children.indexOf(branch) === -1) {
            branches[parentPath].children.push(branch);
          }
        }
      }
      
      // Sort children for consistent ordering
      for (var branch in branches) {
        branches[branch].children.sort();
      }
      
      return {
        branches: branches,
        topLevel: topLevel
      };
    }

    /**
     * Assign column positions to branches using DFS traversal
     */
    function assignBranchPositions(branchData) {
      var nextColumn = 0;
      var branches = branchData.branches;
      var topLevel = branchData.topLevel;
      
      // Sort top-level branches
      topLevel.sort();
      
      // Process each top-level branch and its descendants
      for (var i = 0; i < topLevel.length; i++) {
        var usedColumns = assignColumnsRecursive(branches, topLevel[i], nextColumn);
        nextColumn = usedColumns.max + 1;
      }
    }

    /**
     * Recursively assign columns, returns {min, max} columns used
     */
    function assignColumnsRecursive(branches, branchPath, startColumn) {
      var branch = branches[branchPath];
      if (!branch) {
        return { min: startColumn, max: startColumn };
      }
      
      var children = branch.children;
      
      if (children.length === 0) {
        // Leaf branch - assign single column
        branch.column = startColumn;
        return { min: startColumn, max: startColumn };
      }
      
      // Has children - assign columns to children first
      var childRanges = [];
      var currentCol = startColumn;
      
      for (var i = 0; i < children.length; i++) {
        var childRange = assignColumnsRecursive(branches, children[i], currentCol);
        childRanges.push(childRange);
        currentCol = childRange.max + 1;
      }
      
      // Place this branch in the center of its children
      var minCol = childRanges[0].min;
      var maxCol = childRanges[childRanges.length - 1].max;
      var centerCol = Math.floor((minCol + maxCol) / 2);
      
      branch.column = centerCol;
      
      return { min: minCol, max: maxCol };
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

