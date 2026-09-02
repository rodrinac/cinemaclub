import { devices, expect, test, type Page } from "@playwright/test";

const mobilePreset = devices["iPhone 13"];
const SCREENSHOT_RENDER_DELAY_MS = 1200;
const SEARCH_SCREENSHOT_READY_TIMEOUT_MS = 10000;
const SEARCH_SCREENSHOT_FALLBACK_DELAY_MS = 1500;

const waitForScreenshotRender = async (page: Page) => {
  await page.waitForTimeout(SCREENSHOT_RENDER_DELAY_MS);
};

const waitForSearchScreenshotReady = async (page: Page) => {
  const searchResultPosters = page.locator('[data-testid^="movie-poster-"]');
  const searchResultImages = page.locator('[data-testid^="movie-poster-"] img');

  try {
    await expect(searchResultPosters.first()).toBeVisible({
      timeout: SEARCH_SCREENSHOT_READY_TIMEOUT_MS,
    });
    await expect(searchResultImages.first()).toBeVisible({
      timeout: SCREENSHOT_RENDER_DELAY_MS,
    });
  } catch {
    await page.waitForTimeout(SEARCH_SCREENSHOT_FALLBACK_DELAY_MS);
  }

  await waitForScreenshotRender(page);
};

test.use({
  viewport: mobilePreset.viewport,
  userAgent: mobilePreset.userAgent,
  deviceScaleFactor: mobilePreset.deviceScaleFactor,
  isMobile: mobilePreset.isMobile,
  hasTouch: mobilePreset.hasTouch,
});

test.describe("README live mobile screenshots", () => {
  test("captures discover, search, and movie detail screens", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("DISCOVER", { exact: true })).toBeVisible();
    const posters = page.locator('[data-testid^="movie-poster-"]');
    await expect(posters.first()).toBeVisible({ timeout: 30000 });

    await waitForScreenshotRender(page);
    await page.screenshot({ path: "showcase/screenshot_01.png", fullPage: false });

    await page.getByTestId("footer-search").click();
    await expect(page.getByText("SEARCH", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("🔍 Search a movie")).toBeVisible();

    await waitForSearchScreenshotReady(page);
    await page.screenshot({ path: "showcase/screenshot_02.png", fullPage: false });

    await page.goto("/");
    await expect(posters.first()).toBeVisible({ timeout: 30000 });
    await posters.first().click();
    await expect(page.getByTestId("play-trailer-button")).toBeVisible({ timeout: 15000 });

    await waitForScreenshotRender(page);
    await page.screenshot({ path: "showcase/screenshot_03.png", fullPage: false });
  });
});
