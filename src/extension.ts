import * as vscode from "vscode";
import { parsePipeline } from "./lib/pipelineParser";
import { getWebviewContent } from "./webview/getWebviewContent";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("sfccPipelineVisualizer.open", async (uri?: vscode.Uri) => {
    await openPipelineVisualiser(context, uri);
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {
  // Nothing to dispose explicitly yet
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
      retainContextWhenHidden: false,
    }
  );

  panel.webview.html = getWebviewContent(panel.webview, parsed, targetUri);
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
