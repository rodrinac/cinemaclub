export type TmdbMovieList = {
  page: number;
  results: TmdbMovie[];
  total_pages: number;
  total_results: number;
};

export type TmdbMovie = {
  runtime: number;
  id: number;
  adult: boolean;
  backdrop_path: string;
  homepage: string;
  genre_ids: number[];
  genres: TmdbGenre[];
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
  videos?: {
    results: TmdbVideo[];
  };
  credits?: {
    cast: TmdbMovieCredit[];
    crew: TmdbMovieCredit[];
  };
};

export type TmdbGenreList = {
  genres: TmdbGenre[];
};

export type TmdbGenre = {
  id: number;
  name: string;
};

export type TmdbVideo = {
  id: string;
  iso_3166_1: string;
  iso_639_1: string;
  key: string;
  name: string;
  site: string;
  size: number;
  type: string;
  published_at: string;
};

export type TmdbMovieCredit = {
  cast_id?: number;
  character?: string;
  department?: string;
  credit_id: string;
  gender: number;
  id: number;
  name: string;
  order?: number;
  profile_path: string;
  job?: string;
};
