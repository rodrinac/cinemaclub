import { TmdbMovie } from "@/api/tmdb";

type WithNumericId = {
  id: number;
};

export const mergeUniqueById = <T extends WithNumericId>(existing: T[], incoming: T[]): T[] => {
  const seenIds = new Set<number>();
  const merged = [...existing, ...incoming];

  return merged.filter((item) => {
    if (seenIds.has(item.id)) {
      return false;
    }

    seenIds.add(item.id);
    return true;
  });
};

export const mergeUniqueMovies = (existing: TmdbMovie[], incoming: TmdbMovie[]): TmdbMovie[] =>
  mergeUniqueById(existing, incoming);
