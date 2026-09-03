import * as SQLite from "expo-sqlite";
import { TmdbGenre, TmdbMovie } from "../tmdb";

type GenreFilterMode = "INCLUDING" | "EXCLUDING" | "UNDEFINED";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const getDB = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("CINEMA_CLUB");
  }

  return dbPromise;
};

const initDB = async () => {
  dbPromise = null;
  const db = await getDB();

  await db.withTransactionAsync(async () => {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS movie_bookmark (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        movie INT UNIQUE NOT NULL
      );
    `);
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS genre_filter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        genre TEXT UNIQUE NOT NULL
      );
    `);
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS genre_filter_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        mode TEXT NOT NULL
      );
    `);
  });

  try {
    const tableInfo = await db.getAllAsync<{ name: string }>("PRAGMA table_info(genre_filter)");
    const hasMode = tableInfo.some((col) => col.name === "mode");
    const hasFilter = tableInfo.some((col) => col.name === "filter");
    const hasGenre = tableInfo.some((col) => col.name === "genre");

    if (hasFilter && !hasMode) {
      await db.runAsync(
        "ALTER TABLE genre_filter ADD COLUMN mode TEXT NOT NULL DEFAULT 'EXCLUDING'",
      );
    }

    const settings = await db.getFirstAsync<{ mode: GenreFilterMode }>(
      "SELECT mode FROM genre_filter_settings WHERE id = 1",
    );

    if (!settings && (hasMode || hasFilter)) {
      const legacyMode = await db.getFirstAsync<{ mode: GenreFilterMode }>(
        "SELECT mode FROM genre_filter WHERE mode IN ('INCLUDING', 'EXCLUDING') LIMIT 1",
      );

      if (legacyMode?.mode != null) {
        await db.runAsync("INSERT INTO genre_filter_settings(id, mode) VALUES(1, ?)", [legacyMode.mode]);
      }
    }

    if (hasMode || hasFilter || !hasGenre) {
      await db.withTransactionAsync(async () => {
        await db.runAsync(`
          CREATE TABLE IF NOT EXISTS genre_filter_next (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            genre TEXT UNIQUE NOT NULL
          );
        `);
        if (hasGenre) {
          await db.runAsync(
            "INSERT OR IGNORE INTO genre_filter_next(genre) SELECT genre FROM genre_filter WHERE genre IS NOT NULL",
          );
        }
        await db.runAsync("DROP TABLE IF EXISTS genre_filter");
        await db.runAsync("ALTER TABLE genre_filter_next RENAME TO genre_filter");
      });
    }
  } catch {
    // Ignore migration check if table is fresh
  }
};

const hasBookmark = async (movie: Pick<TmdbMovie, "id">): Promise<boolean> => {
  const db = await getDB();
  const result = await db.getFirstAsync(`select * from movie_bookmark where movie =?`, [movie.id]);
  return result != null;
};

const addBookmark = async (movie: TmdbMovie) => {
  const exists = await hasBookmark(movie);

  if (!exists) {
    const db = await getDB();
    await db.runAsync("insert into movie_bookmark (movie) values(?)", [movie.id]);
  }
};

const removeBookmark = async (movie: TmdbMovie) => {
  const db = await getDB();
  await db.runAsync("DELETE FROM movie_bookmark WHERE movie = ?", [movie.id]);
};

const hasGenreFilter = async (genre: TmdbGenre): Promise<boolean> => {
  const db = await getDB();

  const result = await db.getFirstAsync("SELECT * FROM genre_filter WHERE genre = ?", [genre.id]);
  return result != null;
};

const toggleGenreFilter = async (genre: TmdbGenre) => {
  const hasFilter = await hasGenreFilter(genre);

  const db = await getDB();

  if (hasFilter) {
    await db.runAsync("DELETE FROM genre_filter WHERE genre = ?", [genre.id]);
  } else {
    await db.runAsync("INSERT INTO genre_filter(genre) VALUES(?)", [genre.id]);
  }
};

const getGenreFilterMode = async (): Promise<GenreFilterMode> => {
  const db = await getDB();
  const genreFilter = await db.getFirstAsync<{ mode: GenreFilterMode }>(
    "SELECT mode FROM genre_filter_settings WHERE id = 1",
  );
  return genreFilter?.mode ?? "UNDEFINED";
};

const getGenreFilters = async (): Promise<number[]> => {
  const db = await getDB();

  const filters: { genre: string }[] = await db.getAllAsync("SELECT genre FROM genre_filter");

  return filters.map((filter) => Number.parseInt(filter.genre, 10));
};

const setGenreFilterMode = async (mode: GenreFilterMode) => {
  const db = await getDB();

  await db.runAsync(
    `INSERT INTO genre_filter_settings(id, mode) VALUES(1, ?)
     ON CONFLICT(id) DO UPDATE SET mode = excluded.mode`,
    [mode],
  );
};

export {
  addBookmark,
  GenreFilterMode,
  getGenreFilterMode,
  getGenreFilters,
  hasBookmark,
  hasGenreFilter,
  initDB,
  removeBookmark,
  setGenreFilterMode,
  toggleGenreFilter,
};
