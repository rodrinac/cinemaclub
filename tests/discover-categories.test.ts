import { isRegionalDiscoverCategory, toTmdbRegion } from "../src/api/tmdb/discover";
import {
  DISCOVER_CATEGORIES,
  DISCOVER_CATEGORY_BY_KEY,
} from "../src/pages/Home/discoverCategories";

describe("Discover categories", () => {
  it("should keep tab labels mapped to distinct TMDB endpoints", () => {
    const endpoints = DISCOVER_CATEGORIES.map((category) => category.endpoint);

    expect(endpoints).toEqual([
      "movies/now-playing",
      "movies/top-rated",
      "movies/upcoming",
    ]);
    expect(new Set(endpoints).size).toBe(3);
  });

  it("should expose stable category keys for Home menu state", () => {
    expect(DISCOVER_CATEGORY_BY_KEY.NOW.label).toBe("Now");
    expect(DISCOVER_CATEGORY_BY_KEY.TOP_RATED.label).toBe("Top Rated");
    expect(DISCOVER_CATEGORY_BY_KEY.UPCOMING.label).toBe("Upcoming");
  });

  it("should send a region only for release-based lists and only when it is a valid country code", () => {
    expect(isRegionalDiscoverCategory("NOW")).toBe(true);
    expect(isRegionalDiscoverCategory("UPCOMING")).toBe(true);
    expect(isRegionalDiscoverCategory("TOP_RATED")).toBe(false);
    expect(toTmdbRegion("BR")).toBe("BR");
    expect(toTmdbRegion("419")).toBeUndefined();
    expect(toTmdbRegion(null)).toBeUndefined();
  });
});
