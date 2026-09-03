jest.mock("../src/api/tmdb/index", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
  getDiscoverMovies: jest.fn(),
}));

import { getNextMoviesPageParam } from "../src/api/tmdb/queries";

describe("getNextMoviesPageParam", () => {
  it("returns the next page number when more pages remain", () => {
    expect(getNextMoviesPageParam({ page: 1, total_pages: 5 })).toBe(2);
  });

  it("returns undefined at the last page boundary", () => {
    expect(getNextMoviesPageParam({ page: 10, total_pages: 10 })).toBeUndefined();
  });

  it("returns undefined when total_pages is unknown", () => {
    expect(getNextMoviesPageParam({ page: 1, total_pages: 0 })).toBeUndefined();
  });

  it("returns the next page in the middle of a result set", () => {
    expect(getNextMoviesPageParam({ page: 5, total_pages: 20 })).toBe(6);
  });
});
