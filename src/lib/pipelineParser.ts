import { DOMParser } from "@xmldom/xmldom";
import { KeyBinding, ParsedPipeline, PipelineEdge, PipelineNode, PipelineNodeType, TemplateConfig } from "./types";

/**
 * Represents a deferred edge that uses a relative target-path
 */
interface DeferredEdge {
  fromNodeId: string;
  targetPath: string;
  label?: string;
  /** The branch path where this edge was defined (used for relative resolution) */
  contextBranchPath: string;
  /** The parent node ID that owns the branch containing this deferred edge */
  parentNodeId?: string;
  /** The segment index within the branch */
  segmentIndex: number;
}

export function parsePipeline(xml: string, sourceName = "pipeline.xml"): ParsedPipeline {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const pipelineEl = doc.getElementsByTagName("pipeline").item(0);

  if (!pipelineEl) {
    throw new Error("Missing <pipeline> root element");
  }

  const pipelineName = pipelineEl.getAttribute("name") || stripExtension(sourceName);
  const group = pipelineEl.getAttribute("group") || undefined;
  const type = pipelineEl.getAttribute("type") || undefined;
  const description = readFirstChildText(pipelineEl, "description");

  const nodes: PipelineNode[] = [];
  const edges: PipelineEdge[] = [];
  const deferredEdges: DeferredEdge[] = [];
  
  /** Map branch paths to their segment node sequences for resolving relative paths */
  const branchNodeSequences: Map<string, string[][]> = new Map();
  
  /** Map branch paths to their parent node ID (the node that contains the nested branch) */
  const branchParentNodes: Map<string, string> = new Map();

  let branchOrdinal = 0;
  for (const branchEl of getElementChildren(pipelineEl, "branch")) {
    const path = branchEl.getAttribute("basename") || `branch-${branchOrdinal++}`;
    parseBranchWithEntry(branchEl, path);
  }

  // Resolve deferred edges after all nodes are parsed
  resolveDeferredEdges();

  return { name: pipelineName, group, type, description, nodes, edges };

  function parseBranchWithEntry(
    branchEl: Element,
    branchPath: string,
    parentLoopNodeId?: string,
    isDoLoop = false,
    ownerNodeId?: string
  ): { entryIds: string[]; lastNodeIds: string[] } {
    const entryIds: string[] = [];
    const lastNodeIds: string[] = [];
    let segmentIndex = 0;
    let previousSegmentLastNodeId: string | undefined;

    const segments = getElementChildren(branchEl, "segment");
    
    // Initialize storage for this branch's node sequences
    const segmentSequences: string[][] = [];
    branchNodeSequences.set(branchPath, segmentSequences);
    
    // Track the parent node for this branch (used for ../+1 resolution)
    if (ownerNodeId) {
      branchParentNodes.set(branchPath, ownerNodeId);
    }
    
    for (const segmentEl of segments) {
      const result = parseSegment(segmentEl, branchPath, segmentIndex, parentLoopNodeId, ownerNodeId);
      segmentIndex++;
      
      // Store the node sequence for this segment
      segmentSequences.push(result.nodeIds);
      
      // For do-loops, only the first segment is an entry point
      // Subsequent segments should be connected from the previous segment
      if (isDoLoop) {
        if (entryIds.length === 0 && result.firstNodeId) {
          entryIds.push(result.firstNodeId);
        } else if (previousSegmentLastNodeId && result.firstNodeId) {
          // Connect previous segment's last node to this segment's first node
          edges.push({ from: previousSegmentLastNodeId, to: result.firstNodeId });
        }
      } else {
        if (result.firstNodeId) {
          entryIds.push(result.firstNodeId);
        }
      }
      
      previousSegmentLastNodeId = result.lastNodeId;
      if (result.lastNodeId) {
        lastNodeIds.push(result.lastNodeId);
      }
    }

    return { entryIds, lastNodeIds };
  }

  function parseSegment(
    segmentEl: Element,
    branchPath: string,
    segmentIndex: number,
    parentLoopNodeId?: string,
    ownerNodeId?: string
  ) {
    let lastNodeId: string | undefined;
    let firstNodeId: string | undefined;
    let pendingLabel: string | undefined;
    let nodeIndex = 0;
    const nodeIds: string[] = [];

    for (const child of getElementChildren(segmentEl)) {
      if (child.tagName === "node") {
        const parsed = parseNode(child, branchPath, segmentIndex, nodeIndex++);

        if (!firstNodeId) {
          firstNodeId = parsed.id;
        }

        if (lastNodeId) {
          edges.push({ from: lastNodeId, to: parsed.id, label: pendingLabel });
        }

        nodeIds.push(parsed.id);
        lastNodeId = parsed.id;
        pendingLabel = undefined;
      } else if (child.tagName === "simple-transition" || child.tagName === "transition") {
        const label = deriveTransitionLabel(child);
        const targetConnector = child.getAttribute("target-connector");
        const targetPath = child.getAttribute("target-path");

        // Check if this is a loop back-edge (transition back to parent loop node)
        if (targetConnector === "loop" && targetPath && parentLoopNodeId && lastNodeId) {
          edges.push({ from: lastNodeId, to: parentLoopNodeId, label: "loop" });
          pendingLabel = undefined;
        } else if (targetPath && lastNodeId) {
          // This is a relative path transition - defer resolution until all nodes are parsed
          deferredEdges.push({
            fromNodeId: lastNodeId,
            targetPath,
            label,
            contextBranchPath: branchPath,
            parentNodeId: ownerNodeId,
            segmentIndex
          });
          pendingLabel = undefined;
        } else {
          pendingLabel = label;
        }
      }
    }

    return { firstNodeId, lastNodeId, nodeIds };
  }

  function parseNode(nodeEl: Element, branchPath: string, segmentIndex: number, nodeIndex: number): PipelineNode {
    const typeEl = findFirstElement(nodeEl, (el) => el.tagName !== "node-display" && el.tagName !== "branch");
    const displayEl = findFirstElement(nodeEl, (el) => el.tagName === "node-display");

    const position = displayEl
      ? {
          x: readNumberAttr(displayEl, "x"),
          y: readNumberAttr(displayEl, "y"),
          width: readNumberAttr(displayEl, "width"),
          orientation: displayEl.getAttribute("orientation") || undefined,
        }
      : undefined;

    const id = `${branchPath}:${segmentIndex}:${nodeIndex}`;
    const { type, label, attributes, bindings, template, description } = describeNode(typeEl);

    const parsedNode: PipelineNode = {
      id,
      label,
      type,
      branch: branchPath,
      attributes,
      bindings,
      template,
      description,
      position,
    };

    nodes.push(parsedNode);

    // Determine if this is a loop node (for back-edge tracking)
    const isLoopNode = type === "loop";

    for (const nestedBranch of getElementChildren(nodeEl, "branch")) {
      const connectorLabel =
        nestedBranch.getAttribute("source-connector") ||
        nestedBranch.getAttribute("target-connector") ||
        nestedBranch.getAttribute("basename") ||
        "branch";

      const nestedPath = `${branchPath}/${nestedBranch.getAttribute("basename") || connectorLabel}`;
      
      // Determine if this is a "do" branch from a loop node
      const isDoLoop = isLoopNode && connectorLabel === "do";
      
      // Pass loop node ID if this is a loop node, so back-edges can reference it
      // Also pass this node's ID as the owner, for resolving ../+1 style paths
      const branchResult = parseBranchWithEntry(
        nestedBranch,
        nestedPath,
        isLoopNode ? id : undefined,
        isDoLoop,
        id  // This node owns the nested branch
      );

      for (const entry of branchResult.entryIds) {
        edges.push({ from: id, to: entry, label: connectorLabel });
      }
    }

    return parsedNode;
  }

  function describeNode(typeEl: Element | undefined): {
    type: PipelineNodeType;
    label: string;
    attributes: Record<string, string | undefined>;
    bindings?: KeyBinding[];
    template?: TemplateConfig;
    description?: string;
  } {
    if (!typeEl) {
      return { type: "unknown", label: "Unknown", attributes: {} };
    }

    const attrs = collectAttributes(typeEl);

    switch (typeEl.tagName) {
      case "start-node": {
        const name = attrs.name ? ` ${attrs.name}` : "";
        return { type: "start", label: `Start${name}`.trim(), attributes: attrs };
      }
      case "end-node": {
        const name = attrs.name ? ` ${attrs.name}` : "";
        return { type: "end", label: `End${name}`.trim(), attributes: attrs };
      }
      case "pipelet-node": {
        const pipeletName = attrs["pipelet-name"] || "Pipelet";
        const bindings = extractKeyBindings(typeEl);
        return { type: "pipelet", label: pipeletName, attributes: attrs, bindings };
      }
      case "call-node": {
        const target = attrs["start-name-ref"] || "Call";
        return { type: "call", label: `Call ${target}`, attributes: attrs };
      }
      case "jump-node": {
        const target = attrs["start-name-ref"] || "Jump";
        return { type: "jump", label: `Jump ${target}`, attributes: attrs };
      }
      case "interaction-node": {
        const templateEl = findFirstElement(typeEl, (el) => el.tagName === "template");
        const templateName = templateEl?.getAttribute("name") || "Interaction";
        const template = templateEl ? extractTemplateConfig(templateEl) : undefined;
        return { type: "interaction", label: templateName, attributes: attrs, template };
      }
      case "decision-node": {
        const condition = attrs["condition-key"];
        const label = condition ? `Decision ${truncate(condition, 50)}` : "Decision";
        return { type: "decision", label, attributes: attrs };
      }
      case "join-node": {
        return { type: "join", label: "Join", attributes: attrs };
      }
      case "loop-node": {
        const loopLabel = attrs["iterator-key"] || "Loop";
        const bindings = extractKeyBindings(typeEl);
        return { type: "loop", label: `Loop ${loopLabel}`, attributes: attrs, bindings };
      }
      case "text-node": {
        const text = readFirstChildText(typeEl, "description") || "Text";
        const label = truncate(text, 60);
        return { type: "text", label, attributes: attrs, description: text };
      }
      default: {
        return { type: "unknown", label: typeEl.tagName, attributes: attrs };
      }
    }
  }

  /**
   * Resolve deferred edges that use relative target-path syntax
   * Paths like:
   * - "./+1" means next node in the same branch/segment
   * - "../+1" means next node in the parent branch/segment
   * - "../b2.1" means a specific node reference
   */
  function resolveDeferredEdges() {
    for (const deferred of deferredEdges) {
      const targetNodeId = resolveTargetPath(deferred);
      if (targetNodeId) {
        edges.push({
          from: deferred.fromNodeId,
          to: targetNodeId,
          label: deferred.label
        });
      }
    }
  }

  /**
   * Resolve a relative target-path to an actual node ID
   * 
   * Path patterns:
   * - "./+N" - same branch, N nodes forward in same segment
   * - "./-N" - same branch, N nodes backward in same segment
   * - "../+N" - parent branch, N nodes after parent node
   * - "../../+N" - grandparent branch, N nodes after grandparent
   * - "../../../+N" - great-grandparent, etc.
   * - "../bX.Y" - parent branch, navigate to branch bX, node Y
   * - "../../bX.Y/bZ.W" - grandparent, complex navigation
   */
  function resolveTargetPath(deferred: DeferredEdge): string | undefined {
    const { targetPath, contextBranchPath, fromNodeId, segmentIndex } = deferred;
    
    // Parse the from node ID to get context: branch:segment:node
    const fromParts = fromNodeId.split(":");
    const fromNodeIndex = parseInt(fromParts[fromParts.length - 1], 10);

    // Count how many levels up we need to go
    let path = targetPath;
    let levels = 0;
    
    while (path.startsWith("../")) {
      levels++;
      path = path.slice(3);
    }
    
    // Handle same-level references
    if (levels === 0) {
      if (path.startsWith("./+")) {
        const offset = parseInt(path.slice(3), 10);
        return findNodeAtOffset(contextBranchPath, segmentIndex, fromNodeIndex, offset);
      } else if (path.startsWith("./-")) {
        const offset = -parseInt(path.slice(3), 10);
        return findNodeAtOffset(contextBranchPath, segmentIndex, fromNodeIndex, offset);
      }
      return undefined;
    }
    
    // Navigate up the branch hierarchy
    let currentBranch = contextBranchPath;
    let parentNodeId: string | undefined;
    
    for (let i = 0; i < levels; i++) {
      parentNodeId = branchParentNodes.get(currentBranch);
      const lastSlash = currentBranch.lastIndexOf("/");
      if (lastSlash === -1) {
        // Can't go up any further
        return undefined;
      }
      currentBranch = currentBranch.slice(0, lastSlash);
    }
    
    // Now handle the remaining path
    if (path.startsWith("+") || path.startsWith("-")) {
      // Relative offset from the ancestor node (e.g., "+1", "+2", "-1")
      const offset = parseInt(path, 10);
      if (parentNodeId) {
        return findNodeRelativeToGivenParent(parentNodeId, offset);
      }
      return undefined;
    } else if (path.length > 0) {
      // Branch reference (e.g., "b2.1" or "b9.1/b2.1")
      return findNodeByBranchRefFromBase(currentBranch, path);
    } else {
      // Just "../.." with nothing after - this typically means the parent node itself
      return parentNodeId;
    }
  }

  /**
   * Find node at a relative offset within the same branch/segment
   */
  function findNodeAtOffset(branch: string, segment: number, nodeIndex: number, offset: number): string | undefined {
    const sequences = branchNodeSequences.get(branch);
    if (!sequences || !sequences[segment]) {
      return undefined;
    }

    const targetIndex = nodeIndex + offset;
    const nodeIds = sequences[segment];
    
    if (targetIndex >= 0 && targetIndex < nodeIds.length) {
      return nodeIds[targetIndex];
    }
    
    return undefined;
  }

  /**
   * Find node relative to a given parent node ID
   * Used when we've navigated up the hierarchy and have the specific parent
   */
  function findNodeRelativeToGivenParent(parentNodeId: string, offset: number): string | undefined {
    // Parse parent node ID to get its position: branch:segment:node
    const parentParts = parentNodeId.split(":");
    const parentNodeIndex = parseInt(parentParts[parentParts.length - 1], 10);
    const parentSegmentIndex = parseInt(parentParts[parentParts.length - 2], 10);
    const parentBranch = parentParts.slice(0, -2).join(":");
    
    // Get the parent branch's node sequences
    const sequences = branchNodeSequences.get(parentBranch);
    if (!sequences || !sequences[parentSegmentIndex]) {
      return undefined;
    }
    
    const parentSegment = sequences[parentSegmentIndex];
    const targetIndex = parentNodeIndex + offset;
    
    if (targetIndex >= 0 && targetIndex < parentSegment.length) {
      return parentSegment[targetIndex];
    }
    
    return undefined;
  }

  /**
   * Find node by branch reference starting from a base branch path
   * e.g., base="SomeBranch", ref="b2.1/b3.2" means navigate to SomeBranch/b2, node 1, then /b3, node 2
   */
  function findNodeByBranchRefFromBase(baseBranch: string, refPath: string): string | undefined {
    const parts = refPath.split("/");
    let currentBranch = baseBranch;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const dotIndex = part.lastIndexOf(".");
      
      if (dotIndex === -1) {
        // Just a branch reference like "b2", navigate to it
        currentBranch = `${currentBranch}/${part}`;
      } else {
        // Branch.nodeIndex reference like "b2.1"
        const branchName = part.slice(0, dotIndex);
        const nodePos = parseInt(part.slice(dotIndex + 1), 10);
        
        const fullBranchPath = `${currentBranch}/${branchName}`;
        const sequences = branchNodeSequences.get(fullBranchPath);
        
        if (i < parts.length - 1) {
          // Not the last part, so we need to navigate into this branch's node
          // and use it as the base for the next part
          currentBranch = fullBranchPath;
          // Note: The next part will reference a branch from within this node
        } else {
          // Last part - find the actual node
          if (sequences) {
            // nodePos typically refers to position within the first segment (0-indexed)
            const firstSegment = sequences[0];
            if (firstSegment && nodePos >= 0 && nodePos < firstSegment.length) {
              return firstSegment[nodePos];
            }
          }
          
          // Try fallback: the position might be a segment index
          if (sequences && sequences[nodePos]) {
            return sequences[nodePos][0];
          }
        }
      }
    }
    
    return undefined;
  }

  /**
   * Find node relative to the parent node (for ../+N patterns)
   * This finds the Nth sibling after the parent node in the parent's segment
   */
  function findNodeRelativeToParent(childBranch: string, parentNodeId: string | undefined, offset: number): string | undefined {
    if (!parentNodeId) {
      // No direct parent tracked, try to resolve via branch hierarchy
      return findNodeInParentBranchFallback(childBranch, offset);
    }

    return findNodeRelativeToGivenParent(parentNodeId, offset);
  }

  /**
   * Fallback for finding parent branch node when no direct parent is tracked
   */
  function findNodeInParentBranchFallback(childBranch: string, offset: number): string | undefined {
    // Get parent branch path
    const lastSlash = childBranch.lastIndexOf("/");
    if (lastSlash === -1) {
      return undefined;
    }
    
    const parentBranch = childBranch.slice(0, lastSlash);
    
    // Check if we have a tracked parent for this branch
    const trackedParent = branchParentNodes.get(childBranch);
    if (trackedParent) {
      return findNodeRelativeToGivenParent(trackedParent, offset);
    }
    
    // Last resort: try to find by examining the structure
    const sequences = branchNodeSequences.get(parentBranch);
    if (!sequences) {
      return undefined;
    }

    // Find which node has this child branch by checking edges
    const childBranchBasename = childBranch.slice(lastSlash + 1);
    
    for (const edge of edges) {
      if (edge.label === childBranchBasename || edge.label === "yes" || edge.label === "no") {
        // Check if this edge's source is in the parent branch
        const sourceNode = nodes.find(n => n.id === edge.from && n.branch === parentBranch);
        if (sourceNode) {
          const sourceParts = sourceNode.id.split(":");
          const sourceNodeIndex = parseInt(sourceParts[sourceParts.length - 1], 10);
          const sourceSegmentIndex = parseInt(sourceParts[sourceParts.length - 2], 10);
          
          const seq = sequences[sourceSegmentIndex];
          if (seq) {
            const targetIdx = sourceNodeIndex + offset;
            if (targetIdx >= 0 && targetIdx < seq.length) {
              return seq[targetIdx];
            }
          }
        }
      }
    }

    return undefined;
  }
}

