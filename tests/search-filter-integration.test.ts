import * as database from "../src/api/database";
import { resetMockMMKV } from "./mocks/react-native-mmkv";

describe("Search genre filter persistence integration", () => {
  beforeEach(async () => {
    resetMockMMKV();
    await database.initDB();
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
