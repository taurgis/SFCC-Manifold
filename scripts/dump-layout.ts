/**
 * Dump layout script - generates ASCII layout dumps for debugging
 * 
 * This script uses the same routing modules as the webview to ensure
 * consistent behavior between the debug output and the actual rendering.
 */

import fs from "fs";
import path from "path";
import { parsePipeline } from "../src/lib/pipelineParser";
import type {
  PipelineEdge as ParsedEdge,
  PipelineNode as ParsedNode,
} from "../src/lib/types";
import { calculateLayout } from "../src/webview-ui/layout";
import { LAYOUT_CONFIG } from "../src/webview-ui/constants";
import type {
  PipelineEdge,
  PipelineNode,
  PlacedNode,
  BendPoint,
} from "../src/webview-ui/types";

// Import shared edge routing modules
import {
  getAnchorPoint,
  determineSidesFromMap,
} from "../src/webview-ui/edges/index";

interface CliOptions {
  inputPath: string;
  outputPath?: string;
  cellWidth: number;
  showBendpoints: boolean;
  fullLayout: boolean;
}

interface PipelineDump {
  ascii: string;
  nodes: PlacedNode[];
  edges: PipelineEdge[];
}

const DEFAULT_CELL_WIDTH = 18;
const FULL_LAYOUT_SCALE = 8;

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const xmlPath = path.resolve(process.cwd(), options.inputPath);
  const defaultOut = path.join(
    process.cwd(),
    "debug",
    "layouts",
    `${path.basename(xmlPath, path.extname(xmlPath))}.txt`
  );

  if (!fs.existsSync(xmlPath)) {
    throw new Error(`Input file not found: ${xmlPath}`);
  }

  const xml = fs.readFileSync(xmlPath, "utf8");
  const parsed = parsePipeline(xml, path.basename(xmlPath));
  const nodes = toWebviewNodes(parsed.nodes);
  const edges = toWebviewEdges(parsed.edges);

  const placedNodes = calculateLayout(nodes, { preserveGrid: true });
  const dump = renderDump(placedNodes, edges, parsed.name, {
    cellWidth: options.cellWidth,
    showBendpoints: options.showBendpoints,
    fullLayout: options.fullLayout,
  });

  const outPath = path.resolve(process.cwd(), options.outputPath || defaultOut);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, dump.ascii, "utf8");
  // eslint-disable-next-line no-console
  console.log(`Layout written to ${outPath}`);
}

function parseArgs(args: string[]): CliOptions {
  let inputPath: string | undefined;
  let outputPath: string | undefined;
  let cellWidth = DEFAULT_CELL_WIDTH;
  let showBendpoints = false;
  let fullLayout = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "-o" || arg === "--out") {
      outputPath = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--cell-width" || arg === "-w") {
      const widthStr = args[i + 1];
      const parsed = Number(widthStr);
      if (!Number.isNaN(parsed) && parsed > 4) {
        cellWidth = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === "--show-bendpoints") {
      showBendpoints = true;
      continue;
    }
    if (arg === "--full-layout" || arg === "-F") {
      fullLayout = true;
      continue;
    }
    if (!inputPath) {
      inputPath = arg;
    }
  }

  if (!inputPath) {
    throw new Error(
      "Usage: npm run dump-layout -- <path-to-pipeline.xml> [-o output.txt] [--cell-width N] [--show-bendpoints] [-F|--full-layout]"
    );
  }

  return { inputPath, outputPath, cellWidth, showBendpoints, fullLayout };
}

