import { getQueued } from "../src/api/tmdb/getQueued";
import {
  clearMovieDetailsCache,
  getMovieDetails,
} from "../src/api/tmdb/movieDetailsCache";
import type { TmdbMovie } from "../src/api/tmdb/models";

jest.mock("../src/api/tmdb/getQueued", () => ({
  getQueued: jest.fn(),
}));

const createMovieDetails = (id: number): TmdbMovie => ({
  adult: false,
  backdrop_path: `/backdrop/${id}.jpg`,
  credits: {
    cast: [{ credit_id: `cast-${id}`, gender: 0, id: id * 10, name: `Cast ${id}`, profile_path: "" }],
    crew: [{ credit_id: `crew-${id}`, gender: 0, id: id * 20, name: `Director ${id}`, profile_path: "", department: "Directing" }],
  },
  genre_ids: [1],
  genres: [{ id: 1, name: "Action" }],
  homepage: "https://example.com",
  id,
  original_language: "en",
  original_title: `Movie ${id}`,
  overview: "Overview",
  popularity: 1,
  poster_path: `/poster/${id}.jpg`,
  release_date: "2024-01-01",
  runtime: 128,
  title: `Movie ${id}`,
  video: false,
  vote_average: 8.1,
  vote_count: 100,
});

describe("movie details cache", () => {
  beforeEach(() => {
    clearMovieDetailsCache();
    jest.clearAllMocks();
  });

  it("deduplicates concurrent requests for the same movie id", async () => {
    const movie = createMovieDetails(42);
    const mockedGetQueued = jest.mocked(getQueued);

    mockedGetQueued.mockImplementation(() =>
      new Promise((resolve) => {
        setTimeout(() => resolve(movie), 10);
      }),
    );

    const [firstResult, secondResult] = await Promise.all([
      getMovieDetails(42),
      getMovieDetails(42),
    ]);

    expect(mockedGetQueued).toHaveBeenCalledTimes(1);
    expect(firstResult).toEqual(movie);
    expect(secondResult).toEqual(movie);
  });
});
