# SFCC Pipeline Visualiser

A minimal VS Code extension to render Salesforce Commerce Cloud (Demandware) pipeline XML files as interactive graphs. It reads pipeline definitions (branches, nodes, transitions) and displays them in a webview. Editing is intentionally out of scope.

## Features
- Command: **SFCC Pipeline: Open SFCC Pipeline Visualiser** (`sfccPipelineVisualizer.open`).
- Uses the active XML file or lets you pick another pipeline file (defaults to `pipeline_examples`).
- Parses start/end nodes, pipelets, calls/jumps, decision/join/loop nodes, interaction templates, and nested branches.
- Shows node counts, edge counts, and pipeline metadata; color-coded legend; edge labels when present.
- Layout prefers stored `node-display` coordinates; falls back to a grid when missing.

## Usage
1. Install dependencies: `npm install`.
2. Build: `npm run compile` (or `npm run watch`).
3. Press `F5` to launch the extension host for debugging.
4. Run **SFCC Pipeline: Open SFCC Pipeline Visualiser** from the Command Palette. If an XML file is active, it is used; otherwise, you are prompted to pick one.

## Notes and assumptions
- The visualiser is read-only and does not alter pipeline files.
- Branch connectors and transition labels are rendered when available; target-path details are not visualised yet.
- Workspace trust is respected: when untrusted, the command reads only the file you select.
- The graph intentionally avoids external assets or remote calls; everything is rendered locally in the webview.

## Project structure
- `src/extension.ts` — command registration and webview setup.
- `src/lib/pipelineParser.ts` — XML to graph model conversion.
- `src/webview/getWebviewContent.ts` — webview HTML/JS/CSS renderer.

## Limitations / future ideas
- Render `target-path` semantics and connector-specific routing.
- Add quick navigation from graph nodes back to source locations.
- Offer alternative layouts (e.g., dagre) for dense graphs.
- Add tests against the sample `pipeline_examples` fixtures.
