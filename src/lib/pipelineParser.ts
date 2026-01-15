import { DOMParser } from "@xmldom/xmldom";
import { BendPoint, ConfigProperty, KeyBinding, ParsedPipeline, PipelineEdge, PipelineNode, PipelineNodeType, TransitionDisplay } from "./types";

/**
 * Deferred edge to be processed after all nodes are parsed
 * These are edges with target-path references that need resolution
 */
interface DeferredEdge {
  fromNodeId: string;
  fromBranchPath: string;
  fromSegmentIndex: number;
  targetPath: string;
  label?: string;
  sourceConnector?: string;
  targetConnector?: string;
  display?: TransitionDisplay;
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
  
  // Map segment paths to their first node ID for target-path resolution
  // Key format: "branchPath:segmentIndex" -> nodeId
  const segmentFirstNodeMap = new Map<string, string>();
  
  // Deferred edges that need target-path resolution
  const deferredEdges: DeferredEdge[] = [];

  let branchOrdinal = 0;
  for (const branchEl of getElementChildren(pipelineEl, "branch")) {
    const path = branchEl.getAttribute("basename") || `branch-${branchOrdinal++}`;
    parseBranchWithEntry(branchEl, path);
  }

  // Process deferred edges after all nodes are parsed
  processDeferredEdges();

  return { name: pipelineName, group, type, description, nodes, edges };

  function parseBranchWithEntry(
    branchEl: Element,
    branchPath: string,
    parentLoopNodeId?: string
  ): { entryIds: string[] } {
    const entryIds: string[] = [];
    let segmentIndex = 0;

    for (const segmentEl of getElementChildren(branchEl, "segment")) {
      const result = parseSegment(segmentEl, branchPath, segmentIndex++, parentLoopNodeId);
      if (result.firstNodeId) {
        entryIds.push(result.firstNodeId);
      }
    }

    return { entryIds };
  }

