import * as database from "../src/api/database";
import {
  shouldFetchSearchPage,
  shouldLoadNextSearchPage,
} from "../src/pages/SearchMovie/pagination";
import { resetMockMMKV } from "./mocks/react-native-mmkv";

describe("Search pagination and filter persistence integration", () => {
  beforeEach(async () => {
    resetMockMMKV();
    await database.initDB();
  });

  describe("Search pagination stop behavior", () => {
    it("prevents page fetch beyond server total_pages", () => {
      expect(
        shouldFetchSearchPage({
          requestedPage: 3,
          searchQuery: "inception",
          totalPages: 2,
        }),
      ).toBe(false);
    });

    it("allows first page when total_pages unknown", () => {
      expect(
        shouldFetchSearchPage({
          requestedPage: 1,
          searchQuery: "batman",
          totalPages: 0,
        }),
      ).toBe(true);
    });

    it("blocks pagination at exact last page boundary", () => {
      expect(
        shouldLoadNextSearchPage({
          hasQuery: true,
          page: 10,
          totalPages: 10,
          isFetchingNextPage: false,
        }),
      ).toBe(false);
    });

    it("allows pagination when middle of result set", () => {
      expect(
        shouldLoadNextSearchPage({
          hasQuery: true,
          page: 5,
          totalPages: 20,
          isFetchingNextPage: false,
        }),
      ).toBe(true);
    });
  });

  describe("Search over-fetch prevention", () => {
    it("blocks blank query searches", () => {
      expect(
        shouldFetchSearchPage({
          requestedPage: 1,
          searchQuery: "",
          totalPages: 5,
        }),
      ).toBe(false);
    });

    it("blocks whitespace-only query searches", () => {
      expect(
        shouldFetchSearchPage({
          requestedPage: 1,
          searchQuery: "   ",
          totalPages: 5,
        }),
      ).toBe(false);
    });

    it("blocks duplicate onEndReached during in-flight fetch", () => {
      expect(
        shouldLoadNextSearchPage({
          hasQuery: true,
          page: 2,
          totalPages: 5,
          isFetchingNextPage: true,
        }),
      ).toBe(false);
    });

    it("allows pagination to resume after in-flight fetch completes", () => {
      expect(
        shouldLoadNextSearchPage({
          hasQuery: true,
          page: 2,
          totalPages: 5,
          isFetchingNextPage: false,
        }),
      ).toBe(true);
    });
  });

  describe("Genre filter mode persistence", () => {
    it("persists filter mode when no genres selected", async () => {
      await database.setGenreFilterMode("INCLUDING");

      let mode = await database.getGenreFilterMode();
      expect(mode).toBe("INCLUDING");

      mode = await database.getGenreFilterMode();
      expect(mode).toBe("INCLUDING");
    });

    it("survives clear of genre selections", async () => {
      const action = { id: 28, name: "Action" };
      const comedy = { id: 35, name: "Comedy" };

      await database.toggleGenreFilter(action);
      await database.toggleGenreFilter(comedy);

      await database.setGenreFilterMode("EXCLUDING");

      let selectedGenres = await database.getGenreFilters();
      expect(selectedGenres).toContain(28);
      expect(selectedGenres).toContain(35);

      await database.toggleGenreFilter(action);
      await database.toggleGenreFilter(comedy);

      selectedGenres = await database.getGenreFilters();
      expect(selectedGenres).toHaveLength(0);

      const mode = await database.getGenreFilterMode();
      expect(mode).toBe("EXCLUDING");
    });
  });
});
