import * as SQLite from "expo-sqlite";
import { TmdbMovie, TmdbGenre } from "../tmdb";

type GenreFilterMode = "INCLUDING" | "EXCLUDING" | "UNDEFINED";

const getDB = async (): Promise<SQLite.SQLiteDatabase> =>
  SQLite.openDatabaseAsync("CINEMA_CLUB");

const initDB = async () => {
  const sql = [
    `CREATE TABLE IF NOT EXISTS movie_bookmark (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        movie INT UNIQUE NOT NULL
      );`,
    `CREATE TABLE IF NOT EXISTS genre_filter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        genre TEXT UNIQUE NOT NULL,
        filter INT NOT NULL
      );`,
  ];
  const db = await getDB();

  await db.withTransactionAsync(async () => {
    sql.map(async (query) => await db.runAsync(query));
  });
};

const hasBookmark = async (movie: TmdbMovie): Promise<boolean> => {
  const db = await getDB();
  const result = await db.getFirstAsync(
    `select * from movie_bookmark where movie =?`,
    [movie.id],
  );
  return result != null;
};

const addBookmark = async (movie: TmdbMovie) => {
  const exists = await hasBookmark(movie);

  if (!exists) {
    const db = await getDB();
    await db.runAsync("insert into movie_bookmark (movie) values(?)", [
      movie.id,
    ]);
  }
};

const removeBookmark = async (movie: TmdbMovie) => {
  const db = await getDB();
  await db.runAsync("DELETE FROM movie_bookmark WHERE movie = ?", [movie.id]);
};

const hasGenreFilter = async (genre: TmdbGenre): Promise<boolean> => {
  const db = await getDB();

  const result = await db.getFirstAsync(
    "SELECT * FROM genre_filter WHERE genre = ?",
    [genre.id],
  );
  return result != null;
};

const toggleGenreFilter = async (genre: TmdbGenre, mode: GenreFilterMode) => {
  const hasFilter = await hasGenreFilter(genre);

  const db = await getDB();

  if (hasFilter) {
    await db.runAsync("DELETE genre_filter WHERE id = ?", [genre.id]);
  } else {
    await db.runAsync("INSERT INTO genre_filter(genre, mode) VALUES(?, ?)", [
      genre.id,
      mode,
    ]);
  }
};

const getGenreFilterMode = async (): Promise<GenreFilterMode> => {
  const db = await getDB();
  const genreFilter = await db.getFirstAsync<{ mode: GenreFilterMode }>(
    "SELECT * FROM genre_filter",
  );
  return genreFilter?.mode ?? "UNDEFINED";
};

const getGenreFilters = async (): Promise<number[]> => {
  const db = await getDB();

  const filters: { genre: number }[] = await db.getAllAsync(
    "SELECT * FROM genre_filter",
  );

  return filters.map((filter) => filter.genre);
};

const setGenreFilterMode = async (mode: GenreFilterMode) => {
  const db = await getDB();

  await db.runAsync(`UPDATE genre_filter SET mode = ?`, [mode]);
};

export {
  GenreFilterMode,
  initDB,
  hasBookmark,
  addBookmark,
  removeBookmark,
  hasGenreFilter,
  toggleGenreFilter,
  getGenreFilterMode,
  getGenreFilters,
  setGenreFilterMode,
};