function toWebviewNodes(nodes: ParsedNode[]): PipelineNode[] {
  return nodes.map((node) => ({
    id: node.id,
    label: node.label,
    type: node.type,
    branch: node.branch,
    attributes: Object.fromEntries(
      Object.entries(node.attributes || {}).filter(
        ([, value]) => value !== undefined
      )
    ) as Record<string, string>,
    configProperties: node.configProperties ?? [],
    bindings: node.bindings ?? [],
    template: node.template
      ? {
          name: node.template.name,
          buffered: node.template.buffered,
          dynamic: node.template.dynamic,
        }
      : null,
    description: node.description ?? null,
    position: node.position
      ? {
          x: node.position.x,
          y: node.position.y,
          orientation: node.position.orientation,
        }
      : undefined,
  }));
}

function toWebviewEdges(edges: ParsedEdge[]): PipelineEdge[] {
  return edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    label: edge.label,
    sourceConnector: edge.sourceConnector,
    targetConnector: edge.targetConnector,
    display: edge.display
      ? {
          bendPoints: edge.display.bendPoints.map((bend) => ({
            relativeTo: bend.relativeTo,
            x: bend.x,
            y: bend.y,
          })),
        }
      : undefined,
  }));
}

function renderDump(
  placedNodes: PlacedNode[],
  edges: PipelineEdge[],
  pipelineName: string,
  options: { cellWidth: number; showBendpoints: boolean; fullLayout: boolean }
): PipelineDump {
  const nodeMap = new Map(placedNodes.map((n) => [n.id, n] as const));
  const withGrid = ensureGridCoordinates(placedNodes);
  const sections: Array<string | undefined> = [
    `Pipeline: ${pipelineName}`,
    "",
    "Grid (x left→right, y top→bottom):",
    renderAsciiGrid(withGrid, options.cellWidth),
    "",
    "Nodes (ordered by grid row):",
    ...renderNodeList(withGrid),
    "",
    "Edges:",
    ...renderEdges(edges, withGrid, nodeMap, options.showBendpoints),
  ];

  if (options.fullLayout) {
    sections.push(
      "",
      `Full layout (coarse ASCII, ~${FULL_LAYOUT_SCALE}px per cell):`,
      renderFullLayout(withGrid, edges, nodeMap)
    );
  }

  const ascii = sections.filter(Boolean).join("\n");

  return { ascii, nodes: withGrid, edges };
}

function renderAsciiGrid(nodes: PlacedNode[], cellWidth: number): string {
  if (nodes.length === 0) return "(no nodes)";

  const maxX = Math.max(...nodes.map((n) => n.gridX ?? 0));
  const maxY = Math.max(...nodes.map((n) => n.gridY ?? 0));
  const cellMap = new Map<string, PlacedNode[]>();

  for (const node of nodes) {
    const key = `${node.gridX ?? 0},${node.gridY ?? 0}`;
    const bucket = cellMap.get(key) ?? [];
    bucket.push(node);
    cellMap.set(key, bucket);
  }

  const headerCells = new Array(maxX + 1)
    .fill(null)
    .map((_, x) => centerText(`x=${x}`, cellWidth + 2));
  const lines = [`     ${headerCells.join(" ")}`];

  for (let y = 0; y <= maxY; y += 1) {
    const row: string[] = [];
    for (let x = 0; x <= maxX; x += 1) {
      const key = `${x},${y}`;
      const bucket = cellMap.get(key);
      if (bucket && bucket.length > 0) {
        const label = abbreviate(
          bucket.map((n) => `${n.label} (${n.type})`).join(" | "),
          cellWidth
        );
        row.push(`[${pad(label, cellWidth)}]`);
      } else {
        row.push(`[${" ".repeat(cellWidth)}]`);
      }
    }
    lines.push(`${y.toString().padStart(3, " ")} ${row.join(" ")}`);
  }

  return lines.join("\n");
}

function renderNodeList(nodes: PlacedNode[]): string[] {
  if (nodes.length === 0) return ["(no nodes)"];
  const sorted = [...nodes].sort((a, b) => {
    const y = (a.gridY ?? 0) - (b.gridY ?? 0);
    if (y !== 0) return y;
    return (a.gridX ?? 0) - (b.gridX ?? 0);
  });

  return sorted.map((node) => {
    const grid = `(${node.gridX ?? "?"}, ${node.gridY ?? "?"})`;
    const px = `(${Math.round(node.x)}, ${Math.round(node.y)})`;
    return `- ${grid} px=${px} branch=${node.branch} label="${node.label}" type=${node.type} id=${node.id}`;
  });
}

