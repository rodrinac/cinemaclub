import { TmdbMovie } from "../src/api/tmdb";
import { mergeUniqueMovies } from "../src/utils/movieList";

const createMovie = (id: number): TmdbMovie => ({
  id,
  runtime: 120,
  adult: false,
  backdrop_path: "",
  homepage: "",
  genre_ids: [],
  genres: [],
  original_language: "en",
  original_title: `Movie ${id}`,
  overview: "",
  popularity: 0,
  poster_path: "",
  release_date: "2020-01-01",
  title: `Movie ${id}`,
  video: false,
  vote_average: 0,
  vote_count: 0,
});

describe("mergeUniqueMovies", () => {
  it("dedupes duplicate ids across pages", () => {
    const existing = [createMovie(1), createMovie(2)];
    const incoming = [createMovie(2), createMovie(3)];

    const merged = mergeUniqueMovies(existing, incoming);

    expect(merged.map((movie) => movie.id)).toEqual([1, 2, 3]);
  });

  it("dedupes duplicates within same incoming page", () => {
    const merged = mergeUniqueMovies([], [createMovie(7), createMovie(7), createMovie(8)]);

    expect(merged.map((movie) => movie.id)).toEqual([7, 8]);
  });

  it("keeps stable order where first occurrence wins", () => {
    const existing = [createMovie(10), createMovie(20)];
    const incoming = [createMovie(20), createMovie(30), createMovie(10), createMovie(40)];

    const merged = mergeUniqueMovies(existing, incoming);

    expect(merged.map((movie) => movie.id)).toEqual([10, 20, 30, 40]);
  });

  it("is idempotent when the same page is merged repeatedly", () => {
    const page = [createMovie(100), createMovie(101), createMovie(102)];

    const once = mergeUniqueMovies([], page);
    const twice = mergeUniqueMovies(once, page);

    expect(twice).toHaveLength(once.length);
    expect(twice.map((movie) => movie.id)).toEqual([100, 101, 102]);
  });

  it("produces a unique FlatList key domain from movie ids", () => {
    const merged = mergeUniqueMovies([createMovie(1)], [createMovie(1), createMovie(2)]);
    const keys = merged.map((movie) => movie.id.toString());

    expect(new Set(keys).size).toBe(merged.length);
  });
});
