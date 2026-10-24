import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/spike",
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  reporter: "list",
  outputDir: "test-results/spike",
});