function renderEdges(
  edges: PipelineEdge[],
  _nodes: PlacedNode[],
  nodeMap: Map<string, PlacedNode>,
  showBendpoints: boolean
): string[] {
  if (!edges.length) return ["(no edges)"];

  return edges.map((edge) => {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    const fromLabel = fromNode?.label ?? edge.from;
    const toLabel = toNode?.label ?? edge.to;
    const label = edge.label ? ` --${edge.label}--> ` : " ----> ";

    // Use shared routing module instead of duplicating logic
    const sides =
      fromNode && toNode
        ? determineSidesFromMap(edge, fromNode, toNode, nodeMap)
        : { outSide: "?", inSide: "?" };

    // Use shared anchor point calculation
    const startAnchor = fromNode
      ? getAnchorPoint(fromNode, sides.outSide)
      : null;
    const endAnchor = toNode ? getAnchorPoint(toNode, sides.inSide) : null;
    const startPos = startAnchor
      ? `@( ${Math.round(startAnchor.x)}, ${Math.round(startAnchor.y)} )`
      : "@(?, ?)";
    const endPos = endAnchor
      ? `@( ${Math.round(endAnchor.x)}, ${Math.round(endAnchor.y)} )`
      : "@(?, ?)";

    const bendStr =
      showBendpoints && edge.display?.bendPoints?.length
        ? formatBendpoints(edge.display.bendPoints)
        : "";

    return `- ${fromLabel} [out=${sides.outSide} ${startPos}]${label}[in=${sides.inSide} ${endPos}] ${toLabel}${bendStr}`;
  });
}

function ensureGridCoordinates(nodes: PlacedNode[]): PlacedNode[] {
  return nodes.map((node) => {
    if (node.gridX !== undefined && node.gridY !== undefined) return node;
    const gridX = Math.round(
      (node.x - LAYOUT_CONFIG.baseX) / LAYOUT_CONFIG.horizontalGap
    );
    const gridY = Math.round(
      (node.y - LAYOUT_CONFIG.baseY) / LAYOUT_CONFIG.verticalGap
    );
    return { ...node, gridX, gridY };
  });
}

function formatBendpoints(bps: BendPoint[]): string {
  const parts = bps.map((bp) => `${bp.relativeTo}(${bp.x},${bp.y})`);
  return parts.length ? ` (bendpoints: ${parts.join("; ")})` : "";
}

// --- Full ASCII layout rendering (coarse) ---

