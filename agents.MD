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

## Pull Request Checklist
- Activation events minimal and justified.
- Commands validated; errors handled; disposables registered.
- No blocking work on activation; heavy deps lazy-loaded.
- Tests updated/passing; lint/format clean; bundle size checked.
- Telemetry documented and optional; no PII in logs.
- Workspace trust respected; untrusted mode behavior defined.
# Developer Agent Guide: SFCC DX Tools

Authoring mandate: build Salesforce B2C Commerce (Demandware) developer-experience tooling that is stable, safe, and minimizes friction for teams. Default to SFRA-first patterns; avoid legacy pipelines unless explicitly required. Keep changes small, observable, and documented.

## Core Responsibilities
- Deliver tools that automate repetitive BM tasks (code version deploy/activate, cartridge path hygiene, job log retrieval) with least privilege access.
- Keep compatibility with SFRA 6+ and Node LTS; avoid platform overrides that break cartridge resolution or hooks.
- Respect data boundaries: never log PII; prefer sandbox test data; isolate environment configs per instance.
- Prefer declarative configuration (e.g., JSON/YAML for endpoints, cartridge lists) over code defaults; validate early with actionable errors.
- Treat Business Manager as an external surface: script against SCAPI/OCAPI or Admin APIs where possible; fall back to UI only when unavoidable.

## Project Setup (DX Tooling)
- Use TypeScript with `strict`; target ES2020+; enable `esModuleInterop`; no native modules unless justified.
- Enforce lint/format (ESLint + Prettier); fail CI on `no-floating-promises`, `no-unused-vars`, and unhandled rejections.
- Keep dependencies lean; prefer `node-fetch`/`undici`-style HTTP clients with timeouts and retry budgets.
- Configuration: require explicit instance host, client ID/secret, and timeouts; support proxies; load secrets from env or secret storage, never from repo.
- Logging: structured JSON where possible; mask credentials and customer identifiers.

## Cartridge and Code Version Hygiene
- Enforce cartridge naming conventions (`app_`, `int_`, `bm_`, `plugin_`); keep custom cartridges ahead of base only when necessary.
- Validate `Cartridges` path ordering before deploy; block deployments that shadow core controllers/templates unintentionally.
- Keep `package.json`/lockfiles inside cartridges for front-end builds; avoid global installs in pipelines or jobs.
- Prefer ISML with explicit encoding; avoid inline scripts that bypass CSP; keep templates localized via resource bundles.
- Clean code versions before upload (strip node_modules, maps, tests if not needed at runtime); use `sfcc-ci code:deploy` with predictable version names.

## SFRA Controllers and Middleware
- Use `server` module; avoid pipelines. Always attach `csrf`, `consentTracking`, and cache middleware where applicable.
- Validate request params; guard `req.querystring`/`req.form` usage; never trust client-provided price or inventory values.
- Set `Cache-Control`/`ETag` for GET endpoints; avoid caching logged-in or personalized content without variation keys.
- Return typed JSON for custom APIs; standardize error envelopes; avoid leaking stack traces.
- Keep view models thin; reuse SFRA models rather than rehydrating raw `Product`/`Basket` objects in templates.

## Integrations (SCAPI/OCAPI/Services)
- Prefer SCAPI for headless/data access; OCAPI for legacy flows; keep versions explicit and up to date.
- Define services via `LocalServiceRegistry`; set timeouts, circuit breaker thresholds, and retry policies; sanitize request/response logging.
- Store credentials in BM service credentials; never ship them in cartridges. Surface missing credential errors early with clear guidance.
- For DX tools, include validators for service profiles, client permissions, and scope coverage before making calls.

## Jobs and Data Workloads
- Use chunking/pagination for large datasets; avoid long transactions; commit frequently.
- Track progress with `JobStepExecution` and meaningful `Status` messages; keep logs concise and searchable.
- Fail fast on configuration gaps (site prefs, services, folders). Provide actionable remediation steps.
- When emitting files, write to `IMPEX` subdirectories; avoid writing outside allowed roots.

## Data Safety and Security
- Encode all output (ISML `${}` auto-encodes); avoid `raw` unless necessary and sanitized.
- Protect against path traversal and template injection; validate filenames and locales.
- Mask customer identifiers in logs; never persist credentials or JWTs to custom objects.
- Enforce HTTPS endpoints; reject mixed-content URLs; validate host allowlists for outbound calls.

## Performance and Caching
- Use `ICacheMgr`/`CacheMgr` for expensive lookups; key by locale/site/customer group where relevant; set sensible TTLs.
- Avoid synchronous file I/O in request flow; precompute static assets at build time.
- Defer heavy calculations to jobs; keep controllers focused on request/response glue.
- Measure: add lightweight timing logs around services and model building; keep sampling low in production.

## Testing and Quality
- Unit-test controllers and helpers with `mocha`/`chai`/`sinon` or Jest + `proxyquire`; mock `server` and SFCC globals.
- Add contract tests for services with recorded fixtures; ensure error paths are covered.
- Lint ISML where possible (whitespace, encoding, resource keys); run type checks in CI; block deploys on lint/test failures.
- Prefer ephemeral sandboxes for integration checks; avoid touching shared data; reset fixtures per run.

## Deployments and Environments
- Standardize code version names (`project-branch-buildNumber`); never activate blindly—verify cartridge path and migrations.
- Automate `sfcc-ci` flows: upload, activate, clean old versions; support dry runs and rollback steps.
- Keep environment mappings explicit (sandbox/stage/prod); prevent cross-environment credential reuse.
- Include post-deploy smoke tests (controller ping, OCAPI token fetch, service health check).

## Observability and Telemetry
- Use `dw/system/Logger` categories per feature; avoid verbose logging in hot paths.
- Surface user-facing errors via friendly messages; store detail in logs with correlation IDs.
- Make any telemetry opt-in; document what is collected; strip request/response bodies unless scrubbed.

## DX Tooling Focus Areas
- Scaffolding: generate cartridges/controllers/hooks/tests with safe defaults (CSRF, consent, cache, localization).
- Validation: detect cartridge path conflicts, missing service creds, OCAPI/SCAPI scope gaps, and resource bundle drift.
- Productivity: commands for job log tailing, code version hygiene, sandbox data seeding (non-PII), and BM export/import helpers.
- Safety rails: preflight checks before deploy, guardrails for destructive operations, and consistent error envelopes.

## Pull Request Checklist
- Config validated (hosts, scopes, credentials presence); dry-run deploy passes.
- Lint/test clean; type checks green; integration fixtures updated.
- No PII or secrets in logs, code, or artifacts; telemetry (if any) documented and optional.
- Code version packaging trimmed; cartridge path verified; rollback plan noted.
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

## Pull Request Checklist
- Activation events minimal and justified.
- Commands validated; errors handled; disposables registered.
- No blocking work on activation; heavy deps lazy-loaded.
- Tests updated/passing; lint/format clean; bundle size checked.
- Telemetry documented and optional; no PII in logs.
- Workspace trust respected; untrusted mode behavior defined.
