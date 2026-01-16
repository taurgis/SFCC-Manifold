# SFCC Manifold - Project Structure

This VS Code extension visualizes Salesforce Commerce Cloud (Demandware) pipeline XML files as interactive canvas graphs.

---

## Senior VS Code Extension Developer Persona

You are a **senior VS Code extension developer** with deep expertise in:

- **TypeScript** and modern JavaScript (ES2020+)
- **VS Code Extension APIs** including custom editors, webviews, commands, and activation events
- **Webview development** with proper CSP, nonce-based scripts, and secure messaging
- **Canvas rendering** using Konva.js for high-performance 2D graphics
- **esbuild** for fast bundling with separate Node.js and browser targets
- **Salesforce Commerce Cloud (SFCC)** pipeline XML structure and semantics

### Coding Standards

- Write clean, well-documented TypeScript with strict type checking
- Follow VS Code extension best practices (lean activation, proper disposables, CSP compliance)
- Prefer functional patterns; avoid unnecessary classes
- Use meaningful variable names; keep functions focused and small
- Handle errors gracefully with user-friendly messages
- Optimize for performance: lazy loading, viewport culling, debouncing

### When Making Changes

1. **Understand the architecture**: Know which context (Node.js vs browser) your code runs in
2. **Check existing patterns**: Follow established conventions in the codebase
3. **Test incrementally**: Build and test after each significant change
4. **Keep bundles separate**: Extension code vs webview code must not cross boundaries
5. **Maintain state carefully**: Use the centralized state module to avoid circular dependencies

---

## Architecture Overview

The extension has two main runtime contexts:

1. **Node.js (Extension Host)** - Parses XML, generates HTML, handles VS Code APIs
2. **Browser (Webview)** - Renders the interactive Konva.js canvas

## Directory Structure

```
src/
├── extension.ts              # Extension entry point, custom editor provider
├── lib/
│   ├── pipelineParser.ts     # XML → pipeline data structure parser
│   └── types.ts              # Shared TypeScript types
├── webview/                  # HTML generation (runs in Node.js)
│   ├── getWebviewContent.ts  # Main HTML generator, assembles full page
│   ├── helpers.ts            # HTML escaping, nonce generation
│   ├── icons.ts              # SVG icons for HTML templates
│   ├── styles.ts             # Main CSS styles
│   ├── styles/
│   │   └── propertiesPanel.ts # Properties panel CSS
│   └── templates/
│       ├── canvas.ts         # Canvas area HTML (controls, panels)
│       └── propertiesPanel.ts # Properties panel HTML structure
└── webview-ui/               # Canvas runtime (runs in browser)
    ├── main.ts               # Entry point, initializes everything
    ├── konva-shim.ts         # Shim to access global Konva from window
    ├── constants.ts          # Colors, layout config, zoom config
    ├── types.ts              # Browser-side TypeScript types
    ├── state.ts              # Centralized mutable state
    ├── layout.ts             # Node positioning algorithm
    ├── stage.ts              # Konva stage & layer setup
    ├── viewport.ts           # Viewport culling for performance
    ├── nodes.ts              # Node rendering (rectangles, labels)
    ├── edges.ts              # Edge routing & rendering
    ├── selection.ts          # Node/edge selection handling
    ├── properties.ts         # Properties panel data binding
    ├── controls.ts           # Zoom buttons, floating panels
    ├── navigation.ts         # VS Code messaging, pipeline navigation
    ├── legend.ts             # Node type legend rendering
    ├── icons.ts              # SVG icons for runtime UI
    └── utils.ts              # Helper functions
```

## Build System

The project uses **esbuild** for fast bundling with two separate build targets:

| Target | Entry | Output | Platform | Format |
|--------|-------|--------|----------|--------|
| Extension | `src/extension.ts` | `dist/extension.js` | Node.js | CommonJS |
| Webview | `src/webview-ui/main.ts` | `dist/webview.js` | Browser | IIFE |

### Why Two Bundles?

