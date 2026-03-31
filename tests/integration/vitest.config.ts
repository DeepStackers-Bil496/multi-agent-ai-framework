import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    root: path.resolve(__dirname, "../.."),
    setupFiles: [path.resolve(__dirname, "../../unit-tests/setup.ts")],
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../.."),
    },
  },
});
