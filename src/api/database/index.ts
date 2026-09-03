import { createMMKV } from "react-native-mmkv";
import { TmdbGenre, TmdbMovie } from "../tmdb";

export type GenreFilterMode = "INCLUDING" | "EXCLUDING" | "UNDEFINED";

const BOOKMARKS_KEY = "movie_bookmarks";
const GENRE_FILTERS_KEY = "genre_filters";
const GENRE_FILTER_MODE_KEY = "genre_filter_mode";

let storage: ReturnType<typeof createMMKV> | null = null;

const getStorage = () => {
  if (!storage) {
    storage = createMMKV({ id: "cinema-club" });
  }

  return storage;
};

const readJsonArray = <T>(key: string): T[] => {
  const raw = getStorage().getString(key);

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeJsonArray = <T>(key: string, value: T[]) => {
  getStorage().set(key, JSON.stringify(value));
};

/**
 * Resets the MMKV storage handle. Kept for API parity with the previous
 * expo-sqlite based module (tests call this between cases), but MMKV itself
 * needs no schema/migration work on init.
 */
const initDB = async () => {
  storage = null;
  getStorage();
};

const hasBookmark = async (movie: Pick<TmdbMovie, "id">): Promise<boolean> => {
  const bookmarks = readJsonArray<number>(BOOKMARKS_KEY);
  return bookmarks.includes(movie.id);
};

const addBookmark = async (movie: TmdbMovie) => {
  const bookmarks = readJsonArray<number>(BOOKMARKS_KEY);

  if (!bookmarks.includes(movie.id)) {
    writeJsonArray(BOOKMARKS_KEY, [...bookmarks, movie.id]);
  }
};

const removeBookmark = async (movie: TmdbMovie) => {
  const bookmarks = readJsonArray<number>(BOOKMARKS_KEY);
  writeJsonArray(
    BOOKMARKS_KEY,
    bookmarks.filter((id) => id !== movie.id),
  );
};

const hasGenreFilter = async (genre: TmdbGenre): Promise<boolean> => {
  const filters = readJsonArray<number>(GENRE_FILTERS_KEY);
  return filters.includes(genre.id);
};

const toggleGenreFilter = async (genre: TmdbGenre) => {
  const filters = readJsonArray<number>(GENRE_FILTERS_KEY);

  if (filters.includes(genre.id)) {
    writeJsonArray(
      GENRE_FILTERS_KEY,
      filters.filter((id) => id !== genre.id),
    );
  } else {
    writeJsonArray(GENRE_FILTERS_KEY, [...filters, genre.id]);
  }
};

const getGenreFilterMode = async (): Promise<GenreFilterMode> => {
  const mode = getStorage().getString(GENRE_FILTER_MODE_KEY);
  return (mode as GenreFilterMode) ?? "UNDEFINED";
};

const getGenreFilters = async (): Promise<number[]> => {
  return readJsonArray<number>(GENRE_FILTERS_KEY);
};

const setGenreFilterMode = async (mode: GenreFilterMode) => {
  getStorage().set(GENRE_FILTER_MODE_KEY, mode);
};

export {
  addBookmark,
  getGenreFilterMode,
  getGenreFilters,
  hasBookmark,
  hasGenreFilter,
  initDB,
  removeBookmark,
  setGenreFilterMode,
  toggleGenreFilter,
};
