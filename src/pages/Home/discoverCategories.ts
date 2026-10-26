import {
  getDiscoverCategoryEndpoint,
  type DiscoverCategoryKey,
} from "../../api/tmdb/discover";

export type DiscoverCategory = {
  key: DiscoverCategoryKey;
  label: "Now" | "Top Rated" | "Upcoming";
  testId: string;
  endpoint: string;
};

export const DISCOVER_CATEGORIES: DiscoverCategory[] = [
  {
    key: "NOW",
    label: "Now",
    testId: "home-tab-now",
    endpoint: getDiscoverCategoryEndpoint("NOW"),
  },
  {
    key: "TOP_RATED",
    label: "Top Rated",
    testId: "home-tab-top-rated",
    endpoint: getDiscoverCategoryEndpoint("TOP_RATED"),
  },
  {
    key: "UPCOMING",
    label: "Upcoming",
    testId: "home-tab-upcoming",
    endpoint: getDiscoverCategoryEndpoint("UPCOMING"),
  },
];

export const DISCOVER_CATEGORY_BY_KEY = Object.freeze(
  Object.fromEntries(DISCOVER_CATEGORIES.map((category) => [category.key, category])) as Record<
    DiscoverCategoryKey,
    DiscoverCategory
  >,
);