function renderFullLayout(
  nodes: PlacedNode[],
  edges: PipelineEdge[],
  nodeMap: Map<string, PlacedNode>
): string {
  if (!nodes.length) return "(no nodes)";

  const { nodeWidth, nodeHeight, horizontalGap, verticalGap } = LAYOUT_CONFIG;

  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + nodeWidth);
    maxY = Math.max(maxY, n.y + nodeHeight);
  }

  const widthChars = Math.ceil((maxX + 160) / FULL_LAYOUT_SCALE) + 6;
  const heightChars = Math.ceil((maxY + 160) / FULL_LAYOUT_SCALE) + 6;
  const canvas: string[][] = Array.from({ length: heightChars }, () =>
    Array.from({ length: widthChars }, () => " ")
  );

  const clamp = (x: number, max: number) => Math.max(0, Math.min(max - 1, x));

  const put = (x: number, y: number, ch: string) => {
    const cx = clamp(x, widthChars);
    const cy = clamp(y, heightChars);
    canvas[cy][cx] = ch;
  };

  // Draw nodes as boxes with labels
  const nodeRects: Array<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }> = [];

  for (const node of nodes) {
    if (node.type === "join") {
      const cx = Math.floor((node.x + nodeWidth / 2) / FULL_LAYOUT_SCALE);
      const cy = Math.floor((node.y + nodeHeight / 2) / FULL_LAYOUT_SCALE);
      const r = Math.max(1, Math.round(10 / FULL_LAYOUT_SCALE));
      nodeRects.push({
        x0: cx - r - 1,
        y0: cy - r - 1,
        x1: cx + r + 1,
        y1: cy + r + 1,
      });
      put(cx, cy, "o");
      put(cx - 1, cy, "(");
      put(cx + 1, cy, ")");
      put(cx, cy - 1, "-");
      put(cx, cy + 1, "-");
      continue;
    }

    const w = Math.max(6, Math.floor(nodeWidth / FULL_LAYOUT_SCALE));
    const h = Math.max(3, Math.floor(nodeHeight / FULL_LAYOUT_SCALE));
    const x0 = Math.floor(node.x / FULL_LAYOUT_SCALE);
    const y0 = Math.floor(node.y / FULL_LAYOUT_SCALE);
    const x1 = clamp(x0 + w, widthChars);
    const y1 = clamp(y0 + h, heightChars);

    nodeRects.push({ x0, y0, x1, y1 });

    for (let x = x0; x <= x1; x += 1) {
      put(x, y0, x === x0 || x === x1 ? "+" : "-");
      put(x, y1, x === x0 || x === x1 ? "+" : "-");
    }
    for (let y = y0; y <= y1; y += 1) {
      put(x0, y, "|");
      put(x1, y, "|");
    }

    const label = abbreviate(node.label, Math.max(1, w - 2));
    const labelX = x0 + 1;
    const labelY = clamp(y0 + 1, heightChars);
    for (let i = 0; i < label.length && labelX + i < widthChars - 1; i += 1) {
      put(labelX + i, labelY, label[i]);
    }
  }

  // Draw edges with simple orthogonal paths using shared routing
  for (const edge of edges) {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) continue;

    // Use shared routing module
    const sides = determineSidesFromMap(edge, fromNode, toNode, nodeMap);
    const start = getAnchorPoint(fromNode, sides.outSide);
    const end = getAnchorPoint(toNode, sides.inSide);

    const pathPoints = buildCoarsePath(
      start,
      end,
      fromNode,
      toNode,
      edge.display?.bendPoints,
      horizontalGap,
      verticalGap
    );

    drawPolyline(canvas, pathPoints, nodeRects);
  }

  return canvas.map((row) => row.join("")).join("\n");
}

function buildCoarsePath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  fromNode: PlacedNode,
  toNode: PlacedNode,
  bendPoints: BendPoint[] | undefined,
  horizontalGap: number,
  verticalGap: number
): Array<{ x: number; y: number }> {
  if (bendPoints && bendPoints.length) {
    const src = bendPoints.find((b) => b.relativeTo === "source");
    const tgt = bendPoints.find((b) => b.relativeTo === "target");
    const points: Array<{ x: number; y: number }> = [start];
    if (src) {
      points.push({
        x: fromNode.x + LAYOUT_CONFIG.nodeWidth / 2 + src.x * horizontalGap,
        y: fromNode.y + LAYOUT_CONFIG.nodeHeight / 2 + src.y * verticalGap,
      });
    }
    if (tgt) {
      points.push({
        x: toNode.x + LAYOUT_CONFIG.nodeWidth / 2 + tgt.x * horizontalGap,
        y: toNode.y + LAYOUT_CONFIG.nodeHeight / 2 + tgt.y * verticalGap,
      });
    }
    points.push(end);
    return orthogonalize(points);
  }

  const points: Array<{ x: number; y: number }> = [start];
  const targetIsJoin = toNode.type === "join";
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  if (targetIsJoin && dy >= 0) {
    // Prefer a vertical drop then a horizontal move into the join
    points.push({ x: start.x, y: end.y });
  } else if (dx > dy) {
    points.push({ x: end.x, y: start.y });
  } else {
    points.push({ x: start.x, y: end.y });
  }
  points.push(end);
  return orthogonalize(points);
}

