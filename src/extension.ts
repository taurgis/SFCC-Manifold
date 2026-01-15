import * as vscode from "vscode";
import { parsePipeline } from "./lib/pipelineParser";
import { getWebviewContent } from "./webview/getWebviewContent";

/** Track open webview panels by document URI */
const documentWebviews = new Map<string, vscode.WebviewPanel>();

/** Store extension context for use across functions */
let extensionContext: vscode.ExtensionContext;

/**
 * Custom editor provider for SFCC Pipeline files
 */
class PipelineEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = "sfccPipelineVisualizer.pipelineEditor";

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Setup webview options
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "node_modules")],
    };

    // Initial render
    await this.updateWebview(document, webviewPanel);

    // Track the webview
    documentWebviews.set(document.uri.toString(), webviewPanel);

    // Listen for document changes
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.updateWebview(document, webviewPanel);
      }
    });

    // Handle messages from the webview
    webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case "navigateToPipeline":
            await handleNavigateToPipeline(this.context, message.pipeline, message.startNode);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );

    // Clean up when the editor is closed
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      documentWebviews.delete(document.uri.toString());
    });
  }

  private async updateWebview(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
    const xml = document.getText();
    
    try {
      const parsed = parsePipeline(xml, basename(document.uri.fsPath));
      
      webviewPanel.webview.html = getWebviewContent({
        webview: webviewPanel.webview,
        pipeline: parsed,
        sourceUri: document.uri,
        extensionUri: this.context.extensionUri,
      });
    } catch (error) {
      // Show error state in webview
      webviewPanel.webview.html = this.getErrorHtml((error as Error).message);
    }
  }

  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #0b1021;
      color: #ff8a7a;
      font-family: system-ui, sans-serif;
    }
    .error {
      text-align: center;
      padding: 2rem;
    }
    .error h2 { margin-bottom: 1rem; }
    .error pre {
      background: rgba(255,255,255,0.1);
      padding: 1rem;
      border-radius: 4px;
      max-width: 600px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="error">
    <h2>Failed to parse pipeline</h2>
    <pre>${escapeHtml(message)}</pre>
    <p>Use the "Open Source" button to view the raw XML.</p>
  </div>
</body>
</html>`;
  }
}

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;

  // Register the custom editor provider
  const provider = new PipelineEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      PipelineEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  // Command to open the visualizer (from command palette or for non-default paths)
  const openVisualizerCommand = vscode.commands.registerCommand(
    "sfccPipelineVisualizer.open",
    async (uri?: vscode.Uri) => {
      const targetUri = uri || guessActivePipeline() || (await promptForPipelineFile());
      if (!targetUri) {
        vscode.window.showWarningMessage("Select a pipeline XML file to visualise.");
        return;
      }

      // Open with our custom editor
      await vscode.commands.executeCommand(
        "vscode.openWith",
        targetUri,
        PipelineEditorProvider.viewType
      );
    }
  );

  // Command to open the source XML
  const openSourceCommand = vscode.commands.registerCommand(
    "sfccPipelineVisualizer.openSource",
    async () => {
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
      if (activeTab?.input && typeof activeTab.input === "object" && "uri" in activeTab.input) {
        const uri = (activeTab.input as { uri: vscode.Uri }).uri;
        // Open with default text editor
        await vscode.commands.executeCommand("vscode.openWith", uri, "default");
      }
    }
  );

  // Command to open the visualizer from text editor
  const openVisualizerFromTextCommand = vscode.commands.registerCommand(
    "sfccPipelineVisualizer.openVisualizer",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await vscode.commands.executeCommand(
          "vscode.openWith",
          editor.document.uri,
          PipelineEditorProvider.viewType
        );
      }
    }
  );

  context.subscriptions.push(openVisualizerCommand, openSourceCommand, openVisualizerFromTextCommand);
}

export function deactivate() {
  documentWebviews.clear();
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

  // Check if there's already a webview for this document
  const existingWebview = documentWebviews.get(pipelineUri.toString());
  if (existingWebview) {
    existingWebview.reveal();
    // Send message to navigate to the start node
    existingWebview.webview.postMessage({
      type: "navigateToStartNode",
      startNode: startNode,
    });
    return;
  }

  // Open with our custom editor
  await vscode.commands.executeCommand(
    "vscode.openWith",
    pipelineUri,
    PipelineEditorProvider.viewType
  );

  // After opening, send navigation message
  setTimeout(() => {
    const webview = documentWebviews.get(pipelineUri.toString());
    if (webview) {
      webview.webview.postMessage({
        type: "navigateToStartNode",
        startNode: startNode,
      });
    }
  }, 500);
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
    if (fileName === pipelineName.toLowerCase()) {
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
