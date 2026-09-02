import axios from "axios";
import { installTmdbRateLimitRetryInterceptor } from "../src/api/tmdb/retry";

describe("shared TMDB axios retry handling", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("retries plain api requests on 429 responses", async () => {
    const api = axios.create();
    installTmdbRateLimitRetryInterceptor(api);

    const adapter = jest
      .fn()
      .mockRejectedValueOnce({
        config: {
          url: "movies/popular",
        },
        response: {
          status: 429,
          headers: {
            "retry-after": "1",
          },
          data: {
            parameters: {
              retry_after: 1,
            },
          },
        },
      })
      .mockResolvedValueOnce({
        config: {
          url: "movies/popular",
        },
        data: { ok: true },
        headers: {},
        status: 200,
        statusText: "OK",
      });

    api.defaults.adapter = adapter;

    const requestPromise = api.get<{ ok: boolean }>("movies/popular");
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(2000);

    await expect(requestPromise).resolves.toMatchObject({ data: { ok: true } });
    expect(adapter).toHaveBeenCalledTimes(2);
  });
});
