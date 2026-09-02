jest.mock("../src/api/tmdb/index", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import api from "../src/api/tmdb/index";
import { getQueued } from "../src/api/tmdb/getQueued";

describe("getQueued retry handling", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("prefers the Retry-After header over the body fallback", async () => {
    const mockedGet = jest.mocked(api.get);
    mockedGet
      .mockRejectedValueOnce({
        response: {
          status: 429,
          headers: {
            "retry-after": "2",
          },
          data: {
            parameters: {
              retry_after: 1,
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: { ok: true },
      } as any);

    const requestPromise = getQueued<{ ok: boolean }>("movies/42");
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(2000);

    await expect(requestPromise).resolves.toEqual({ ok: true });
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });
});
