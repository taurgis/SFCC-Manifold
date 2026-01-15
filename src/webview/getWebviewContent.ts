import * as vscode from "vscode";
import { ParsedPipeline } from "../lib/types";

export function getWebviewContent(
  webview: vscode.Webview,
  pipeline: ParsedPipeline,
  sourceUri: vscode.Uri
): string {
  const nonce = createNonce();
  const encodedData = JSON.stringify(pipeline).replace(/</g, "\\u003c");
  const sourcePath = sourceUri.fsPath;

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style nonce="${nonce}">
        :root {
          --bg: #0b1021;
          --panel: #11162d;
          --border: #1f2a44;
          --text: #d8e2ff;
          --muted: #93a4c8;
          --accent: #6dd3ff;
          --danger: #ff8a7a;
          --success: #6be8c7;
          --warning: #f2c078;
          --edge: #6dd3ff66;
          --edge-strong: #6dd3ff;
          --grid: 180px;
          --node-width: 150px;
          --node-height: 70px;
        }

        * { box-sizing: border-box; }

        body {
          margin: 0;
          background: radial-gradient(circle at 10% 20%, #131a36, #0b1021 45%);
          color: var(--text);
          font-family: "IBM Plex Sans", "Segoe UI", "SF Pro Display", system-ui, -apple-system, sans-serif;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        header {
          padding: 16px 20px 8px 20px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(90deg, #11162d, #161d38);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .title {
          font-size: 16px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          color: var(--muted);
          font-size: 12px;
        }

        .badge {
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: #0f152b;
        }

        .description {
          color: var(--muted);
          font-size: 13px;
          max-width: 960px;
        }

        .legend {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          padding: 10px 20px;
          border-bottom: 1px solid var(--border);
          background: #0e1428;
          font-size: 12px;
        }

        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: #0f172f;
        }

        .legend-swatch {
          width: 12px;
          height: 12px;
          border-radius: 3px;
          border: 1px solid #ffffff22;
        }

        #canvas-wrapper {
          position: relative;
          flex: 1;
          overflow: auto;
          min-height: 400px;
        }

        #canvas-content {
          position: relative;
          min-width: 100%;
          min-height: 100%;
        }

        #edge-layer {
          position: absolute;
          top: 0;
          left: 0;
          pointer-events: none;
          z-index: 1;
        }

        #node-layer {
          position: relative;
          z-index: 2;
        }

        .node {
          position: absolute;
          width: var(--node-width);
          min-height: var(--node-height);
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: linear-gradient(180deg, #111b35, #0d1328);
          box-shadow: 0 10px 30px #00000044;
          cursor: default;
          transition: transform 120ms ease, box-shadow 120ms ease;
          user-select: none;
        }

        .node:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 40px #00000066;
        }

        .node-title {
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .node-subtitle {
          font-size: 11px;
          color: var(--muted);
          word-break: break-word;
        }

        .node.start { border-color: #6be8c7; }
        .node.end { border-color: #ff8a7a; }
        .node.pipelet { border-color: #6dd3ff; }
        .node.call { border-color: #f2c078; }
        .node.jump { border-color: #f2c078; }
        .node.interaction { border-color: #9c6dff; }
        .node.decision { border-color: #f2c078; }
        .node.join { border-color: #93a4c8; }
        .node.loop { border-color: #6be8c7; }
        .node.text { border-color: #93a4c8; }
        .node.unknown { border-color: #93a4c8; }

        .node .pill {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 10px;
          color: #0b1021;
          margin-bottom: 6px;
        }

        .pill.start { background: #6be8c7; }
        .pill.end { background: #ff8a7a; }
        .pill.pipelet { background: #6dd3ff; }
        .pill.call { background: #f2c078; }
        .pill.jump { background: #f2c078; }
        .pill.interaction { background: #9c6dff; }
        .pill.decision { background: #f2c078; }
        .pill.join { background: #93a4c8; }
        .pill.loop { background: #6be8c7; }
        .pill.text { background: #93a4c8; }
        .pill.unknown { background: #93a4c8; }

        .hint {
          font-size: 11px;
          color: var(--muted);
          padding: 8px 20px 16px 20px;
          border-bottom: 1px solid var(--border);
        }
      </style>
    </head>
    <body>
      <header>
        <div class="title">${escapeHtml(pipeline.name)}${pipeline.group ? ` · ${escapeHtml(pipeline.group)}` : ""}</div>
        <div class="meta">
          ${pipeline.type ? `<span class="badge">Type: ${escapeHtml(pipeline.type)}</span>` : ""}
          <span class="badge">Nodes: ${pipeline.nodes.length}</span>
          <span class="badge">Edges: ${pipeline.edges.length}</span>
          <span class="badge">Source: ${escapeHtml(sourcePath)}</span>
        </div>
        ${pipeline.description ? `<div class="description">${escapeHtml(pipeline.description)}</div>` : ""}
      </header>

      <div class="legend" id="legend"></div>
      <div class="hint">Use the current XML file or pick another pipeline. Layout uses stored node-display coordinates when available, otherwise falls back to a grid.</div>

      <div id="canvas-wrapper">
        <div id="canvas-content">
          <svg id="edge-layer"></svg>
          <div id="node-layer"></div>
        </div>
      </div>

      <script nonce="${nonce}">
        const pipelineData = ${encodedData};
        const sourceLabel = ${JSON.stringify(sourcePath).replace(/</g, "\\u003c")};
      </script>
      <script nonce="${nonce}">
        (function() {
          var colors = {
            start: "#6be8c7",
            end: "#ff8a7a",
            pipelet: "#6dd3ff",
            call: "#f2c078",
            jump: "#f2c078",
            interaction: "#9c6dff",
            decision: "#f2c078",
            join: "#93a4c8",
            loop: "#6be8c7",
            text: "#93a4c8",
            unknown: "#93a4c8"
          };

          var canvasContent = document.getElementById("canvas-content");
          var nodeLayer = document.getElementById("node-layer");
          var edgeLayer = document.getElementById("edge-layer");
          var legendEl = document.getElementById("legend");

          var nodeWidth = 180;
          var nodeHeight = 100;
          var horizontalGap = 380;
          var verticalGap = 130;
          var baseX = 40;
          var baseY = 40;

          try {
            // Group nodes by their top-level branch (first part of branch path)
            var branchGroups = {};
            var branchOrder = [];
            
            for (var i = 0; i < pipelineData.nodes.length; i++) {
              var node = pipelineData.nodes[i];
              // Get the top-level branch name (before any /)
              var topBranch = node.branch.split('/')[0];
              if (!branchGroups[topBranch]) {
                branchGroups[topBranch] = [];
                branchOrder.push(topBranch);
              }
              branchGroups[topBranch].push(node);
            }

            // Assign column index to each top-level branch
            var branchColumns = {};
            for (var i = 0; i < branchOrder.length; i++) {
              branchColumns[branchOrder[i]] = i;
            }

            // Track the next available Y position for each column
            var columnNextY = {};
            // Track sub-branch column offsets
            var subBranchOffsets = {};
            
            var placedNodes = [];
            for (var i = 0; i < pipelineData.nodes.length; i++) {
              var node = pipelineData.nodes[i];
              var branchParts = node.branch.split('/');
              var topBranch = branchParts[0];
              var columnIndex = branchColumns[topBranch];
              
              // Calculate X based on column and sub-branch depth
              var subBranchDepth = branchParts.length - 1;
              var x = baseX + (columnIndex * horizontalGap);
              
              // For sub-branches, offset slightly to the right
              if (subBranchDepth > 0) {
                // Check if this sub-branch already has an assigned offset
                var subBranchKey = branchParts[0] + '/' + branchParts[1];
                if (subBranchOffsets[subBranchKey] === undefined) {
                  // Count existing offsets for this top branch
                  var existingOffsets = 0;
                  for (var key in subBranchOffsets) {
                    if (key.indexOf(topBranch + '/') === 0) {
                      existingOffsets++;
                    }
                  }
                  subBranchOffsets[subBranchKey] = (existingOffsets % 2 === 0) ? 1 : -1;
                }
                x += subBranchOffsets[subBranchKey] * (horizontalGap * 0.5);
              }
              
              // Calculate Y - use sequential positioning within the column
              var colKey = node.branch; // Use full branch path for Y tracking
              if (columnNextY[colKey] === undefined) {
                // For sub-branches, start below the parent's current position
                if (subBranchDepth > 0) {
                  var parentBranch = branchParts.slice(0, branchParts.length - 1).join('/');
                  columnNextY[colKey] = (columnNextY[parentBranch] || baseY);
                } else {
                  columnNextY[colKey] = baseY;
                }
              }
              
              var y = columnNextY[colKey];
              columnNextY[colKey] = y + verticalGap;
              
              // Also advance the parent branch Y to prevent overlap
              if (subBranchDepth > 0) {
                var parentKey = branchParts.slice(0, branchParts.length - 1).join('/');
                if (columnNextY[parentKey] === undefined || columnNextY[parentKey] < y + verticalGap) {
                  columnNextY[parentKey] = y + verticalGap;
                }
              }
              
              placedNodes.push({
                id: node.id,
                label: node.label,
                type: node.type,
                branch: node.branch,
                x: x,
                y: y
              });
            }
          } catch (e) {
            console.error("Layout error:", e);
            // Fallback to simple grid layout
            var placedNodes = [];
            for (var i = 0; i < pipelineData.nodes.length; i++) {
              var node = pipelineData.nodes[i];
              placedNodes.push({
                id: node.id,
                label: node.label,
                type: node.type,
                branch: node.branch,
                x: baseX + (i % 5) * horizontalGap,
                y: baseY + Math.floor(i / 5) * verticalGap
              });
            }
          }

          // Build lookup map
          var nodeMap = {};
          for (var i = 0; i < placedNodes.length; i++) {
            nodeMap[placedNodes[i].id] = placedNodes[i];
          }

          // Calculate canvas bounds
          var maxX = baseX, maxY = baseY;
          for (var i = 0; i < placedNodes.length; i++) {
            var n = placedNodes[i];
            if (n.x + nodeWidth > maxX) maxX = n.x + nodeWidth;
            if (n.y + nodeHeight > maxY) maxY = n.y + nodeHeight;
          }
          maxX += horizontalGap;
          maxY += verticalGap;

          // Set canvas size
          canvasContent.style.width = maxX + "px";
          canvasContent.style.height = maxY + "px";

          renderLegend();
          renderNodes();
          renderEdges();

          function renderLegend() {
            var seen = {};
            for (var i = 0; i < placedNodes.length; i++) {
              var node = placedNodes[i];
              if (seen[node.type]) continue;
              seen[node.type] = true;
              
              var item = document.createElement("div");
              item.className = "legend-item";

              var swatch = document.createElement("div");
              swatch.className = "legend-swatch";
              swatch.style.background = colors[node.type] || colors.unknown;

              var label = document.createElement("span");
              label.textContent = node.type;

              item.appendChild(swatch);
              item.appendChild(label);
              legendEl.appendChild(item);
            }
          }

          function renderNodes() {
            nodeLayer.innerHTML = "";
            for (var i = 0; i < placedNodes.length; i++) {
              var node = placedNodes[i];
              
              var el = document.createElement("div");
              el.className = "node " + node.type;
              el.style.position = "absolute";
              el.style.left = node.x + "px";
              el.style.top = node.y + "px";
              el.style.width = nodeWidth + "px";

              var pill = document.createElement("div");
              pill.className = "pill " + node.type;
              pill.textContent = node.type;

              var title = document.createElement("div");
              title.className = "node-title";
              title.textContent = node.label;

              var subtitle = document.createElement("div");
              subtitle.className = "node-subtitle";
              subtitle.textContent = node.branch;

              el.appendChild(pill);
              el.appendChild(title);
              el.appendChild(subtitle);
              nodeLayer.appendChild(el);
            }
          }

          function renderEdges() {
            var svgNS = "http://www.w3.org/2000/svg";
            
            // Clear and size SVG
            while (edgeLayer.firstChild) {
              edgeLayer.removeChild(edgeLayer.firstChild);
            }
            edgeLayer.setAttribute("width", maxX);
            edgeLayer.setAttribute("height", maxY);
            edgeLayer.style.width = maxX + "px";
            edgeLayer.style.height = maxY + "px";

            // Create arrow marker
            var defs = document.createElementNS(svgNS, "defs");
            var marker = document.createElementNS(svgNS, "marker");
            marker.setAttribute("id", "arrowhead");
            marker.setAttribute("markerWidth", "10");
            marker.setAttribute("markerHeight", "7");
            marker.setAttribute("refX", "9");
            marker.setAttribute("refY", "3.5");
            marker.setAttribute("orient", "auto");
            var polygon = document.createElementNS(svgNS, "polygon");
            polygon.setAttribute("points", "0 0, 10 3.5, 0 7");
            polygon.setAttribute("fill", "#6dd3ff");
            marker.appendChild(polygon);
            defs.appendChild(marker);
            edgeLayer.appendChild(defs);

            // Draw edges
            var edges = pipelineData.edges;
            for (var i = 0; i < edges.length; i++) {
              var edge = edges[i];
              var fromNode = nodeMap[edge.from];
              var toNode = nodeMap[edge.to];
              
              if (!fromNode || !toNode) {
                continue;
              }

              // Calculate line endpoints (center-bottom to center-top)
              var x1 = fromNode.x + nodeWidth / 2;
              var y1 = fromNode.y + nodeHeight;
              var x2 = toNode.x + nodeWidth / 2;
              var y2 = toNode.y;

              // Use path for better control
              var path = document.createElementNS(svgNS, "path");
              var d;
              
              // If nodes are roughly vertically aligned, draw straight line
              if (Math.abs(x1 - x2) < 20) {
                d = "M " + x1 + " " + y1 + " L " + x2 + " " + y2;
              } else {
                // Draw curved path
                var midY = (y1 + y2) / 2;
                d = "M " + x1 + " " + y1 + " C " + x1 + " " + midY + ", " + x2 + " " + midY + ", " + x2 + " " + y2;
              }
              
              path.setAttribute("d", d);
              path.setAttribute("stroke", "#6dd3ff");
              path.setAttribute("stroke-width", "2");
              path.setAttribute("fill", "none");
              path.setAttribute("marker-end", "url(#arrowhead)");
              edgeLayer.appendChild(path);

              // Add label if present
              if (edge.label) {
                var text = document.createElementNS(svgNS, "text");
                var midX = (x1 + x2) / 2;
                var midY = (y1 + y2) / 2;
                text.setAttribute("x", midX);
                text.setAttribute("y", midY - 5);
                text.setAttribute("fill", "#93a4c8");
                text.setAttribute("font-size", "10px");
                text.setAttribute("text-anchor", "middle");
                text.textContent = edge.label;
                edgeLayer.appendChild(text);
              }
            }
          }
        })();
      </script>
    </body>
  </html>`;
}

function createNonce(): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 16; i += 1) {
    value += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
