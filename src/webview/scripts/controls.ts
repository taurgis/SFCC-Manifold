/**
 * UI control handlers script (embedded JavaScript)
 */

export function getControlsScript(): string {
  return `
    /**
     * Update zoom level display
     */
    function createUpdateZoomLevel(stage) {
      return function updateZoomLevel() {
        var scale = Math.round(stage.scaleX() * 100);
        document.getElementById("zoomLevel").textContent = scale + "%";
      };
    }

    /**
     * Setup zoom wheel handler
     */
    function setupWheelZoom(stage, drawGrid, updateZoomLevel) {
      stage.on("wheel", function(e) {
        e.evt.preventDefault();
        
        var oldScale = stage.scaleX();
        var pointer = stage.getPointerPosition();
        var mousePointTo = {
          x: (pointer.x - stage.x()) / oldScale,
          y: (pointer.y - stage.y()) / oldScale
        };

        // Use smaller scale factor for wheel/trackpad zooming
        // Trackpads typically send many small deltaY values
        var direction = e.evt.deltaY > 0 ? -1 : 1;
        var newScale = direction > 0 ? oldScale * wheelScaleBy : oldScale / wheelScaleBy;
        newScale = Math.max(minScale, Math.min(maxScale, newScale));

        stage.scale({ x: newScale, y: newScale });

        var newPos = {
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale
        };
        stage.position(newPos);
        
        drawGrid();
        updateZoomLevel();
      });

      stage.on("dragmove", function() {
        drawGrid();
      });
    }

    /**
     * Setup zoom button handlers
     */
    function setupZoomButtons(stage, getContainerRect, drawGrid, updateZoomLevel, bounds) {
      // Zoom in
      document.getElementById("zoomIn").addEventListener("click", function() {
        var containerRect = getContainerRect();
        var oldScale = stage.scaleX();
        var newScale = Math.min(maxScale, oldScale * scaleBy);
        var center = { x: containerRect.width / 2, y: containerRect.height / 2 };
        var mousePointTo = {
          x: (center.x - stage.x()) / oldScale,
          y: (center.y - stage.y()) / oldScale
        };
        stage.scale({ x: newScale, y: newScale });
        stage.position({
          x: center.x - mousePointTo.x * newScale,
          y: center.y - mousePointTo.y * newScale
        });
        drawGrid();
        updateZoomLevel();
      });

      // Zoom out
      document.getElementById("zoomOut").addEventListener("click", function() {
        var containerRect = getContainerRect();
        var oldScale = stage.scaleX();
        var newScale = Math.max(minScale, oldScale / scaleBy);
        var center = { x: containerRect.width / 2, y: containerRect.height / 2 };
        var mousePointTo = {
          x: (center.x - stage.x()) / oldScale,
          y: (center.y - stage.y()) / oldScale
        };
        stage.scale({ x: newScale, y: newScale });
        stage.position({
          x: center.x - mousePointTo.x * newScale,
          y: center.y - mousePointTo.y * newScale
        });
        drawGrid();
        updateZoomLevel();
      });

      // Reset view
      document.getElementById("zoomReset").addEventListener("click", function() {
        stage.scale({ x: 1, y: 1 });
        stage.position({ x: 0, y: 0 });
        drawGrid();
        updateZoomLevel();
      });

      // Fit to view
      document.getElementById("zoomFit").addEventListener("click", function() {
        var containerRect = getContainerRect();
        var padding = 60;
        var scaleX = (containerRect.width - padding * 2) / bounds.maxX;
        var scaleY = (containerRect.height - padding * 2) / bounds.maxY;
        // Clamp between 50% minimum and 100% maximum for fit
        var newScale = Math.max(0.5, Math.min(scaleX, scaleY, 1));
        
        stage.scale({ x: newScale, y: newScale });
        stage.position({
          x: (containerRect.width - bounds.maxX * newScale) / 2,
          y: (containerRect.height - bounds.maxY * newScale) / 2
        });
        drawGrid();
        updateZoomLevel();
      });
    }

    /**
     * Setup sidebar toggle handler
     */
    function setupSidebarToggle(stage, container) {
      var sidebar = document.getElementById("sidebar");
      var toggleBtn = document.getElementById("sidebarToggle");
      var currentContainerRect = container.getBoundingClientRect();

      toggleBtn.addEventListener("click", function() {
        sidebar.classList.toggle("collapsed");
        toggleBtn.classList.toggle("rotated");
      });

      function updateContainerRect() {
        currentContainerRect = container.getBoundingClientRect();
      }

      return {
        getContainerRect: function() {
          return currentContainerRect;
        },
        updateContainerRect: updateContainerRect
      };
    }

    /**
     * Setup resize observer for container
     * Uses ResizeObserver to detect panel resizes in VS Code
     */
    function setupResizeHandler(stage, container, drawGrid, updateContainerRect) {
      var resizeObserver = new ResizeObserver(function(entries) {
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          var rect = entry.contentRect;
          if (rect.width > 0 && rect.height > 0) {
            updateContainerRect();
            stage.width(rect.width);
            stage.height(rect.height);
            drawGrid();
          }
        }
      });
      resizeObserver.observe(container);
    }
  `;
}
