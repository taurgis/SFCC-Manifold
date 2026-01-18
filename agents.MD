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

### ESLint Rules

The project enforces these key linting rules (see `eslint.config.mjs`):

| Rule | Level | Description |
|------|-------|-------------|
| `@typescript-eslint/no-unused-vars` | error | No unused variables (prefix with `_` to ignore) |
| `@typescript-eslint/no-floating-promises` | error | All promises must be awaited, caught, or voided |
| `@typescript-eslint/no-explicit-any` | warn | Avoid `any` type; use proper types |
| `@typescript-eslint/no-non-null-assertion` | warn | Avoid `!` assertions; prefer optional chaining |
| `eqeqeq` | error | Always use `===` and `!==` |
| `curly` | error | Always use braces for control statements |
| `prefer-const` | error | Use `const` when variable is never reassigned |
| `no-var` | error | Use `let` or `const` instead of `var` |
| `no-console` | warn | Avoid console statements (off in tests/scripts) |

**Git Hooks (Husky):**
- **Pre-commit**: Runs `npm run lint` - blocks commit if linting fails
- **Pre-push**: Runs `npm test` - blocks push if tests fail

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
| `npm run dump-layout -- <pipeline.xml> [-o out.txt] [--cell-width N] [--show-bendpoints] [-F|--full-layout] [-b|--branch <name>]` | Generate an ASCII layout dump (grid, nodes, edges with in/out sides, anchors, optional bendpoints, optional coarse full-layout sketch ~12px/cell with join nodes as circles and edges routed around boxes). Writes to `debug/layouts/<name>.txt` by default (or `<name>_<branch>.txt` when filtering); `--cell-width` widens grid labels; `--branch` filters to a single start node/branch and its sub-branches. |

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

```