  function parseSegment(
    segmentEl: Element,
    branchPath: string,
    segmentIndex: number,
    parentLoopNodeId?: string
  ) {
    let lastNodeId: string | undefined;
    let firstNodeId: string | undefined;
    let pendingLabel: string | undefined;
    let pendingSourceConnector: string | undefined;
    let pendingTargetConnector: string | undefined;
    let pendingDisplay: TransitionDisplay | undefined;
    let pendingTargetPath: string | undefined;
    let nodeIndex = 0;

    for (const child of getElementChildren(segmentEl)) {
      if (child.tagName === "node") {
        const parsed = parseNode(child, branchPath, segmentIndex, nodeIndex++);

        if (!firstNodeId) {
          firstNodeId = parsed.id;
          // Register this as the first node of this segment for target-path resolution
          const segmentKey = `${branchPath}:${segmentIndex}`;
          segmentFirstNodeMap.set(segmentKey, parsed.id);
        }

        // Handle pending transition
        if (lastNodeId) {
          if (pendingTargetPath) {
            // This transition has a target-path - defer it for later resolution
            // The target is NOT the next node in this segment, it's somewhere else
            deferredEdges.push({
              fromNodeId: lastNodeId,
              fromBranchPath: branchPath,
              fromSegmentIndex: segmentIndex,
              targetPath: pendingTargetPath,
              label: pendingLabel,
              sourceConnector: pendingSourceConnector,
              targetConnector: pendingTargetConnector,
              display: pendingDisplay,
            });
          } else {
            // Normal sequential edge within the segment (no target-path)
            edges.push({
              from: lastNodeId,
              to: parsed.id,
              label: pendingLabel,
              sourceConnector: pendingSourceConnector,
              targetConnector: pendingTargetConnector,
              display: pendingDisplay,
            });
          }
        }

        lastNodeId = parsed.id;
        pendingLabel = undefined;
        pendingSourceConnector = undefined;
        pendingTargetConnector = undefined;
        pendingDisplay = undefined;
        pendingTargetPath = undefined;
      } else if (child.tagName === "simple-transition" || child.tagName === "transition") {
        const label = deriveTransitionLabel(child);
        const targetConnector = child.getAttribute("target-connector");
        const sourceConnector = child.getAttribute("source-connector");
        const targetPath = child.getAttribute("target-path");

        // Parse transition display (bend points)
        const transitionDisplay = parseTransitionDisplay(child);

        // Check if this is a loop back-edge (transition back to parent loop node)
        if (targetConnector === "loop" && targetPath && parentLoopNodeId && lastNodeId) {
          edges.push({
            from: lastNodeId,
            to: parentLoopNodeId,
            label: "loop",
            sourceConnector: sourceConnector || undefined,
            targetConnector: targetConnector || undefined,
            display: transitionDisplay,
          });
          pendingLabel = undefined;
          pendingSourceConnector = undefined;
          pendingTargetConnector = undefined;
          pendingDisplay = undefined;
          pendingTargetPath = undefined;
        } else {
          pendingLabel = label;
          pendingSourceConnector = sourceConnector || undefined;
          pendingTargetConnector = targetConnector || undefined;
          pendingDisplay = transitionDisplay;
          pendingTargetPath = targetPath || undefined;
        }
      }
    }

    // Handle any trailing transition with target-path (edge that goes outside this segment)
    if (lastNodeId && pendingTargetPath) {
      deferredEdges.push({
        fromNodeId: lastNodeId,
        fromBranchPath: branchPath,
        fromSegmentIndex: segmentIndex,
        targetPath: pendingTargetPath,
        label: pendingLabel,
        sourceConnector: pendingSourceConnector,
        targetConnector: pendingTargetConnector,
        display: pendingDisplay,
      });
    }

    return { firstNodeId, lastNodeId };
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
    const { type, label, attributes, configProperties, bindings } = describeNode(typeEl);

    const parsedNode: PipelineNode = {
      id,
      label,
      type,
      branch: branchPath,
      attributes,
      configProperties,
      bindings,
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

      // Include segment and node index in the path to ensure uniqueness
      // This prevents ID collisions when different nodes have branches with the same basename
      const branchBasename = nestedBranch.getAttribute("basename") || connectorLabel;
      const nestedPath = `${branchPath}:${segmentIndex}:${nodeIndex}/${branchBasename}`;
      
      // Parse the transition element within the branch for display info
      const transitionEl = findFirstElement(nestedBranch, (el) => el.tagName === "transition" || el.tagName === "simple-transition");
      const branchTransitionDisplay = transitionEl ? parseTransitionDisplay(transitionEl) : undefined;
      const branchTargetConnector = transitionEl?.getAttribute("target-connector") || undefined;

      // Pass loop node ID if this is a loop node, so back-edges can reference it
      const branchResult = parseBranchWithEntry(
        nestedBranch,
        nestedPath,
        isLoopNode ? id : undefined
      );

      for (const entry of branchResult.entryIds) {
        edges.push({
          from: id,
          to: entry,
          label: connectorLabel,
          sourceConnector: connectorLabel,
          targetConnector: branchTargetConnector,
          display: branchTransitionDisplay,
        });
      }
    }

    return parsedNode;
  }

  /**
   * Process deferred edges by resolving target-path references
   * 
   * Target-path format examples:
   * - "./+1"  -> next segment in current branch (segmentIndex + 1)
   * - "./-2"  -> 2 segments back in current branch (segmentIndex - 2)
   * - "../+1" -> next segment in parent branch
   * - "../../+1" -> next segment in grandparent branch
   * - "/Start.2" -> absolute: segment 2 in Start branch
   * - "./b5.3"  -> nested branch "b5", segment 3 (relative to current path)
   */
  function processDeferredEdges() {
    for (const deferred of deferredEdges) {
      const targetNodeId = resolveTargetPath(
        deferred.targetPath,
        deferred.fromBranchPath,
        deferred.fromSegmentIndex
      );

      if (targetNodeId) {
        edges.push({
          from: deferred.fromNodeId,
          to: targetNodeId,
          label: deferred.label,
          sourceConnector: deferred.sourceConnector,
          targetConnector: deferred.targetConnector,
          display: deferred.display,
        });
      }
    }
  }

