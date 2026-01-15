import * as vscode from "vscode";
import { parsePipeline } from "./lib/pipelineParser";
import { getWebviewContent } from "./webview/getWebviewContent";

/** Track open panels by file path to avoid duplicates */
const openPanels = new Map<string, vscode.WebviewPanel>();

/** Store extension URI for use in refresh */
let extensionUri: vscode.Uri;

export function activate(context: vscode.ExtensionContext) {
  extensionUri = context.extensionUri;
  const disposable = vscode.commands.registerCommand("sfccPipelineVisualizer.open", async (uri?: vscode.Uri) => {
    await openPipelineVisualiser(context, uri);
  });

  // Auto-open visualiser when a pipeline XML file is opened
  const onDocumentOpen = vscode.workspace.onDidOpenTextDocument(async (document) => {
    if (isPipelineFile(document)) {
      await openPipelineVisualiser(context, document.uri);
    }
  });

  // Update visualiser when the pipeline file is saved
  const onDocumentSave = vscode.workspace.onDidSaveTextDocument(async (document) => {
    if (isPipelineFile(document)) {
      const panel = openPanels.get(document.uri.fsPath);
      if (panel) {
        await refreshPanelContent(panel, document.uri);
      }
    }
  });

  // Check if any already-open editors contain pipeline files
  for (const editor of vscode.window.visibleTextEditors) {
    if (isPipelineFile(editor.document)) {
      openPipelineVisualiser(context, editor.document.uri);
      break; // Only open one on activation
    }
  }

  context.subscriptions.push(disposable, onDocumentOpen, onDocumentSave);
}

export function deactivate() {
  // Dispose all tracked panels
  for (const panel of openPanels.values()) {
    panel.dispose();
  }
  openPanels.clear();
}

/**
 * Detect if a document is a pipeline XML file.
 * Checks file path patterns and XML content for pipeline markers.
 */
function isPipelineFile(document: vscode.TextDocument): boolean {
  // Must be XML
  if (document.languageId !== "xml" && !document.uri.fsPath.toLowerCase().endsWith(".xml")) {
    return false;
  }

  // Check path patterns commonly used for pipelines
  const fsPath = document.uri.fsPath.toLowerCase();
  if (fsPath.includes("/pipelines/") || fsPath.includes("\\pipelines\\") || fsPath.includes("pipeline_examples")) {
    return true;
  }

  // Check XML content for pipeline root element (first 500 chars)
  const fullText = document.getText();
  const text = fullText.substring(0, Math.min(fullText.length, 500));
  return text.includes("<pipeline") || text.includes("<Pipeline");
}

async function openPipelineVisualiser(context: vscode.ExtensionContext, resource?: vscode.Uri) {
  if (!vscode.workspace.isTrusted) {
    const choice = await vscode.window.showWarningMessage(
      "Workspace is untrusted. The visualiser will read the selected XML file only.",
      "Proceed",
      "Cancel"
    );
    if (choice !== "Proceed") {
      return;
    }
  }

  const targetUri = resource || guessActivePipeline() || (await promptForPipelineFile());
  if (!targetUri) {
    vscode.window.showWarningMessage("Select a pipeline XML file to visualise.");
    return;
  }

  // If panel already exists for this file, reveal it instead of creating a new one
  const existingPanel = openPanels.get(targetUri.fsPath);
  if (existingPanel) {
    existingPanel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  let xml: string;
  try {
    const raw = await vscode.workspace.fs.readFile(targetUri);
    xml = new TextDecoder().decode(raw);
  } catch (error) {
    vscode.window.showErrorMessage(`Unable to read ${targetUri.fsPath}: ${(error as Error).message}`);
    return;
  }

  let parsed;
  try {
    parsed = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Parsing SFCC pipeline...",
      },
      async () => parsePipeline(xml, basename(targetUri.fsPath))
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to parse pipeline: ${(error as Error).message}`);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "sfccPipelineVisualizer",
    `Pipeline: ${parsed.name}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "node_modules")],
    }
  );

  panel.webview.html = getWebviewContent({
    webview: panel.webview,
    pipeline: parsed,
    sourceUri: targetUri,
    extensionUri: context.extensionUri,
  });

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.type) {
        case "navigateToPipeline":
          await handleNavigateToPipeline(context, message.pipeline, message.startNode);
          break;
      }
    },
    undefined,
    context.subscriptions
  );

  // Track the panel
  openPanels.set(targetUri.fsPath, panel);

  // Clean up when panel is closed
  panel.onDidDispose(() => {
    openPanels.delete(targetUri.fsPath);
  });
}

/**
 * Refresh the content of an existing panel when the source file changes.
 */