function getElementChildren(parent: Element, tagFilter?: string): Element[] {
  const elements: Element[] = [];

  for (let i = 0; i < parent.childNodes.length; i += 1) {
    const node = parent.childNodes.item(i);
    if (node.nodeType === node.ELEMENT_NODE) {
      const el = node as Element;
      if (!tagFilter || el.tagName === tagFilter) {
        elements.push(el);
      }
    }
  }

  return elements;
}

function findFirstElement(parent: Element, predicate: (el: Element) => boolean): Element | undefined {
  for (let i = 0; i < parent.childNodes.length; i += 1) {
    const node = parent.childNodes.item(i);
    if (node.nodeType === node.ELEMENT_NODE) {
      const el = node as Element;
      if (predicate(el)) {
        return el;
      }
    }
  }

  return undefined;
}

function readNumberAttr(el: Element, name: string): number | undefined {
  const raw = el.getAttribute(name);
  if (raw === null || raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isNaN(value) ? undefined : value;
}

function readFirstChildText(parent: Element, tagName: string): string | undefined {
  const child = findFirstElement(parent, (el) => el.tagName === tagName);
  if (!child) {
    return undefined;
  }
  return child.textContent?.trim() || undefined;
}

function collectAttributes(el: Element): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};

  for (let i = 0; i < el.attributes.length; i += 1) {
    const attr = el.attributes.item(i);
    if (attr) {
      result[attr.name] = attr.value ?? undefined;
    }
  }

  return result;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}

