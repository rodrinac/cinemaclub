import type { TmdbVideo } from "@/api/tmdb/models";

// Studios label vertical social Shorts as "Teaser" on TMDB, and TMDB has no
// orientation field, so full "Trailer" uploads are ranked first to get a
// landscape video whenever one exists.
const rankTrailer = (video: TmdbVideo) =>
  (video.type === "Trailer" ? 4 : 0) + (/trailer/i.test(video.name) ? 2 : 0);

const publishedAtMs = (video: TmdbVideo) => new Date(video.published_at).getTime() || 0;

export const pickMovieTrailer = (videos: TmdbVideo[] | undefined) =>
  (videos ?? [])
    .filter(
      (video) => (video.type === "Teaser" || video.type === "Trailer") && /youtube/i.test(video.site),
    )
    .sort((a, b) => rankTrailer(b) - rankTrailer(a) || publishedAtMs(b) - publishedAtMs(a))[0];
