import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolves the "@/*" import alias from tsconfig.json natively.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
