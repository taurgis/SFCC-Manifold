/**
 * Main webview content generator
 * Orchestrates the assembly of HTML, CSS, and JavaScript for the pipeline visualizer
 */

import * as vscode from "vscode";
import { ParsedPipeline } from "../lib/types";
import { createNonce, encodeForScript } from "./helpers";
import { getStyles } from "./styles";
import { renderCanvas, CanvasData } from "./templates/canvas";

export interface WebviewContentOptions {
  webview: vscode.Webview;
  pipeline: ParsedPipeline;
  sourceUri: vscode.Uri;
  extensionUri: vscode.Uri;
  initialStartNode?: string;
}

/**
 * Generate the complete webview HTML content
 */
export function getWebviewContent(options: WebviewContentOptions): string {
  const { webview, pipeline, sourceUri, extensionUri, initialStartNode } = options;
  const nonce = createNonce();
  const sourcePath = sourceUri.fsPath;

  // Get URI to local Konva script
  const konvaUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "node_modules", "konva", "konva.min.js")
  ).toString();

  // Get URI to bundled webview script
  const webviewScriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview.js")
  ).toString();

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      ${renderHead(webview, nonce)}
      <style nonce="${nonce}">${getStyles()}</style>
    </head>
    <body>
      <div class="app-container">
        ${renderCanvas({ pipeline, sourcePath })}
      </div>
      ${renderScripts(nonce, pipeline, sourcePath, konvaUri, webviewScriptUri, initialStartNode)}
    </body>
  </html>`;
}

/**
 * Render the HTML head section with meta tags and CSP
 */
function renderHead(webview: vscode.Webview, nonce: string): string {
  return `
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}' ${webview.cspSource};" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  `;
}

/**
 * Render all script tags
 */
function renderScripts(
  nonce: string,
  pipeline: ParsedPipeline,
  sourcePath: string,
  konvaUri: string,
  webviewScriptUri: string,
  initialStartNode?: string
): string {
  const encodedData = encodeForScript(pipeline);
  const encodedPath = encodeForScript(sourcePath);
  const encodedStartNode = initialStartNode ? encodeForScript(initialStartNode) : "null";

  return `
    <script src="${konvaUri}" nonce="${nonce}"></script>
    <script nonce="${nonce}">
      window.pipelineData = ${encodedData};
      window.sourceLabel = ${encodedPath};
      window.initialStartNode = ${encodedStartNode};
    </script>
    <script src="${webviewScriptUri}" nonce="${nonce}"></script>
  `;
}
