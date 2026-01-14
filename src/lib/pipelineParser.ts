import { DOMParser } from "@xmldom/xmldom";
import { ParsedPipeline, PipelineEdge, PipelineNode, PipelineNodeType } from "./types";

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

  let branchOrdinal = 0;
  for (const branchEl of getElementChildren(pipelineEl, "branch")) {
    const path = branchEl.getAttribute("basename") || `branch-${branchOrdinal++}`;
    parseBranchWithEntry(branchEl, path);
  }

  return { name: pipelineName, group, type, description, nodes, edges };

  function parseBranchWithEntry(branchEl: Element, branchPath: string): { entryIds: string[] } {
    const entryIds: string[] = [];
    let segmentIndex = 0;

    for (const segmentEl of getElementChildren(branchEl, "segment")) {
      const result = parseSegment(segmentEl, branchPath, segmentIndex++);
      if (result.firstNodeId) {
        entryIds.push(result.firstNodeId);
      }
    }

    return { entryIds };
  }

  function parseSegment(segmentEl: Element, branchPath: string, segmentIndex: number) {
    let lastNodeId: string | undefined;
    let firstNodeId: string | undefined;
    let pendingLabel: string | undefined;
    let nodeIndex = 0;

    for (const child of getElementChildren(segmentEl)) {
      if (child.tagName === "node") {
        const parsed = parseNode(child, branchPath, segmentIndex, nodeIndex++);

        if (!firstNodeId) {
          firstNodeId = parsed.id;
        }

        if (lastNodeId) {
          edges.push({ from: lastNodeId, to: parsed.id, label: pendingLabel });
        }

        lastNodeId = parsed.id;
        pendingLabel = undefined;
      } else if (child.tagName === "simple-transition" || child.tagName === "transition") {
        pendingLabel = deriveTransitionLabel(child);
      }
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
    const { type, label, attributes } = describeNode(typeEl);

    const parsedNode: PipelineNode = {
      id,
      label,
      type,
      branch: branchPath,
      attributes,
      position,
    };

    nodes.push(parsedNode);

    for (const nestedBranch of getElementChildren(nodeEl, "branch")) {
      const connectorLabel =
        nestedBranch.getAttribute("source-connector") ||
        nestedBranch.getAttribute("target-connector") ||
        nestedBranch.getAttribute("basename") ||
        "branch";

      const nestedPath = `${branchPath}/${nestedBranch.getAttribute("basename") || connectorLabel}`;
      const branchResult = parseBranchWithEntry(nestedBranch, nestedPath);

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
        return { type: "pipelet", label: pipeletName, attributes: attrs };
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