  /**
   * Resolve a target-path to find the target node ID
   * 
   * Target-path format examples:
   * - "./+1"  -> next segment in current branch (segmentIndex + 1)
   * - "./-2"  -> 2 segments back in current branch (segmentIndex - 2)
   * - "../+1" -> next segment in parent branch
   * - "../../+1" -> next segment in grandparent branch
   * - "/Start.2" -> absolute: segment 2 in Start branch
   * - "./b5.3"  -> nested branch "b5", segment 3 (relative to current path)
   */
  function resolveTargetPath(
    targetPath: string,
    currentBranchPath: string,
    currentSegmentIndex: number
  ): string | undefined {
    // Absolute path (starts with /)
    // Format: /BranchName.segmentIndex
    if (targetPath.startsWith("/")) {
      const pathWithoutSlash = targetPath.slice(1);
      const match = pathWithoutSlash.match(/^([^.]+)\.(\d+)$/);
      if (match) {
        const branchName = match[1];
        const segmentIdx = parseInt(match[2], 10);
        const segmentKey = `${branchName}:${segmentIdx}`;
        return segmentFirstNodeMap.get(segmentKey);
      }
      return undefined;
    }

    // Relative path
    let branchPath = currentBranchPath;
    let segmentIndex = currentSegmentIndex;
    let remainingPath = targetPath;

    // Process parent references (../)
    while (remainingPath.startsWith("../")) {
      remainingPath = remainingPath.slice(3);
      
      // Branch paths are like "parentBranch:segIdx:nodeIdx/branchName" or just "branchName"
      const lastSlashIndex = branchPath.lastIndexOf("/");
      
      if (lastSlashIndex > 0) {
        // Extract the part before the last slash
        // This could be "Start:2:1" or "Start:2:1/yes:0:0" for deeper nesting
        const parentPart = branchPath.slice(0, lastSlashIndex);
        
        // Try to extract segment index from the end of parentPart
        // Pattern: ....:segmentIndex:nodeIndex at the end
        const segNodeMatch = parentPart.match(/:(\d+):(\d+)$/);
        if (segNodeMatch) {
          segmentIndex = parseInt(segNodeMatch[1], 10);
          // Remove the :seg:node suffix to get just the branch path
          branchPath = parentPart.replace(/:(\d+):(\d+)$/, "");
        } else {
          // No segment:node suffix, just use the parent part as the branch
          branchPath = parentPart;
        }
      } else {
        // At top level or simple branch name
        // Check if current branch has segment:node info
        const segNodeMatch = branchPath.match(/:(\d+):(\d+)$/);
        if (segNodeMatch) {
          segmentIndex = parseInt(segNodeMatch[1], 10);
          branchPath = branchPath.replace(/:(\d+):(\d+)$/, "");
        }
        // If no more parent levels, we stay at current branch
      }
    }

    // Handle "./" prefix (current level)
    if (remainingPath.startsWith("./")) {
      remainingPath = remainingPath.slice(2);
    }

    // Now parse the remaining path
    // Format: +N, -N, or branchName.segmentIndex
    
    // Check for relative segment offset (+N or -N)
    const offsetMatch = remainingPath.match(/^([+-])(\d+)$/);
    if (offsetMatch) {
      const sign = offsetMatch[1] === "+" ? 1 : -1;
      const offset = parseInt(offsetMatch[2], 10);
      const targetSegmentIndex = segmentIndex + sign * offset;
      const segmentKey = `${branchPath}:${targetSegmentIndex}`;
      return segmentFirstNodeMap.get(segmentKey);
    }

    // Check for nested branch reference (branchName.segmentIndex)
    const nestedMatch = remainingPath.match(/^([^.]+)\.(\d+)$/);
    if (nestedMatch) {
      const nestedBranchName = nestedMatch[1];
      const targetSegmentIdx = parseInt(nestedMatch[2], 10);
      
      // Search for the nested branch in the segment map
      // The nested branch could be at various depths, so we search
      for (const [key, nodeId] of segmentFirstNodeMap) {
        // Look for patterns that end with "/nestedBranchName:targetSegmentIdx"
        if (key.endsWith(`/${nestedBranchName}:${targetSegmentIdx}`)) {
          // Verify it's under the current branch context
          if (key.startsWith(branchPath)) {
            return nodeId;
          }
        }
      }
    }

    return undefined;
  }

