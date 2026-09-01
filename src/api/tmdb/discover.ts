export const discoverCategoryEndpoints = Object.freeze({
  NOW: "movies/now-playing",
  POPULAR: "movies/popular",
  UPCOMING: "movies/upcoming",
});

export type DiscoverCategoryKey = keyof typeof discoverCategoryEndpoints;

export const getDiscoverCategoryEndpoint = (category: DiscoverCategoryKey) => {
  return discoverCategoryEndpoints[category];
};
