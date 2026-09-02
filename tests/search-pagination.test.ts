import {
  shouldFetchSearchPage,
  shouldLoadNextSearchPage,
} from "../src/pages/SearchMovie/pagination";

describe("SearchMovie pagination guards", () => {
  describe("shouldFetchSearchPage", () => {
    it("allows the first page when query is present", () => {
      expect(
        shouldFetchSearchPage({
          requestedPage: 1,
          searchQuery: "batman",
          totalPages: 0,
        }),
      ).toBe(true);
    });

    it("blocks page 2+ fetches when server total pages are exhausted", () => {
      expect(
        shouldFetchSearchPage({
          requestedPage: 3,
          searchQuery: "batman",
          totalPages: 2,
        }),
      ).toBe(false);
    });

    it("blocks requests for blank queries", () => {
      expect(
        shouldFetchSearchPage({
          requestedPage: 1,
          searchQuery: "   ",
          totalPages: 10,
        }),
      ).toBe(false);
    });
  });

  describe("shouldLoadNextSearchPage", () => {
    it("blocks duplicate pagination triggers while next page is in flight", () => {
      expect(
        shouldLoadNextSearchPage({
          hasQuery: true,
          page: 1,
          totalPages: 4,
          isFetchingNextPage: true,
        }),
      ).toBe(false);
    });

    it("blocks pagination when already at the last page", () => {
      expect(
        shouldLoadNextSearchPage({
          hasQuery: true,
          page: 4,
          totalPages: 4,
          isFetchingNextPage: false,
        }),
      ).toBe(false);
    });

    it("allows pagination when query exists and pages remain", () => {
      expect(
        shouldLoadNextSearchPage({
          hasQuery: true,
          page: 1,
          totalPages: 2,
          isFetchingNextPage: false,
        }),
      ).toBe(true);
    });
  });
});
