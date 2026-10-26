import type { TmdbVideo } from "../src/api/tmdb/models";
import { pickMovieTrailer } from "../src/utils/movieTrailer";

const video = (overrides: Partial<TmdbVideo>): TmdbVideo => ({
  id: overrides.key ?? "id",
  iso_3166_1: "US",
  iso_639_1: "en",
  key: "key",
  name: "Video",
  site: "YouTube",
  size: 1080,
  type: "Teaser",
  published_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("pickMovieTrailer", () => {
  it("prefers a full trailer over newer teasers, which are often vertical Shorts", () => {
    const videos = [
      video({ key: "short-teaser", name: "Time Go", published_at: "2026-05-08T00:00:00.000Z" }),
      video({ key: "official", type: "Trailer", name: "Official Trailer", published_at: "2025-06-30T00:00:00.000Z" }),
      video({ key: "final", type: "Trailer", name: "Final Trailer", published_at: "2026-02-08T00:00:00.000Z" }),
      video({ key: "sneak", type: "Trailer", name: "Final Sneak Peak", published_at: "2026-03-05T00:00:00.000Z" }),
      video({ key: "clip", type: "Clip", name: "Official Clip", published_at: "2026-09-26T00:00:00.000Z" }),
    ];

    expect(pickMovieTrailer(videos)?.key).toBe("final");
  });

  it("falls back to the newest YouTube teaser and ignores other sites", () => {
    const videos = [
      video({ key: "old", published_at: "2025-01-01T00:00:00.000Z" }),
      video({ key: "new", published_at: "2025-06-01T00:00:00.000Z" }),
      video({ key: "vimeo", type: "Trailer", site: "Vimeo", published_at: "2025-07-01T00:00:00.000Z" }),
    ];

    expect(pickMovieTrailer(videos)?.key).toBe("new");
  });

  it("returns undefined when there is nothing playable", () => {
    expect(pickMovieTrailer(undefined)).toBeUndefined();
    expect(pickMovieTrailer([video({ type: "Featurette" })])).toBeUndefined();
  });
});
