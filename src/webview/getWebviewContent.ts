/**
 * Main webview content generator
 * Orchestrates the assembly of HTML, CSS, and JavaScript for the pipeline visualizer
 */

import * as vscode from "vscode";
import { ParsedPipeline } from "../lib/types";
import { createNonce, encodeForScript } from "./helpers";
import { getStyles } from "./styles";
import { renderSidebar } from "./templates/sidebar";
import { renderCanvas } from "./templates/canvas";
import { getMainScript } from "./scripts";

export interface WebviewContentOptions {
  webview: vscode.Webview;
  pipeline: ParsedPipeline;
  sourceUri: vscode.Uri;
  extensionUri: vscode.Uri;
  /** Optional: Navigate to this start node after loading */
  navigateToStartNode?: string;
}

/**
 * Generate the complete webview HTML content
 */
export function getWebviewContent(options: WebviewContentOptions): string {
  const { webview, pipeline, sourceUri, extensionUri, navigateToStartNode } = options;
  const nonce = createNonce();
  const sourcePath = sourceUri.fsPath;

  // Get URI to local Konva script
  const konvaUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "node_modules", "konva", "konva.min.js")
  );

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      ${renderHead(webview, nonce)}
      <style nonce="${nonce}">${getStyles()}</style>
    </head>
    <body>
      <div class="app-container">
        ${renderSidebar({ pipeline, sourcePath })}
        ${renderCanvas()}
      </div>
      ${renderScripts(nonce, pipeline, sourcePath, konvaUri, navigateToStartNode)}
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
  konvaUri: vscode.Uri,
  navigateToStartNode?: string
): string {
  const encodedData = encodeForScript(pipeline);
  const encodedPath = encodeForScript(sourcePath);
  const encodedStartNode = navigateToStartNode ? encodeForScript(navigateToStartNode) : "null";

  return `
    <script src="${konvaUri}" nonce="${nonce}"></script>
    <script nonce="${nonce}">
      const pipelineData = ${encodedData};
      const sourceLabel = ${encodedPath};
      const initialStartNode = ${encodedStartNode};
    </script>
    <script nonce="${nonce}">${getMainScript()}</script>
  `;
}
