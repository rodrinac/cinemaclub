import { ChildProcess, spawn } from "node:child_process";
import path from "node:path";

describe("TMDB Proxy API Server (server/movies-api.mjs)", () => {
  let serverProcess: ChildProcess;
  const PORT = 3099;
  const BASE_URL = `http://127.0.0.1:${PORT}`;

  beforeAll((done) => {
    const serverPath = path.resolve(__dirname, "../server/movies-api.mjs");
    serverProcess = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        PORT: String(PORT),
        TMDB_API_TOKEN: "dummy_token_for_tests",
      },
      stdio: "pipe",
    });

    let stdout = "";
    serverProcess.stdout?.on("data", (data) => {
      stdout += data.toString();
      if (stdout.includes(`Movies API listening on http://localhost:${PORT}`)) {
        done();
      }
    });

    serverProcess.stderr?.on("data", (data) => {
      console.error("Server stderr:", data.toString());
    });
  });

  afterAll((done) => {
    if (serverProcess) {
      serverProcess.on("close", () => done());
      serverProcess.kill();
    } else {
      done();
    }
  });

  it("should respond 200 OK on GET /health", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("should reject non-GET requests with 405", async () => {
    const res = await fetch(`${BASE_URL}/health`, { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    const body = await res.json();
    expect(body).toEqual({ error: "Only GET requests are supported." });
  });

  it("should reject unsafe path traversal with 400", async () => {
    const res = await fetch(`${BASE_URL}/api/..%2f..%2fetc/passwd`);
    expect(res.status).toBe(400);
  });

  it("should reject invalid movie ID with 404", async () => {
    const res = await fetch(`${BASE_URL}/api/movies/invalid-id`);
    expect(res.status).toBe(404);
  });

  it("should reject unknown query parameters with 400", async () => {
    const res = await fetch(`${BASE_URL}/api/movies/now-playing?unknown_param=123`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Unknown parameter");
  });

  it("should return 400 for search query missing required query param", async () => {
    const res = await fetch(`${BASE_URL}/api/search/movies`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing required search query parameter");
  });

  it("should keep health checks available when local rate limiting is disabled", async () => {
    const responses = await Promise.all(
      Array.from({ length: 15 }, () => fetch(`${BASE_URL}/health`)),
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);
  });
});
