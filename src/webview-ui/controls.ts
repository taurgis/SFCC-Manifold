/**
 * UI control handlers for zoom and floating panels
 */

import type Konva from "konva";
import { ZOOM_CONFIG } from "./constants";
import { updateViewportCulling } from "./viewport";
import { throttle, debounce } from "./utils";
import type { Bounds } from "./types";

const { scaleBy, wheelScaleBy, minScale, maxScale } = ZOOM_CONFIG;

/**
 * Update zoom level display
 */
export function createUpdateZoomLevel(stage: Konva.Stage): () => void {
  return function updateZoomLevel(): void {
    const scale = Math.round(stage.scaleX() * 100);
    const el = document.getElementById("zoomLevel");
    if (el) {
      el.textContent = `${scale}%`;
    }
  };
}

/**
 * Setup zoom wheel handler with viewport culling
 */
export function setupWheelZoom(
  stage: Konva.Stage,
  layer: Konva.Layer,
  drawGrid: () => void,
  updateZoomLevel: () => void
): void {
  // Throttled culling update for smooth performance
  const throttledCulling = throttle(() => {
    updateViewportCulling(stage, layer);
    layer.batchDraw();
  }, 16); // ~60fps

  stage.on("wheel", (e) => {
    e.evt.preventDefault();

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) {return;}

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    let newScale =
      direction > 0 ? oldScale * wheelScaleBy : oldScale / wheelScaleBy;
    newScale = Math.max(minScale, Math.min(maxScale, newScale));

    stage.scale({ x: newScale, y: newScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);

    drawGrid();
    throttledCulling();
    updateZoomLevel();
  });

  // Throttled drag handler for viewport culling
  const throttledDragCulling = throttle(() => {
    updateViewportCulling(stage, layer);
    layer.batchDraw();
  }, 32); // ~30fps during drag

  stage.on("dragmove", () => {
    drawGrid();
    throttledDragCulling();
  });
}

/**
 * Setup zoom button handlers with viewport culling
 */
export function setupZoomButtons(
  stage: Konva.Stage,
  layer: Konva.Layer,
  getContainerRect: () => DOMRect,
  drawGrid: () => void,
  updateZoomLevel: () => void,
  bounds: Bounds
): void {
  // Zoom in
  document.getElementById("zoomIn")?.addEventListener("click", () => {
    const containerRect = getContainerRect();
    const oldScale = stage.scaleX();
    const newScale = Math.min(maxScale, oldScale * scaleBy);
    const center = { x: containerRect.width / 2, y: containerRect.height / 2 };
    const mousePointTo = {
      x: (center.x - stage.x()) / oldScale,
      y: (center.y - stage.y()) / oldScale,
    };
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: center.x - mousePointTo.x * newScale,
      y: center.y - mousePointTo.y * newScale,
    });
    drawGrid();
    updateViewportCulling(stage, layer);
    layer.batchDraw();
    updateZoomLevel();
  });

  // Zoom out
  document.getElementById("zoomOut")?.addEventListener("click", () => {
    const containerRect = getContainerRect();
    const oldScale = stage.scaleX();
    const newScale = Math.max(minScale, oldScale / scaleBy);
    const center = { x: containerRect.width / 2, y: containerRect.height / 2 };
    const mousePointTo = {
      x: (center.x - stage.x()) / oldScale,
      y: (center.y - stage.y()) / oldScale,
    };
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: center.x - mousePointTo.x * newScale,
      y: center.y - mousePointTo.y * newScale,
    });
    drawGrid();
    updateViewportCulling(stage, layer);
    layer.batchDraw();
    updateZoomLevel();
  });

  // Reset view
  document.getElementById("zoomReset")?.addEventListener("click", () => {
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    drawGrid();
    updateViewportCulling(stage, layer);
    layer.batchDraw();
    updateZoomLevel();
  });

  // Fit to view
  document.getElementById("zoomFit")?.addEventListener("click", () => {
    const containerRect = getContainerRect();
    const padding = 60;
    const scaleX = (containerRect.width - padding * 2) / bounds.maxX;
    const scaleY = (containerRect.height - padding * 2) / bounds.maxY;
    const newScale = Math.max(0.5, Math.min(scaleX, scaleY, 1));

    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: (containerRect.width - bounds.maxX * newScale) / 2,
      y: (containerRect.height - bounds.maxY * newScale) / 2,
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
export function setupFloatingPanels(): void {
  const infoPanel = document.getElementById("infoPanel");
  const legendPanel = document.getElementById("legendPanel");
  const infoToggle = document.getElementById("infoToggle");
  const legendToggle = document.getElementById("legendToggle");
  const infoPanelClose = document.getElementById("infoPanelClose");
  const legendPanelClose = document.getElementById("legendPanelClose");

  if (
    !infoPanel ||
    !legendPanel ||
    !infoToggle ||
    !legendToggle ||
    !infoPanelClose ||
    !legendPanelClose
  ) {
    return;
  }

  function closeAllPanels(): void {
    if (infoPanel) {infoPanel.classList.remove("visible");}
    if (legendPanel) {legendPanel.classList.remove("visible");}
    if (infoToggle) {infoToggle.classList.remove("active");}
    if (legendToggle) {legendToggle.classList.remove("active");}
  }

  function togglePanel(
    panel: HTMLElement,
    toggle: HTMLElement,
    otherPanel: HTMLElement,
    otherToggle: HTMLElement
  ): void {
    const isVisible = panel.classList.contains("visible");

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

  infoToggle.addEventListener("click", () => {
    togglePanel(infoPanel, infoToggle, legendPanel, legendToggle);
  });

  legendToggle.addEventListener("click", () => {
    togglePanel(legendPanel, legendToggle, infoPanel, infoToggle);
  });

  infoPanelClose.addEventListener("click", () => {
    infoPanel.classList.remove("visible");
    infoToggle.classList.remove("active");
  });

  legendPanelClose.addEventListener("click", () => {
    legendPanel.classList.remove("visible");
    legendToggle.classList.remove("active");
  });

  // Close panels on escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllPanels();
    }
  });

  // Close panels when clicking outside
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const isInsidePanel =
      infoPanel.contains(target) || legendPanel.contains(target);
    const isToggleBtn =
      infoToggle.contains(target) || legendToggle.contains(target);

    if (!isInsidePanel && !isToggleBtn) {
      closeAllPanels();
    }
  });
}

/**
 * Setup container rect tracking for zoom operations
 */
export function setupContainerTracking(container: HTMLElement): {
  getContainerRect: () => DOMRect;
  updateContainerRect: () => void;
} {
  let currentContainerRect = container.getBoundingClientRect();

  function updateContainerRect(): void {
    currentContainerRect = container.getBoundingClientRect();
  }

  return {
    getContainerRect: () => currentContainerRect,
    updateContainerRect,
  };
}

/**
 * Setup resize observer for container
 */
export function setupResizeHandler(
  stage: Konva.Stage,
  container: HTMLElement,
  layer: Konva.Layer,
  drawGrid: () => void,
  updateContainerRect: () => void
): void {
  const debouncedCulling = debounce(() => {
    updateViewportCulling(stage, layer);
    layer.batchDraw();
  }, 100);

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const rect = entry.contentRect;
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
