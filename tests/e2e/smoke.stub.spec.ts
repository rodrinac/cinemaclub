import { expect, test, type Page } from "@playwright/test";
import { placeholderSvg } from "./fixtures/poster-placeholder";
import { tmdbStub } from "./fixtures/tmdb.stub";

const imageRoutes = [
  "**://image.tmdb.org/**",
  "**://www.themoviedb.org/assets/**",
  "**://www.google.com/**",
];

const buildScrollablePopularList = () => {
  const baseMovies = tmdbStub.lists.popular.results;
  const results = Array.from({ length: 60 }, (_, index) => {
    const template = baseMovies[index % baseMovies.length];
    return {
      ...template,
      id: 9200 + index,
      title: `${template.title} ${index + 1}`,
      original_title: `${template.original_title} ${index + 1}`,
      overview: `${template.overview} (${index + 1})`,
    };
  });

  return {
    ...tmdbStub.lists.popular,
    results,
    total_results: results.length,
    total_pages: 1,
    page: 1,
  };
};

async function installStubRoutes(
  page: Page,
  requestPaths: string[] = [],
  requestUrls: string[] = [],
  options?: { popularList?: typeof tmdbStub.lists.popular },
) {
  const popularList = options?.popularList ?? tmdbStub.lists.popular;
  await page.route("**://*/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;

    requestPaths.push(pathname);
    requestUrls.push(requestUrl.toString());

    if (pathname.endsWith("/api/movies/popular") || pathname.endsWith("/api/movie/popular")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(popularList) });
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

  await page.route("**://www.youtube.com/embed/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `
        <html>
          <body style=\"margin:0;background:#10111d;color:#f2f1fa;display:flex;align-items:center;justify-content:center;font-family:sans-serif;\">
            <div data-testid=\"stub-trailer-player\">Trailer Stub</div>
          </body>
        </html>`,
    });
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
  let apiRequestPaths: string[];
  let apiRequestUrls: string[];

  test.beforeEach(async ({ page }) => {
    apiRequestPaths = [];
    apiRequestUrls = [];
    await installStubRoutes(page, apiRequestPaths, apiRequestUrls);
  });

  test("renders discover page with movie cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("DISCOVER", { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid^="movie-poster-"]')).toHaveCount(3);
    await expect(page.getByTestId("movie-poster-2001")).toBeVisible();
  });

  test("home movie list is scrollable on web", async ({ page }) => {
    const scrollablePopularList = buildScrollablePopularList();
    await page.unroute("**://*/api/**");
    await installStubRoutes(page, apiRequestPaths, apiRequestUrls, {
      popularList: scrollablePopularList,
    });

    await page.goto("/");
    const movieList = page.getByTestId("home-movie-list");
    await expect(movieList).toBeVisible();
    await expect(page.getByTestId("movie-poster-9200")).toBeVisible();

    const beforeScrollMetrics = await movieList.evaluate((element) => {
      const containers = [element, ...Array.from(element.querySelectorAll("*"))] as HTMLElement[];
      const measurements = containers.map((container) => ({
        overflow: container.scrollHeight - container.clientHeight,
        scrollTop: container.scrollTop,
      }));

      return {
        maxOverflow: Math.max(...measurements.map((measurement) => measurement.overflow)),
        maxScrollTop: Math.max(...measurements.map((measurement) => measurement.scrollTop)),
      };
    });
    expect(beforeScrollMetrics.maxOverflow).toBeGreaterThan(0);
    expect(beforeScrollMetrics.maxScrollTop).toBe(0);

    await movieList.hover();
    await page.mouse.wheel(0, 1600);

    await expect
      .poll(async () =>
        movieList.evaluate((element) => {
          const containers = [element, ...Array.from(element.querySelectorAll("*"))] as HTMLElement[];
          return Math.max(...containers.map((container) => container.scrollTop));
        }),
      )
      .toBeGreaterThan(0);
  });

  test("uses distinct category endpoints and datasets", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('[data-testid^="movie-poster-"]')).toHaveCount(3);
    await expect(page.getByTestId("movie-poster-2001")).toBeVisible();
    await expect(page.getByTestId("movie-poster-1001")).toHaveCount(0);

    await page.getByTestId("home-tab-now").click();
    await expect(page.getByTestId("movie-poster-1001")).toBeVisible();
    await expect(page.getByTestId("movie-poster-3001")).toHaveCount(0);

    await page.getByTestId("home-tab-upcoming").click();
    await expect(page.getByTestId("movie-poster-3001")).toBeVisible();
    await expect(page.getByTestId("movie-poster-2001")).toHaveCount(0);

    await expect
      .poll(() => apiRequestPaths.filter((path) => path.endsWith("/api/movies/popular")).length)
      .toBeGreaterThan(0);
    await expect
      .poll(() => apiRequestPaths.filter((path) => path.endsWith("/api/movies/now-playing")).length)
      .toBeGreaterThan(0);
    await expect
      .poll(() => apiRequestPaths.filter((path) => path.endsWith("/api/movies/upcoming")).length)
      .toBeGreaterThan(0);
  });

  test("updates URLs and supports deep links", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByText("SEARCH")).toBeVisible();
    await expect(page).toHaveURL(/\/search$/);

    await page.goto("/");
    await page.getByTestId("footer-search").click();
    await expect(page).toHaveURL(/\/search$/);

    await page.goto("/movie/1001");
    await expect(page.getByTestId("play-trailer-button")).toBeVisible();
    await expect(page).toHaveURL(/\/movie\/1001$/);

    await page.goto("/");
    await page.getByTestId("movie-poster-2001").click();
    await expect(page).toHaveURL(/\/movie\/2001$/);
  });

  test("opens trailer overlay from movie detail with loading state", async ({ page }) => {
    await page.goto("/");

    await page.locator('[data-testid^="movie-poster-"]').first().click();

    await expect(page.getByTestId("play-trailer-button")).toBeVisible();
    await page.getByTestId("play-trailer-button").click();

    await expect(page.getByTestId("trailer-overlay")).toBeVisible();
    await expect(page.getByTestId("trailer-overlay-close")).toBeFocused();
    await expect(page.getByTestId("trailer-overlay-loading")).toBeVisible();
    await expect(page.locator('iframe[title="Trailer"]')).toBeVisible();
    await expect(page.getByTestId("trailer-overlay-loading")).toHaveCount(0);

    await page.getByTestId("trailer-overlay-close").click();
    await expect(page.getByTestId("trailer-overlay")).toHaveCount(0);
    await expect(page.getByTestId("play-trailer-button")).toBeVisible();
  });

  test("prevents discover pagination runaway when no next page exists", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('[data-testid^="movie-poster-"]')).toHaveCount(3);
    await expect
      .poll(() => apiRequestPaths.filter((path) => path.endsWith("/api/movies/popular")).length)
      .toBe(1);

    for (let index = 0; index < 5; index += 1) {
      await page.mouse.wheel(0, 4000);
    }

    await page.waitForTimeout(800);
    await expect
      .poll(() => apiRequestPaths.filter((path) => path.endsWith("/api/movies/popular")).length)
      .toBe(1);
  });

  test("does not fetch discover page 2 before user scroll", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-testid^="movie-poster-"]')).toHaveCount(3);

    const countPopularPageTwoRequests = () =>
      apiRequestUrls.filter((requestUrl) => {
        const url = new URL(requestUrl);
        const requestPage = url.searchParams.get("page") ?? "1";
        return url.pathname.endsWith("/api/movies/popular") && requestPage === "2";
      }).length;

    await expect.poll(countPopularPageTwoRequests).toBe(0);
    await page.waitForTimeout(800);
    await expect.poll(countPopularPageTwoRequests).toBe(0);
  });

  test("recovers trailer overlay when iframe load stalls", async ({ page }) => {
    await page.unroute("**://www.youtube.com/embed/**");
    await page.route("**://www.youtube.com/embed/**", async (route) => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 7000);
      });
      await route.abort("timedout");
    });

    await page.goto("/");
    await page.locator('[data-testid^="movie-poster-"]').first().click();
    await expect(page.getByTestId("play-trailer-button")).toBeVisible();

    await page.getByTestId("play-trailer-button").click();
    await expect(page.getByTestId("trailer-overlay")).toBeVisible();
    await expect(page.getByTestId("trailer-overlay-loading")).toBeVisible();

    await expect(page.getByTestId("trailer-overlay-loading")).toHaveCount(0, { timeout: 7000 });
    await expect(page.getByTestId("trailer-overlay-error")).toBeVisible();
    await page.getByTestId("trailer-overlay-error-close").click();
    await expect(page.getByTestId("trailer-overlay")).toHaveCount(0);

    await page.getByTestId("movie-detail-back-button").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("home-tab-upcoming")).toBeVisible();
    await page.getByTestId("home-tab-upcoming").click();
    await expect(page.getByTestId("movie-poster-3001")).toBeVisible();
  });
});
