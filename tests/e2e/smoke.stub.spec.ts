import { expect, test, type Page } from "@playwright/test";
import { placeholderSvg } from "./fixtures/poster-placeholder";
import { tmdbStub } from "./fixtures/tmdb.stub";

const imageRoutes = ["**://image.tmdb.org/**", "**://www.themoviedb.org/assets/**", "**://www.google.com/**"];

async function installStubRoutes(page: Page) {
  await page.route("**://*/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;

    if (pathname.endsWith("/api/movies/popular") || pathname.endsWith("/api/movie/popular")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tmdbStub.lists.popular) });
      return;
    }

    if (pathname.endsWith("/api/movies/upcoming") || pathname.endsWith("/api/movie/upcoming")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tmdbStub.lists.upcoming) });
      return;
    }

    if (pathname.endsWith("/api/movies/now-playing") || pathname.endsWith("/api/movie/now_playing")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tmdbStub.lists.nowPlaying) });
      return;
    }

    if (pathname.endsWith("/api/genres") || pathname.endsWith("/api/genre/movie/list")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tmdbStub.genres) });
      return;
    }

    if (pathname.endsWith("/api/search/movies") || pathname.endsWith("/api/search/movie")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tmdbStub.search) });
      return;
    }

    const idMatch = pathname.match(/\/api\/(?:movies|movie)\/(\d+)$/);
    if (idMatch) {
      const id = Number.parseInt(idMatch[1], 10);
      const movie = tmdbStub.detailById[id];

      await route.fulfill({
        status: movie ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(movie ?? { error: "Not found" }),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
  });

  for (const pattern of imageRoutes) {
    await page.route(pattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: placeholderSvg,
      });
    });
  }
}

test.describe("Web App Smoke Tests (stub)", () => {
  test.beforeEach(async ({ page }) => {
    await installStubRoutes(page);
  });

  test("renders discover page with movie cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("DISCOVER")).toBeVisible();
    await expect(page.locator('[data-testid^="movie-poster-"]')).toHaveCount(3);
  });

  test("opens trailer overlay from movie detail", async ({ page }) => {
    await page.goto("/");

    await page.locator('[data-testid^="movie-poster-"]').first().click();

    await expect(page.getByTestId("play-trailer-button")).toBeVisible();
    await page.getByTestId("play-trailer-button").click();

    await expect(page.getByTestId("trailer-overlay")).toBeVisible();
    await expect(page.locator('iframe[title="Trailer"]')).toBeVisible();

    await page.getByTestId("trailer-overlay-close").click();
    await expect(page.getByTestId("trailer-overlay")).toHaveCount(0);
  });
});
