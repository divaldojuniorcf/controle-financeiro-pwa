import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "servidor/src/**/*.test.ts"],
    environment: "node",
  },
});
