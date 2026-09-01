export const parseMovieIdPathParam = (movieId: string) => {
  const parsedMovieId = Number.parseInt(movieId, 10);

  return Number.isFinite(parsedMovieId) ? parsedMovieId : 0;
};

export const appLinkingConfig = {
  initialRouteName: "Home",
  screens: {
    Home: "",
    SearchMovie: "search",
    SearchFilters: "filters",
    Settings: "settings",
    MovieDetail: {
      path: "movie/:movieId",
      parse: {
        movieId: parseMovieIdPathParam,
      },
      stringify: {
        movieId: (movieId: number) => `${movieId}`,
      },
    },
  },
} as const;
