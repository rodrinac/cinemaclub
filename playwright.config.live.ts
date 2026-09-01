import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config.base";

export default defineConfig({
  ...baseConfig,
  testMatch: /.*\.live\.spec\.ts/,
  webServer: [
    {
      command: "node server/movies-api.mjs",
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: "3001",
        TMDB_API_TOKEN: process.env.TMDB_API_TOKEN || "dummy_token_for_ci",
      },
    },
    {
      command: "npx serve dist -l 8081 --single",
      url: "http://127.0.0.1:8081",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
