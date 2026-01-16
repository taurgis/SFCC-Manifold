/**
 * UI control handlers script (embedded JavaScript)
 */

export function getControlsScript(): string {
  return `
    /**
     * Debounce helper for performance-critical operations
     */
    function debounce(func, wait) {
      var timeout = null;
      return function() {
        var context = this;
        var args = arguments;
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(function() {
          func.apply(context, args);
        }, wait);
      };
    }

    /**
     * Throttle helper for continuous events like drag/zoom
     */
    function throttle(func, limit) {
      var inThrottle = false;
      var lastArgs = null;
      return function() {
        var context = this;
        var args = arguments;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(function() {
            inThrottle = false;
            if (lastArgs) {
              func.apply(context, lastArgs);
              lastArgs = null;
            }
          }, limit);
        } else {
          lastArgs = args;
        }
      };
    }

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
     * Setup zoom wheel handler with viewport culling
     */
    function setupWheelZoom(stage, layer, drawGrid, updateZoomLevel) {
      // Throttled culling update for smooth performance
      var throttledCulling = throttle(function() {
        updateViewportCulling(stage, layer);
        layer.batchDraw();
      }, 16); // ~60fps

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
        throttledCulling();
        updateZoomLevel();
      });

      // Throttled drag handler for viewport culling
      var throttledDragCulling = throttle(function() {
        updateViewportCulling(stage, layer);
        layer.batchDraw();
      }, 32); // ~30fps during drag for better performance

      stage.on("dragmove", function() {
        drawGrid();
        throttledDragCulling();
      });
    }

    /**
     * Setup zoom button handlers with viewport culling
     */
    function setupZoomButtons(stage, layer, getContainerRect, drawGrid, updateZoomLevel, bounds) {
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
        updateViewportCulling(stage, layer);
        layer.batchDraw();
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
        updateViewportCulling(stage, layer);
        layer.batchDraw();
        updateZoomLevel();
      });

      // Reset view
      document.getElementById("zoomReset").addEventListener("click", function() {
        stage.scale({ x: 1, y: 1 });
        stage.position({ x: 0, y: 0 });
        drawGrid();
        updateViewportCulling(stage, layer);
        layer.batchDraw();
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
        updateViewportCulling(stage, layer);
        layer.batchDraw();
        updateZoomLevel();
      });
    }

    /**
     * Setup floating panels (info and legend)
     */
    function setupFloatingPanels() {
      var infoPanel = document.getElementById("infoPanel");
      var legendPanel = document.getElementById("legendPanel");
      var infoToggle = document.getElementById("infoToggle");
      var legendToggle = document.getElementById("legendToggle");
      var infoPanelClose = document.getElementById("infoPanelClose");
      var legendPanelClose = document.getElementById("legendPanelClose");

      function closeAllPanels() {
        infoPanel.classList.remove("visible");
        legendPanel.classList.remove("visible");
        infoToggle.classList.remove("active");
        legendToggle.classList.remove("active");
      }

      function togglePanel(panel, toggle, otherPanel, otherToggle) {
        var isVisible = panel.classList.contains("visible");
        
        // Close other panel first
        otherPanel.classList.remove("visible");
        otherToggle.classList.remove("active");
        
        if (isVisible) {
          panel.classList.remove("visible");
          toggle.classList.remove("active");
        } else {
          panel.classList.add("visible");
          toggle.classList.add("active");
        }
      }

      infoToggle.addEventListener("click", function() {
        togglePanel(infoPanel, infoToggle, legendPanel, legendToggle);
      });

      legendToggle.addEventListener("click", function() {
        togglePanel(legendPanel, legendToggle, infoPanel, infoToggle);
      });

      infoPanelClose.addEventListener("click", function() {
        infoPanel.classList.remove("visible");
        infoToggle.classList.remove("active");
      });

      legendPanelClose.addEventListener("click", function() {
        legendPanel.classList.remove("visible");
        legendToggle.classList.remove("active");
      });

      // Close panels on escape
      document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
          closeAllPanels();
        }
      });

      // Close panels when clicking outside
      document.addEventListener("click", function(e) {
        var target = e.target;
        var isInsidePanel = infoPanel.contains(target) || legendPanel.contains(target);
        var isToggleBtn = infoToggle.contains(target) || legendToggle.contains(target);
        
        if (!isInsidePanel && !isToggleBtn) {
          closeAllPanels();
        }
      });
    }

    /**
     * Setup container rect tracking for zoom operations
     */
    function setupContainerTracking(container) {
      var currentContainerRect = container.getBoundingClientRect();

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
    function setupResizeHandler(stage, container, layer, drawGrid, updateContainerRect) {
      // Debounce resize culling to avoid excessive updates
      var debouncedCulling = debounce(function() {
        updateViewportCulling(stage, layer);
        layer.batchDraw();
      }, 100);

      var resizeObserver = new ResizeObserver(function(entries) {
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          var rect = entry.contentRect;
          if (rect.width > 0 && rect.height > 0) {
            updateContainerRect();
            stage.width(rect.width);
            stage.height(rect.height);
            drawGrid();
            debouncedCulling();
          }
        }
      });
      resizeObserver.observe(container);
    }
  `;
}
