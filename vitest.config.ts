import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "src/lib/**/*.ts",
        "src/webview/**/*.ts",
        "src/webview-ui/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/types.ts",
        "**/konva-shim.ts",
        "**/main.ts",
        "**/state.ts",
        "**/stage.ts",
        "**/viewport.ts",
        "**/nodes.ts",
        "**/edges.ts",
        "**/selection.ts",
        "**/properties.ts",
        "**/controls.ts",
        "**/navigation.ts",
        "**/legend.ts",
        "**/icons.ts",
        "**/search.ts",
        "src/webview/getWebviewContent.ts",
        "src/webview/templates/**",
        "src/webview/styles/**",
        "src/webview/styles.ts",
        "src/extension.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      konva: "./src/webview-ui/konva-shim.ts",
    },
  },
});
