import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import api, { getDiscoverMovies, type DiscoverCategoryKey } from "./index";
import type { TmdbMovie, TmdbMovieList } from "./models";
import { mergeUniqueMovies } from "@/utils/movieList";

export const movieDetailsQueryKey = (movieId: number) => ["movie-details", movieId] as const;

const fetchMovieDetails = async (movieId: number): Promise<TmdbMovie> => {
  const response = await api.get<TmdbMovie>(`movies/${movieId}`, {
    params: { append_to_response: "videos" },
  });

  return response.data;
};

export const useMovieDetailsQuery = (movieId: number) => {
  return useQuery({
    queryKey: movieDetailsQueryKey(movieId),
    queryFn: () => fetchMovieDetails(movieId),
    enabled: Number.isInteger(movieId) && movieId > 0,
  });
};

export const getNextMoviesPageParam = (lastPage: Pick<TmdbMovieList, "page" | "total_pages">) =>
  lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined;

export const discoverMoviesQueryKey = (category: DiscoverCategoryKey) =>
  ["discover-movies", category] as const;

export const useDiscoverMoviesInfiniteQuery = (category: DiscoverCategoryKey) => {
  return useInfiniteQuery({
    queryKey: discoverMoviesQueryKey(category),
    queryFn: async ({ pageParam }) => {
      const response = await getDiscoverMovies(category, pageParam);
      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: getNextMoviesPageParam,
    select: (data) => {
      const lastPage = data.pages[data.pages.length - 1];
      const mergedResults = data.pages.reduce<TmdbMovie[]>(
        (accumulated, page) => mergeUniqueMovies(accumulated, page.results),
        [],
      );

      return {
        ...lastPage,
        results: mergedResults,
      } satisfies TmdbMovieList;
    },
  });
};

export const searchMoviesQueryKey = (searchQuery: string) =>
  ["search-movies", searchQuery.trim()] as const;

const fetchSearchMoviesPage = async (
  searchQuery: string,
  page: number,
): Promise<TmdbMovieList> => {
  const response = await api.get<TmdbMovieList>("search/movies", {
    params: {
      query: searchQuery,
      page,
      append_to_response: "credits",
    },
  });

  return response.data;
};

export const useSearchMoviesInfiniteQuery = (searchQuery: string) => {
  const trimmedQuery = searchQuery.trim();

  return useInfiniteQuery({
    queryKey: searchMoviesQueryKey(trimmedQuery),
    queryFn: async ({ pageParam }) => fetchSearchMoviesPage(trimmedQuery, pageParam),
    initialPageParam: 1,
    enabled: trimmedQuery.length > 0,
    getNextPageParam: getNextMoviesPageParam,
    select: (data) => {
      const lastPage = data.pages[data.pages.length - 1];
      const mergedResults = data.pages.reduce<TmdbMovie[]>(
        (accumulated, page) => mergeUniqueMovies(accumulated, page.results),
        [],
      );

      return {
        ...lastPage,
        results: mergedResults,
      } satisfies TmdbMovieList;
    },
  });
};


