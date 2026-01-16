/**
 * Navigation script for handling cross-pipeline navigation
 */

import type Konva from "konva";
import type { PlacedNode, VSCodeAPI } from "./types";
import { navigateToNode } from "./selection";

// VS Code API
let vscode: VSCodeAPI;

/**
 * Initialize navigation with VS Code API
 */
export function initNavigation(): void {
  vscode = window.acquireVsCodeApi();

  // Handle messages from the extension
  window.addEventListener("message", (event) => {
    const message = event.data;

    switch (message.type) {
      case "navigateToStartNode":
        // Extension is telling us to navigate to a specific start node
        const targetNode = findStartNode(message.startNode);
        if (targetNode && window.pipelineStage && window.pipelineLayer) {
          navigateToNode(
            targetNode.id,
            window.pipelineStage,
            window.pipelineLayer,
            window.placedNodes
          );
          window.drawGridFn?.();
        }
        break;
    }
  });
}

/**
 * Handle double-click on a jump or call node
 */
export function handleNodeDoubleClick(node: PlacedNode): void {
  const targetRef = node.attributes["start-name-ref"];
  if (!targetRef) return;

  const parts = parseTargetReference(targetRef);

  if (parts.pipeline) {
    // Cross-pipeline navigation - send message to extension
    vscode.postMessage({
      type: "navigateToPipeline",
      pipeline: parts.pipeline,
      startNode: parts.startNode,
    });
  } else {
    // Same pipeline navigation - find the start node
    const targetNode = findStartNode(parts.startNode);
    if (targetNode && window.pipelineStage && window.pipelineLayer) {
      navigateToNode(
        targetNode.id,
        window.pipelineStage,
        window.pipelineLayer,
        window.placedNodes
      );
      window.drawGridFn?.();
    }
  }
}

/**
 * Parse a target reference string
 */
function parseTargetReference(
  ref: string
): { pipeline: string | null; startNode: string } {
  const hyphenIndex = ref.indexOf("-");
  if (hyphenIndex > 0) {
    const potentialPipeline = ref.substring(0, hyphenIndex);
    const potentialStartNode = ref.substring(hyphenIndex + 1);

    // Check if this looks like a cross-pipeline reference
    const localStart = findStartNode(ref);
    if (localStart) {
      // Found locally, it's not a cross-pipeline reference
      return { pipeline: null, startNode: ref };
    }

    // Assume it's a cross-pipeline reference
    return { pipeline: potentialPipeline, startNode: potentialStartNode };
  }

  return { pipeline: null, startNode: ref };
}

/**
 * Find a start node by name in the current pipeline
 */
export function findStartNode(startNodeName: string): PlacedNode | null {
  if (!window.placedNodes) return null;

  for (const node of window.placedNodes) {
    if (node.type === "start") {
      const nodeName = node.attributes.name;
      if (nodeName === startNodeName) {
        return node;
      }
    }
  }
  return null;
}
