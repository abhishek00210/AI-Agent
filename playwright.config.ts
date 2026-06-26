import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 1,
  reporter: [["list"], ["json", { outputFile: "test-results/playwright-results.json" }]],
  use: {
    baseURL: process.env.E2E_WEB_URL ?? "https://agent.zodo.ca",
    extraHTTPHeaders: { "user-agent": "zodo-launch-readiness/1.0" },
  },
});