function deriveTransitionLabel(el: Element): string | undefined {
  return (
    el.getAttribute("source-connector") ||
    el.getAttribute("target-connector") ||
    el.getAttribute("condition-key") ||
    el.getAttribute("name") ||
    undefined
  );
}

function stripExtension(fileName: string): string {
  const parts = fileName.split("/").pop();
  if (!parts) {
    return fileName;
  }
  const lastDot = parts.lastIndexOf(".");
  return lastDot > 0 ? parts.slice(0, lastDot) : parts;
}

/**
 * Extract key-binding elements from a node (used in pipelet-node and loop-node)
 */
function extractKeyBindings(parent: Element): KeyBinding[] {
  const bindings: KeyBinding[] = [];
  
  for (const child of getElementChildren(parent, "key-binding")) {
    const key = child.getAttribute("key");
    const alias = child.getAttribute("alias");
    
    if (key) {
      bindings.push({
        key,
        alias: alias || "",
      });
    }
  }
  
  return bindings.length > 0 ? bindings : [];
}

/**
 * Extract template configuration from an interaction node
 */
function extractTemplateConfig(templateEl: Element): TemplateConfig {
  return {
    name: templateEl.getAttribute("name") || "",
    buffered: templateEl.getAttribute("buffered") === "true",
    dynamic: templateEl.getAttribute("dynamic") === "true",
  };
}
