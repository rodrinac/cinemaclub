export const discoverCategoryEndpoints = Object.freeze({
  NOW: "movies/now-playing",
  TOP_RATED: "movies/top-rated",
  UPCOMING: "movies/upcoming",
});

export type DiscoverCategoryKey = keyof typeof discoverCategoryEndpoints;

// Release-based lists follow the viewer's country; ratings are global.
const REGIONAL_DISCOVER_CATEGORIES: ReadonlySet<DiscoverCategoryKey> = new Set(["NOW", "UPCOMING"]);

export const isRegionalDiscoverCategory = (category: DiscoverCategoryKey) =>
  REGIONAL_DISCOVER_CATEGORIES.has(category);

export const toTmdbRegion = (regionCode: string | null | undefined) =>
  typeof regionCode === "string" && /^[A-Z]{2}$/.test(regionCode) ? regionCode : undefined;

export const getDiscoverCategoryEndpoint = (category: DiscoverCategoryKey) => {
  return discoverCategoryEndpoints[category];
};
