import { getQueued } from "./getQueued";
import type { TmdbMovie } from "./models";

const detailsByMovieId = new Map<number, TmdbMovie>();
const pendingDetailsByMovieId = new Map<number, Promise<TmdbMovie>>();

export const getMovieDetails = (movieId: number): Promise<TmdbMovie> => {
  const cachedDetails = detailsByMovieId.get(movieId);

  if (cachedDetails) {
    return Promise.resolve(cachedDetails);
  }

  const pendingDetails = pendingDetailsByMovieId.get(movieId);

  if (pendingDetails) {
    return pendingDetails;
  }

  const detailsPromise = getQueued<TmdbMovie>(`movies/${movieId}`, {
    params: { append_to_response: "credits" },
  })
    .then((movieDetails) => {
      detailsByMovieId.set(movieId, movieDetails);
      return movieDetails;
    })
    .finally(() => {
      pendingDetailsByMovieId.delete(movieId);
    });

  pendingDetailsByMovieId.set(movieId, detailsPromise);

  return detailsPromise;
};

export const clearMovieDetailsCache = () => {
  detailsByMovieId.clear();
  pendingDetailsByMovieId.clear();
};