  function describeNode(typeEl: Element | undefined): {
    type: PipelineNodeType;
    label: string;
    attributes: Record<string, string | undefined>;
    configProperties?: ConfigProperty[];
    bindings?: KeyBinding[];
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
        const configProperties = collectConfigProperties(typeEl);
        const bindings = collectKeyBindings(typeEl);
        return { type: "pipelet", label: pipeletName, attributes: attrs, configProperties, bindings };
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
        return { type: "interaction", label: templateName, attributes: attrs };
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
        return { type: "loop", label: `Loop ${loopLabel}`, attributes: attrs };
      }
      case "text-node": {
        const text = readFirstChildText(typeEl, "description") || "Text";
        const label = truncate(text, 60);
        return { type: "text", label, attributes: attrs };
      }
      default: {
        return { type: "unknown", label: typeEl.tagName, attributes: attrs };
      }
    }
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

/**
 * Collect config-property elements from a pipelet node
 */
function collectConfigProperties(el: Element): ConfigProperty[] {
  const properties: ConfigProperty[] = [];

  for (let i = 0; i < el.childNodes.length; i += 1) {
    const node = el.childNodes.item(i);
    if (node.nodeType === node.ELEMENT_NODE) {
      const child = node as Element;
      if (child.tagName === "config-property") {
        const key = child.getAttribute("key");
        const value = child.getAttribute("value");
        if (key !== null) {
          properties.push({ key, value: value ?? "" });
        }
      }
    }
  }

  return properties;
}

/**
 * Collect key-binding elements from a pipelet node
 */
function collectKeyBindings(el: Element): KeyBinding[] {
  const bindings: KeyBinding[] = [];

  for (let i = 0; i < el.childNodes.length; i += 1) {
    const node = el.childNodes.item(i);
    if (node.nodeType === node.ELEMENT_NODE) {
      const child = node as Element;
      if (child.tagName === "key-binding") {
        const key = child.getAttribute("key");
        const alias = child.getAttribute("alias");
        if (key !== null) {
          bindings.push({ key, alias: alias ?? "" });
        }
      }
    }
  }

  return bindings;
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

/**
 * Parse transition-display element and extract bend points
 */
function parseTransitionDisplay(transitionEl: Element): TransitionDisplay | undefined {
  const displayEl = findFirstElement(transitionEl, (el) => el.tagName === "transition-display");
  if (!displayEl) {
    return undefined;
  }

  const bendPoints: BendPoint[] = [];
  
  for (const child of getElementChildren(displayEl, "bend-point")) {
    const relativeTo = child.getAttribute("relative-to");
    const x = readNumberAttr(child, "x");
    const y = readNumberAttr(child, "y");
    
    if ((relativeTo === "source" || relativeTo === "target") && x !== undefined && y !== undefined) {
      bendPoints.push({
        relativeTo,
        x,
        y,
      });
    }
  }

  return bendPoints.length > 0 ? { bendPoints } : undefined;
}

function stripExtension(fileName: string): string {
  const parts = fileName.split("/").pop();
  if (!parts) {
    return fileName;
  }
  const lastDot = parts.lastIndexOf(".");
  return lastDot > 0 ? parts.slice(0, lastDot) : parts;
}
