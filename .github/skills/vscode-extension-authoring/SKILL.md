---
name: vscode-extension-authoring
description: Best practices for VS Code extension development. Use when building extensions, implementing commands, webviews, providers, or any VS Code API integration. Covers activation, disposables, security, testing, and publishing.
---

# VS Code Extension Authoring Guide

Build VS Code extensions that are stable, secure, and idiomatic. Default to stable APIs unless a proposed API is explicitly approved. Keep changes minimal, tested, and documented.

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

## Minimal Skeleton

```typescript
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
