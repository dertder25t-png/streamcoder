import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [".runs/**/*.test.ts", ".runs/**/*.test.tsx"],
    environment: "node", // React tests opt in with: // @vitest-environment jsdom
    testTimeout: 10000,
    reporters: ["dot"],
  },
});
