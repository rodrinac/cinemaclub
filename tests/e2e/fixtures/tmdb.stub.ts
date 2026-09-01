import type { TmdbGenreList, TmdbMovie, TmdbMovieList } from "../../../src/api/tmdb/models";

const genres: TmdbGenreList = {
  genres: [
    { id: 28, name: "Action" },
    { id: 878, name: "Sci-Fi" },
    { id: 12, name: "Adventure" },
  ],
};

const baseMovies: TmdbMovie[] = [
  {
    runtime: 121,
    id: 1001,
    adult: false,
    backdrop_path: "/backdrop-1.jpg",
    homepage: "",
    genre_ids: [28, 12],
    genres: [genres.genres[0], genres.genres[2]],
    original_language: "en",
    original_title: "Spider-Verse Echo",
    overview: "Miles receives a signal from another universe and leaps into chaos.",
    popularity: 88,
    poster_path: "/poster-1.jpg",
    release_date: "2026-03-10",
    title: "Spider-Verse Echo",
    video: false,
    vote_average: 8.3,
    vote_count: 1000,
    videos: {
      results: [
        {
          id: "vid1",
          iso_3166_1: "US",
          iso_639_1: "en",
          key: "dQw4w9WgXcQ",
          name: "Official Trailer",
          site: "YouTube",
          size: 1080,
          type: "Trailer",
          published_at: "2026-03-01T10:00:00.000Z",
        },
      ],
    },
    credits: {
      cast: [
        {
          credit_id: "cast1",
          gender: 2,
          id: 1,
          name: "Shameik Moore",
          cast_id: 1,
          character: "Miles Morales",
          order: 1,
          profile_path: "/cast1.jpg",
        },
      ],
      crew: [
        {
          credit_id: "crew1",
          gender: 2,
          id: 11,
          name: "Kemp Powers",
          department: "Directing",
          job: "Director",
          profile_path: "/crew1.jpg",
        },
      ],
    },
  },
  {
    runtime: 104,
    id: 1002,
    adult: false,
    backdrop_path: "/backdrop-2.jpg",
    homepage: "",
    genre_ids: [878],
    genres: [genres.genres[1]],
    original_language: "en",
    original_title: "Neon Orbit",
    overview: "A rogue pilot outruns a collapsing station.",
    popularity: 71,
    poster_path: "/poster-2.jpg",
    release_date: "2026-04-12",
    title: "Neon Orbit",
    video: false,
    vote_average: 7.1,
    vote_count: 640,
  },
  {
    runtime: 99,
    id: 1003,
    adult: false,
    backdrop_path: "/backdrop-3.jpg",
    homepage: "",
    genre_ids: [12],
    genres: [genres.genres[2]],
    original_language: "en",
    original_title: "Parallel Drift",
    overview: "A teenager maps hidden dimensions under Brooklyn.",
    popularity: 65,
    poster_path: "/poster-3.jpg",
    release_date: "2026-06-18",
    title: "Parallel Drift",
    video: false,
    vote_average: 7.7,
    vote_count: 502,
  },
];

const makeList = (results: TmdbMovie[]): TmdbMovieList => ({
  page: 1,
  results,
  total_pages: 1,
  total_results: results.length,
});

const lists = {
  popular: makeList(baseMovies),
  upcoming: makeList(baseMovies.slice(1)),
  nowPlaying: makeList(baseMovies.slice(0, 2)),
};

export const tmdbStub = {
  genres,
  lists,
  search: makeList(baseMovies.filter((movie) => /spider/i.test(movie.title))),
  detailById: Object.fromEntries(baseMovies.map((movie) => [movie.id, movie])) as Record<number, TmdbMovie>,
};
