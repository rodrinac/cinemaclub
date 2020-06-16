
export interface TmdbMovieList {
  page: number;
  results: TmdbMovie[],
  total_pages: number,
  total_results: number
}

export interface TmdbMovie {
  id: number,
  adult: boolean,
  backdrop_path: string,
  homepage: string;
  genre_ids: number[],
  genres: TmdbGenre[]
  original_language: string,
  original_title: string,
  overview: string,
  popularity: number,
  poster_path: string,
  release_date: string,
  title: string,
  video: boolean,
  vote_average: number,
  vote_count: number,
}

export interface TmdbGenreList {
  genres: TmdbGenre[],
}

export interface TmdbGenre {
  id: number;
  name: string
}