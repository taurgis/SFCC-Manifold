/**
 * Navigation script for handling cross-pipeline navigation
 * Handles double-click on jump/call nodes to navigate to target
 */

export function getNavigationScript(): string {
  return `
    /**
     * VS Code API for messaging
     */
    var vscode = acquireVsCodeApi();

    /**
     * Handle double-click on a jump or call node
     * Navigates to the target node, either in the same pipeline or a different one
     */
    function handleNodeDoubleClick(node) {
      var targetRef = node.attributes["start-name-ref"];
      if (!targetRef) return;

      // Parse the target reference
      // Format can be: "StartNodeName" (same pipeline) or "PipelineName-StartNodeName" (different pipeline)
      var parts = parseTargetReference(targetRef);
      
      if (parts.pipeline) {
        // Cross-pipeline navigation - send message to extension
        vscode.postMessage({
          type: "navigateToPipeline",
          pipeline: parts.pipeline,
          startNode: parts.startNode
        });
      } else {
        // Same pipeline navigation - find the start node
        var targetNode = findStartNode(parts.startNode);
        if (targetNode) {
          // Use the global navigateToNode function
          navigateToNode(targetNode.id, window.pipelineStage, window.pipelineLayer, window.placedNodes);
          window.drawGridFn();
        }
      }
    }

    /**
     * Parse a target reference string
     * Returns { pipeline: string | null, startNode: string }
     */
    function parseTargetReference(ref) {
      // Check if it contains a pipeline reference (format: Pipeline-StartNode)
      // But be careful - start node names can also contain hyphens
      // The convention is typically PipelineName-StartNodeName
      
      var hyphenIndex = ref.indexOf("-");
      if (hyphenIndex > 0) {
        var potentialPipeline = ref.substring(0, hyphenIndex);
        var potentialStartNode = ref.substring(hyphenIndex + 1);
        
        // Check if this looks like a cross-pipeline reference
        // by seeing if we have a start node with that name in current pipeline
        var localStart = findStartNode(ref);
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
    function findStartNode(startNodeName) {
      for (var i = 0; i < window.placedNodes.length; i++) {
        var node = window.placedNodes[i];
        if (node.type === "start") {
          // Check if this start node's name matches
          var nodeName = node.attributes.name;
          if (nodeName === startNodeName) {
            return node;
          }
        }
      }
      return null;
    }

    /**
     * Handle messages from the extension
     */
    window.addEventListener("message", function(event) {
      var message = event.data;
      
      switch (message.type) {
        case "navigateToStartNode":
          // Extension is telling us to navigate to a specific start node
          var targetNode = findStartNode(message.startNode);
          if (targetNode) {
            navigateToNode(targetNode.id, window.pipelineStage, window.pipelineLayer, window.placedNodes);
            window.drawGridFn();
          }
          break;
      }
    });
  `;
}
