import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    root: path.resolve(__dirname, ".."),
    setupFiles: [path.resolve(__dirname, "setup.ts")],
    include: ["unit-tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["lib/**", "middleware.ts"],
      exclude: ["lib/db/**", "lib/agents/codebaseAgent/indexer.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".."),
    },
  },
});
