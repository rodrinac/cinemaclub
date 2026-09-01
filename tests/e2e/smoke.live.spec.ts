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
  test("renders home web page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("DISCOVER")).toBeVisible();
  });
});
