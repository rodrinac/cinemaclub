import { expect, test } from "@playwright/test";

test.describe("API Server Smoke Tests (live)", () => {
  test("health endpoint returns 200 OK", async ({ request }) => {
    const response = await request.get("http://127.0.0.1:3001/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("rejects invalid method with 405", async ({ request }) => {
    const response = await request.post("http://127.0.0.1:3001/health");
    expect(response.status()).toBe(405);
  });

  test("rejects path traversal with 400", async ({ request }) => {
    const response = await request.get("http://127.0.0.1:3001/api/..%2f..%2fetc/passwd");
    expect(response.status()).toBe(400);
  });
});

test.describe("Web App Smoke Tests (live)", () => {
  test("resolves home loading into movies or error state", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("DISCOVER", { exact: true })).toBeVisible();

    await expect
      .poll(
        async () => {
          if (await page.getByTestId("home-error-state").isVisible().catch(() => false)) {
            return "error";
          }

          if ((await page.locator('[data-testid^="movie-poster-"]').count()) > 0) {
            return "movies";
          }

          if (await page.getByTestId("home-loading-state").isVisible().catch(() => false)) {
            return "loading";
          }

          return "pending";
        },
        { timeout: 20000 },
      )
      .toMatch(/movies|error/);
    await expect(page.getByTestId("home-loading-state")).toHaveCount(0);
  });

  test("trailer modal can recover and release interaction", async ({ page }) => {
    await page.goto("/");

    await expect
      .poll(
        async () => {
          if (await page.getByTestId("home-error-state").isVisible().catch(() => false)) {
            return "error";
          }

          return (await page.locator('[data-testid^="movie-poster-"]').count()) > 0 ? "movies" : "loading";
        },
        { timeout: 20000 },
      )
      .toMatch(/movies|error/);

    if (await page.getByTestId("home-error-state").isVisible().catch(() => false)) {
      test.skip(true, "Skipping trailer check because live discover endpoint is unavailable.");
    }

    await page.locator('[data-testid^="movie-poster-"]').first().click();

    if ((await page.getByTestId("play-trailer-button").count()) === 0) {
      test.skip(true, "Skipping trailer check because selected movie has no trailer action.");
    }

    await page.getByTestId("play-trailer-button").click();
    await expect(page.getByTestId("trailer-overlay")).toBeVisible();

    await expect
      .poll(
        async () => {
          if ((await page.getByTestId("trailer-overlay-loading").count()) === 0) {
            return "ready";
          }

          if (await page.getByTestId("trailer-overlay-error").isVisible().catch(() => false)) {
            return "error";
          }

          return "loading";
        },
        { timeout: 12000 },
      )
      .toMatch(/ready|error/);

    if ((await page.getByTestId("trailer-overlay-error-close").count()) > 0) {
      await page.getByTestId("trailer-overlay-error-close").click();
    } else {
      await page.getByTestId("trailer-overlay-close").click();
    }

    await expect(page.getByTestId("trailer-overlay")).toHaveCount(0);
    await page.getByTestId("movie-detail-back-button").click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByTestId("home-tab-now").click();
    await expect(page.locator('[data-testid^="movie-poster-"]').first()).toBeVisible();
  });
});
