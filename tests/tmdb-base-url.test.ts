import {
  LOCALHOST_PROXY_URL,
  resolveMoviesApiBaseUrl,
} from "../src/api/tmdb/baseUrl";

describe("resolveMoviesApiBaseUrl", () => {
  it("falls back to the proxy when TMDB is configured directly", () => {
    const resolution = resolveMoviesApiBaseUrl({
      envBaseUrl: "https://api.themoviedb.org/3",
      expoHostUri: "exp://192.168.1.25:8081",
      isWeb: false,
    });

    expect(resolution.baseUrl).toBe("http://192.168.1.25:3001/api");
    expect(resolution.warning).toContain("local Movies API proxy");
  });

  it("rewrites native localhost config to the Expo host LAN URL", () => {
    const resolution = resolveMoviesApiBaseUrl({
      envBaseUrl: "http://localhost:3001/api",
      expoHostUri: "exp://10.0.0.55:8081",
      isWeb: false,
    });

    expect(resolution.baseUrl).toBe("http://10.0.0.55:3001/api");
    expect(resolution.warning).toContain("physical devices can reach");
  });

  it("keeps the default web proxy behavior intact", () => {
    const resolution = resolveMoviesApiBaseUrl({
      envBaseUrl: undefined,
      expoHostUri: "exp://192.168.1.25:8081",
      isWeb: true,
    });

    expect(resolution.baseUrl).toBe(LOCALHOST_PROXY_URL);
    expect(resolution.warning).toBeUndefined();
  });

  it("normalizes valid proxy URLs without changing their host", () => {
    const resolution = resolveMoviesApiBaseUrl({
      envBaseUrl: "http://192.168.1.99:3001",
      expoHostUri: null,
      isWeb: false,
    });

    expect(resolution.baseUrl).toBe("http://192.168.1.99:3001/api");
  });
});
