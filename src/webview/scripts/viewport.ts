/**
 * Viewport culling module
 * Optimizes rendering by hiding elements outside the visible area
 */

export function getViewportScript(): string {
  return `
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
  `;
}