function orthogonalize(
  points: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  if (points.length < 2) return points;
  const out: Array<{ x: number; y: number }> = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = out[out.length - 1];
    const curr = points[i];
    if (prev.x !== curr.x && prev.y !== curr.y) {
      out.push({ x: curr.x, y: prev.y });
    }
    out.push(curr);
  }
  return out;
}

function drawPolyline(
  canvas: string[][],
  points: Array<{ x: number; y: number }>,
  nodeRects: Array<{ x0: number; y0: number; x1: number; y1: number }>
): void {
  const w = canvas[0].length;
  const h = canvas.length;

  const clamp = (x: number, max: number) => Math.max(0, Math.min(max - 1, x));

  const toCell = (p: { x: number; y: number }) => ({
    x: clamp(Math.round(p.x / FULL_LAYOUT_SCALE), w),
    y: clamp(Math.round(p.y / FULL_LAYOUT_SCALE), h),
  });

  const snapOut = (c: { x: number; y: number }, axis: "horizontal" | "vertical") =>
    snapOutOfRect(c, nodeRects, axis);

  const globalDir = {
    dx: points.length >= 2 ? points[points.length - 1].x - points[0].x : 0,
    dy: points.length >= 2 ? points[points.length - 1].y - points[0].y : 0,
  };

  const segments: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
    dir: { dx: number; dy: number };
  }> = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const rawA = points[i];
    const rawB = points[i + 1];
    const axis =
      Math.abs(rawA.x - rawB.x) >= Math.abs(rawA.y - rawB.y)
        ? "horizontal"
        : "vertical";
    const a = snapOut(toCell(rawA), axis);
    const b = snapOut(toCell(rawB), axis);
    const dirX = rawB.x - rawA.x;
    const dirY = rawB.y - rawA.y;
    if (a.x === b.x && a.y === b.y) continue;
    segments.push({ a, b, dir: { dx: dirX, dy: dirY } });
  }

  segments.forEach((seg, idx) => {
    drawSegment(
      canvas,
      seg.a,
      seg.b,
      nodeRects,
      idx === segments.length - 1,
      seg.dir,
      globalDir
    );
  });
}

