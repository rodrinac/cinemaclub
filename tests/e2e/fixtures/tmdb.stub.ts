import type { TmdbGenreList, TmdbMovie, TmdbMovieList } from "../../../src/api/tmdb/models";

const genres: TmdbGenreList = {
  genres: [
    { id: 28, name: "Action" },
    { id: 878, name: "Sci-Fi" },
    { id: 12, name: "Adventure" },
  ],
};

const makeMovie = (movie: Partial<TmdbMovie> & Pick<TmdbMovie, "id" | "title">): TmdbMovie => ({
  runtime: 110,
  adult: false,
  backdrop_path: `/backdrop-${movie.id}.jpg`,
  homepage: "",
  genre_ids: [28],
  genres: [genres.genres[0]],
  original_language: "en",
  original_title: movie.title,
  overview: `${movie.title} synopsis.`,
  popularity: 70,
  poster_path: `/poster-${movie.id}.jpg`,
  release_date: "2026-03-10",
  video: false,
  vote_average: 7.5,
  vote_count: 500,
  ...movie,
});

const nowPlayingMovies: TmdbMovie[] = [
  makeMovie({ id: 1001, title: "Metro Pulse", genre_ids: [28, 12], genres: [genres.genres[0], genres.genres[2]] }),
  makeMovie({ id: 1002, title: "Orbit Signal", genre_ids: [878], genres: [genres.genres[1]] }),
];

const popularMovies: TmdbMovie[] = [
  makeMovie({
    id: 2001,
    title: "Spider-Verse Echo",
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
  }),
  makeMovie({ id: 2002, title: "Neon Orbit", genre_ids: [878], genres: [genres.genres[1]] }),
  makeMovie({ id: 2003, title: "Prism City", genre_ids: [12], genres: [genres.genres[2]] }),
];

const upcomingMovies: TmdbMovie[] = [
  makeMovie({ id: 3001, title: "Parallel Drift", genre_ids: [12], genres: [genres.genres[2]] }),
  makeMovie({ id: 3002, title: "Vault Horizon", genre_ids: [28, 878], genres: [genres.genres[0], genres.genres[1]] }),
];

const makeList = (results: TmdbMovie[]): TmdbMovieList => ({
  page: 1,
  results,
  total_pages: 1,
  total_results: results.length,
});

const lists = {
  popular: makeList(popularMovies),
  upcoming: makeList(upcomingMovies),
  nowPlaying: makeList(nowPlayingMovies),
};

const detailById = Object.fromEntries(
  [...popularMovies, ...upcomingMovies, ...nowPlayingMovies].map((movie) => [movie.id, movie]),
) as Record<number, TmdbMovie>;

export const tmdbStub = {
  genres,
  lists,
  search: makeList(popularMovies.filter((movie) => /spider/i.test(movie.title))),
  detailById,
};
