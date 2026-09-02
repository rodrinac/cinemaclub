import {
  addBookmark,
  getGenreFilterMode,
  getGenreFilters,
  hasBookmark,
  hasGenreFilter,
  initDB,
  removeBookmark,
  setGenreFilterMode,
  toggleGenreFilter,
} from "../src/api/database";
import { resetMockDatabase } from "./mocks/expo-sqlite";

describe("Database API (expo-sqlite abstraction)", () => {
  beforeEach(async () => {
    resetMockDatabase();
    await initDB();
  });

  describe("Bookmarks", () => {
    it("should add, check, and remove a movie bookmark", async () => {
      const movie = { id: 550, title: "Fight Club" } as any;

      expect(await hasBookmark(movie)).toBe(false);

      await addBookmark(movie);
      expect(await hasBookmark(movie)).toBe(true);

      // Adding duplicate bookmark should be idempotent
      await addBookmark(movie);
      expect(await hasBookmark(movie)).toBe(true);

      await removeBookmark(movie);
      expect(await hasBookmark(movie)).toBe(false);
    });
  });

  describe("Genre Filters", () => {
    it("should toggle genre filter and get active filters", async () => {
      const genre = { id: 28, name: "Action" };

      expect(await hasGenreFilter(genre)).toBe(false);
      expect(await getGenreFilters()).toEqual([]);

      await toggleGenreFilter(genre);
      expect(await hasGenreFilter(genre)).toBe(true);
      expect(await getGenreFilters()).toEqual([28]);

      // Toggling again removes it
      await toggleGenreFilter(genre);
      expect(await hasGenreFilter(genre)).toBe(false);
      expect(await getGenreFilters()).toEqual([]);
    });

    it("should get and set genre filter mode", async () => {
      expect(await getGenreFilterMode()).toBe("UNDEFINED");

      await setGenreFilterMode("EXCLUDING");
      expect(await getGenreFilterMode()).toBe("EXCLUDING");

      await setGenreFilterMode("INCLUDING");
      expect(await getGenreFilterMode()).toBe("INCLUDING");
    });

    it("should persist genre filter mode without selected genres", async () => {
      expect(await getGenreFilters()).toEqual([]);
      expect(await getGenreFilterMode()).toBe("UNDEFINED");

      await setGenreFilterMode("EXCLUDING");
      expect(await getGenreFilterMode()).toBe("EXCLUDING");
      expect(await getGenreFilters()).toEqual([]);

      await initDB();
      expect(await getGenreFilterMode()).toBe("EXCLUDING");
      expect(await getGenreFilters()).toEqual([]);
    });
  });
});
