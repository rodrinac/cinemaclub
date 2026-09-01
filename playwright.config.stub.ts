import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config.base";

export default defineConfig({
  ...baseConfig,
  testMatch: /.*\.stub\.spec\.ts/,
  webServer: {
    command: "npx serve dist -l 8081 --single",
    url: "http://127.0.0.1:8081",
    reuseExistingServer: !process.env.CI,
  },
});
