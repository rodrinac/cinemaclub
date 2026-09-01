import {
  DISCOVER_CATEGORIES,
  DISCOVER_CATEGORY_BY_KEY,
} from "../src/pages/Home/discoverCategories";

describe("Discover categories", () => {
  it("should keep tab labels mapped to distinct TMDB endpoints", () => {
    const endpoints = DISCOVER_CATEGORIES.map((category) => category.endpoint);

    expect(endpoints).toEqual([
      "movies/now-playing",
      "movies/popular",
      "movies/upcoming",
    ]);
    expect(new Set(endpoints).size).toBe(3);
  });

  it("should expose stable category keys for Home menu state", () => {
    expect(DISCOVER_CATEGORY_BY_KEY.NOW.label).toBe("Now");
    expect(DISCOVER_CATEGORY_BY_KEY.POPULAR.label).toBe("Popular");
    expect(DISCOVER_CATEGORY_BY_KEY.UPCOMING.label).toBe("Upcoming");
  });
});