function drawSegment(
  canvas: string[][],
  a: { x: number; y: number },
  b: { x: number; y: number },
  nodeRects: Array<{ x0: number; y0: number; x1: number; y1: number }>,
  isTerminal: boolean,
  directionHint: { dx: number; dy: number },
  globalDir: { dx: number; dy: number }
): void {
  const w = canvas[0].length;
  const h = canvas.length;

  const put = (x: number, y: number, ch: string) => {
    if (x >= 0 && x < w && y >= 0 && y < h && !isInsideNodeRect(x, y, nodeRects)) {
      canvas[y][x] = mergeChar(canvas[y][x], ch);
    }
  };

  const dx = b.x - a.x;
  const dy = b.y - a.y;

  if (dx === 0 && dy === 0) {
    put(a.x, a.y, "+");
    return;
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    const step = dx >= 0 ? 1 : -1;
    for (let x = a.x; x !== b.x + step; x += step) {
      put(x, a.y, dx === 0 ? "+" : "-");
    }
    if (dy !== 0) {
      const stepY = dy >= 0 ? 1 : -1;
      for (let y = a.y; y !== b.y + stepY; y += stepY) {
        put(b.x, y, "|");
      }
    }
  } else {
    const stepY = dy >= 0 ? 1 : -1;
    for (let y = a.y; y !== b.y + stepY; y += stepY) {
      put(a.x, y, dy === 0 ? "+" : "|");
    }
    if (dx !== 0) {
      const stepX = dx >= 0 ? 1 : -1;
      for (let x = a.x; x !== b.x + stepX; x += stepX) {
        put(x, b.y, "-");
      }
    }
  }

  if (!isTerminal) return;

  const effDx =
    globalDir.dx !== 0 || globalDir.dy !== 0
      ? globalDir.dx
      : directionHint.dx !== 0 || directionHint.dy !== 0
        ? directionHint.dx
        : dx;
  const effDy =
    globalDir.dy !== 0 || globalDir.dx !== 0
      ? globalDir.dy
      : directionHint.dy !== 0 || directionHint.dx !== 0
        ? directionHint.dy
        : dy;
  const arrowChar = effDx > 0 ? ">" : effDx < 0 ? "<" : effDy > 0 ? "v" : "^";
  const canArrow = (x: number, y: number): boolean => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    if (isInsideNodeRect(x, y, nodeRects)) return false;
    const existing = canvas[y][x];
    return (
      existing === " " ||
      existing === "-" ||
      existing === "|" ||
      existing === "+"
    );
  };

  const placeArrow = (x: number, y: number): boolean => {
    if (!canArrow(x, y)) return false;
    canvas[y][x] = arrowChar;
    return true;
  };

  if (!placeArrow(b.x, b.y)) {
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    let placed = false;
    let x = b.x - stepX;
    let y = b.y - stepY;
    for (let i = 0; i < 4 && !placed; i += 1) {
      if (placeArrow(x, y)) {
        placed = true;
        break;
      }
      x -= stepX;
      y -= stepY;
    }
    if (!placed) {
      placeArrow(a.x, a.y);
    }
  }
}

function isInsideNodeRect(
  x: number,
  y: number,
  rects: Array<{ x0: number; y0: number; x1: number; y1: number }>
): boolean {
  for (const rect of rects) {
    if (x > rect.x0 && x < rect.x1 && y > rect.y0 && y < rect.y1) {
      return true;
    }
  }
  return false;
}

function snapOutOfRect(
  cell: { x: number; y: number },
  rects: Array<{ x0: number; y0: number; x1: number; y1: number }>,
  axis: "horizontal" | "vertical"
): { x: number; y: number } {
  for (const rect of rects) {
    if (
      cell.x > rect.x0 &&
      cell.x < rect.x1 &&
      cell.y > rect.y0 &&
      cell.y < rect.y1
    ) {
      if (axis === "vertical") {
        const distTop = cell.y - rect.y0;
        const distBottom = rect.y1 - cell.y;
        return distTop <= distBottom
          ? { x: cell.x, y: rect.y0 }
          : { x: cell.x, y: rect.y1 };
      }
      const distLeft = cell.x - rect.x0;
      const distRight = rect.x1 - cell.x;
      return distLeft <= distRight
        ? { x: rect.x0, y: cell.y }
        : { x: rect.x1, y: cell.y };
    }
  }
  return cell;
}

function mergeChar(existing: string, next: string, preferNext = false): string {
  if (existing === " " || existing === undefined) return next;
  if (existing === next) return existing;
  if (preferNext) {
    const replacable =
      existing === " " ||
      existing === "|" ||
      existing === "-" ||
      existing === "+";
    if (replacable) return next;
    return existing;
  }
  const combos = new Set([existing, next]);
  if (combos.has("|") && combos.has("-")) return "+";
  if (combos.has("+")) return "+";
  return existing;
}

function abbreviate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function pad(value: string, width: number): string {
  if (value.length >= width) return value;
  return `${value}${" ".repeat(width - value.length)}`;
}

function centerText(value: string, width: number): string {
  if (value.length >= width) return value;
  const total = width - value.length;
  const left = Math.floor(total / 2);
  const right = total - left;
  return `${" ".repeat(left)}${value}${" ".repeat(right)}`;
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`Failed to dump layout: ${(err as Error).message}`);
  process.exit(1);
});