- **Extension bundle**: Runs in VS Code's extension host (Node.js). Has access to `vscode` APIs, file system, etc.
- **Webview bundle**: Runs in a sandboxed browser context inside VS Code. Uses Konva.js for canvas rendering. Cannot access Node.js or VS Code APIs directly.

### Konva.js Loading

Konva is loaded via a `<script>` tag in the webview HTML (from `node_modules/konva/konva.min.js`). The webview bundle uses `konva-shim.ts` to access `window.Konva` and provide it to TypeScript modules.

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run compile` | Build both extension and webview bundles |
| `npm run watch` | Watch mode for development (rebuilds on changes) |
| `npm run esbuild-extension` | Build only the extension bundle |
| `npm run esbuild-webview` | Build only the webview bundle |
| `npm run vscode:prepublish` | Production build with minification (for publishing) |
| `npm run dump-layout -- <pipeline.xml> [-o out.txt] [--cell-width N] [--show-bendpoints] [-F|--full-layout]` | Generate an ASCII layout dump (grid, nodes, edges with in/out sides, anchors, optional bendpoints, optional coarse full-layout sketch with routed edges). Writes to `debug/layouts/<name>.txt` by default; `--cell-width` widens grid labels. |

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Pipeline XML   │────▶│  pipelineParser  │────▶│  ParsedPipeline │
│  (*.xml file)   │     │  (Node.js)       │     │  {nodes, edges} │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐              │
                        │ getWebviewContent│◀─────────────┘
                        │ (generates HTML) │
                        └────────┬─────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Webview (Browser)                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐ │
│  │ window.     │───▶│   main.ts   │───▶│ Konva Stage + Layers    │ │
│  │ pipelineData│    │ (initialize)│    │ (nodes, edges, grid)    │ │
│  └─────────────┘    └─────────────┘    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Files Explained

### `src/extension.ts`
Registers the custom editor provider for `**/pipelines/*.xml` files. Creates webview panels with proper CSP and resource roots.

### `src/lib/pipelineParser.ts`
Parses SFCC pipeline XML using `@xmldom/xmldom`. Extracts nodes (start points, pipelets, decisions, etc.) and edges (transitions between nodes).

### `src/webview/getWebviewContent.ts`
Generates the complete HTML document. Injects:
- CSP meta tag with nonces
- CSS styles
- Pipeline data as `window.pipelineData`
- Konva.js script
- Webview bundle script

### `src/webview-ui/main.ts`
Browser entry point. Reads `window.pipelineData`, calculates layout, initializes Konva stage, draws nodes/edges, and sets up event handlers.

### `src/webview-ui/state.ts`
Centralized state to avoid circular dependencies between modules. Stores references to placed nodes, edge groups, selection state, etc.

---

# Developer Agent Guide: VS Code Extension Authoring

Authoring mandate: build VS Code extensions that are stable, secure, and idiomatic. Default to stable APIs unless a proposed API is explicitly approved. Keep changes minimal, tested, and documented.

## Core Responsibilities
- Design extensions around clear, minimal features; avoid unnecessary activation or global state.
- Prefer declarative contributions in `package.json` over imperative runtime code.
- Guard activation with precise `activationEvents`; avoid `*` unless truly required.
- Follow workspace trust: degrade gracefully or disable risky features when untrusted.
- Keep telemetry opt-in, minimal, and privacy-respecting; document data collection.

## Project Setup
- Use TypeScript with `strict` enabled; target ES2020+; configure `esModuleInterop` and `skipLibCheck: false`.
- Enforce linting/formatting (ESLint + Prettier) with CI; enable `no-floating-promises` and `no-unused-vars`.
- Structure: `src/extension.ts` (entry), feature modules under `src/features/<feature>/`, utils under `src/lib/`.
- Ship typings and minimal dependencies; avoid native modules unless necessary.

## Extension Entry (`activate` / `deactivate`)
- Keep `activate` lean: register commands, providers, disposables; avoid long sync work.
- Always return a composite `Disposable` or push to `context.subscriptions`.
- Ensure `deactivate` disposes external resources (servers, watchers, timers, sockets).

## Commands and Contributions
- Use clear, namespaced command IDs (e.g., `yourExtension.doThing`).
- Validate inputs from `vscode.window.showInputBox` and other user inputs.
- Prefer `vscode.workspace.fs` over `fs` for file I/O to respect remote/virtual workspaces.
- Keep UI non-blocking; use `withProgress` for long tasks; surface errors via `showErrorMessage` with actions.
- For status updates, prefer `window.setStatusBarMessage` with disposables and timeouts.

## Activation Events
- Use specific events: `onCommand`, `onLanguage`, `workspaceContains`, `onStartupFinished` only when needed.
- For large feature sets, split into separate activation points to avoid loading unused code.

## Performance and Memory
- Lazy-load heavy modules; avoid large static imports in `activate`.
- Debounce file/system watchers; batch file ops; close watchers on dispose.
- Cache intelligently; invalidate on workspace changes; avoid unbounded maps/sets.
- Avoid blocking the extension host; use async I/O and short-running computations.

## Error Handling and Logging
- Wrap async commands with try/catch; convert unknown errors to readable messages.
- Use `vscode.window.showErrorMessage` sparingly; prefer output channel logging for detail.
- Include actionable error messages; never leak PII in logs or telemetry.
- Fail fast on misconfiguration; guide the user to resolve (docs link, command to open settings).

## Testing and Quality
- Add unit tests with `@vscode/test-electron`; cover activation paths and command behavior.
- Mock VS Code APIs with `vscode-test` utilities; avoid hitting network/filesystem in unit tests.
- Add integration tests for critical flows; run in CI (GitHub Actions recommended).
- Maintain a CHANGELOG and semantic versioning; document breaking changes clearly.

## UI/UX Guidelines
- Respect theme colors; use `ThemeColor` tokens; avoid hardcoded colors and fonts.
- Prefer native UI (`QuickPick`, `InputBox`, `TreeView`, `WebviewView`) over custom webviews.
- For webviews: use CSP (`Content-Security-Policy`), nonce scripts, no inline eval; keep assets local.
- Provide keyboard access and ARIA labels; keep focus states visible.

## Configuration and Settings
- Namespaced settings under `yourExtension.*`; include descriptions, types, defaults.
- Validate settings at runtime; respond to `onDidChangeConfiguration` to refresh behavior.
- Avoid writing to workspace files unless user-approved; support multi-root workspaces.

## Telemetry and Privacy
- Collect only essential events; document what and why; respect VS Code telemetry opt-out.
- Provide a setting to disable extension-specific telemetry; do not collect document content.

## Packaging and Publishing
- Keep bundle small; tree-shake; exclude tests, configs, and large assets via `files` or `.vscodeignore`.
- Verify `engines.vscode` matches tested versions; avoid depending on insiders-only APIs.
- Signpost licensing of dependencies; avoid GPL/AGPL unless approved.

## Security Practices
- Do not spawn shells without sanitizing inputs; avoid `eval`/`Function` constructors.
- Validate URIs and paths; avoid writing outside the workspace without confirmation.
- Use HTTPS for remote calls; pin endpoints; handle timeouts and retries with limits.
- Keep secrets out of logs; prefer VS Code `SecretStorage`.

## Diagnostics and Language Features
- For diagnostics, batch updates; use `DiagnosticCollection` with clear sources and severities.
- For providers (completion, hover, code actions), be fast and cancel-aware; respect `CancellationToken`.
- Return empty results instead of throwing on cancellation.

## Git and Workspace Etiquette
- Never assume git is present; handle failures gracefully.
- Respect virtual and remote workspaces; avoid direct `process`/`os` assumptions.

## Minimal Skeleton (TypeScript)
```ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('yourExtension.hello', async () => {
    await vscode.window.showInformationMessage('Hello from your extension');
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {
  // Dispose resources if any
}
```
---