async function refreshPanelContent(panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
  let xml: string;
  try {
    const raw = await vscode.workspace.fs.readFile(uri);
    xml = new TextDecoder().decode(raw);
  } catch {
    return; // Silently fail on refresh errors
  }

  let parsed;
  try {
    parsed = parsePipeline(xml, basename(uri.fsPath));
  } catch {
    return; // Silently fail on parse errors during refresh
  }

  panel.webview.html = getWebviewContent({
    webview: panel.webview,
    pipeline: parsed,
    sourceUri: uri,
    extensionUri,
  });
}

/**
 * Handle navigation to a different pipeline file
 */
async function handleNavigateToPipeline(
  context: vscode.ExtensionContext,
  pipelineName: string,
  startNode: string
): Promise<void> {
  // Search for the pipeline file in the workspace
  const pipelineUri = await findPipelineFile(pipelineName);
  
  if (!pipelineUri) {
    vscode.window.showWarningMessage(`Pipeline "${pipelineName}" not found in workspace.`);
    return;
  }

  // Check if panel already exists for this file
  const existingPanel = openPanels.get(pipelineUri.fsPath);
  if (existingPanel) {
    existingPanel.reveal(vscode.ViewColumn.Beside);
    // Send message to navigate to the start node
    existingPanel.webview.postMessage({
      type: "navigateToStartNode",
      startNode: startNode,
    });
    return;
  }

  // Open the pipeline file
  let xml: string;
  try {
    const raw = await vscode.workspace.fs.readFile(pipelineUri);
    xml = new TextDecoder().decode(raw);
  } catch (error) {
    vscode.window.showErrorMessage(`Unable to read ${pipelineUri.fsPath}: ${(error as Error).message}`);
    return;
  }

  let parsed;
  try {
    parsed = parsePipeline(xml, basename(pipelineUri.fsPath));
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to parse pipeline: ${(error as Error).message}`);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "sfccPipelineVisualizer",
    `Pipeline: ${parsed.name}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "node_modules")],
    }
  );

  panel.webview.html = getWebviewContent({
    webview: panel.webview,
    pipeline: parsed,
    sourceUri: pipelineUri,
    extensionUri: context.extensionUri,
    navigateToStartNode: startNode,
  });

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.type) {
        case "navigateToPipeline":
          await handleNavigateToPipeline(context, message.pipeline, message.startNode);
          break;
      }
    },
    undefined,
    context.subscriptions
  );

  // Track the panel
  openPanels.set(pipelineUri.fsPath, panel);

  // Clean up when panel is closed
  panel.onDidDispose(() => {
    openPanels.delete(pipelineUri.fsPath);
  });
}

/**
 * Search for a pipeline file by name in the workspace
 */
async function findPipelineFile(pipelineName: string): Promise<vscode.Uri | undefined> {
  // Search for XML files with the pipeline name
  const patterns = [
    `**/${pipelineName}.xml`,
    `**/pipelines/${pipelineName}.xml`,
    `**/pipeline_examples/${pipelineName}.xml`,
  ];

  for (const pattern of patterns) {
    const files = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 1);
    if (files.length > 0) {
      // Verify it's actually a pipeline file
      try {
        const raw = await vscode.workspace.fs.readFile(files[0]);
        const content = new TextDecoder().decode(raw);
        if (content.includes("<pipeline") || content.includes("<Pipeline")) {
          return files[0];
        }
      } catch {
        continue;
      }
    }
  }

  // Broader search - find all XML files and check their names
  const allXmlFiles = await vscode.workspace.findFiles("**/*.xml", "**/node_modules/**", 100);
  for (const file of allXmlFiles) {
    const fileName = basename(file.fsPath).toLowerCase();
    if (fileName.toLowerCase() === pipelineName.toLowerCase()) {
      try {
        const raw = await vscode.workspace.fs.readFile(file);
        const content = new TextDecoder().decode(raw);
        if (content.includes("<pipeline") || content.includes("<Pipeline")) {
          return file;
        }
      } catch {
        continue;
      }
    }
  }

  return undefined;
}

function guessActivePipeline(): vscode.Uri | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  const uri = editor.document.uri;
  if (uri.scheme !== "file") {
    return undefined;
  }

  if (editor.document.languageId === "xml" || uri.fsPath.toLowerCase().endsWith(".xml")) {
    return uri;
  }

  return undefined;
}

async function promptForPipelineFile(): Promise<vscode.Uri | undefined> {
  const defaultUri = getDefaultPipelineFolder();
  const result = await vscode.window.showOpenDialog({
    title: "Select SFCC pipeline XML",
    canSelectMany: false,
    filters: { XML: ["xml"] },
    defaultUri,
  });

  if (!result || result.length === 0) {
    return undefined;
  }

  return result[0];
}

function getDefaultPipelineFolder(): vscode.Uri | undefined {
  const workspace = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!workspace) {
    return undefined;
  }
  return vscode.Uri.joinPath(workspace, "pipeline_examples");
}

function basename(path: string): string {
  const segments = path.split(/\\|\//);
  const last = segments.pop() || path;
  const dot = last.lastIndexOf(".");
  return dot > 0 ? last.slice(0, dot) : last;
}
