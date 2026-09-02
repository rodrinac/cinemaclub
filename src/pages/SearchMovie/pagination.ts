type SearchFetchGuardInput = {
  requestedPage: number;
  searchQuery: string;
  totalPages: number;
};

type SearchNextPageGuardInput = {
  hasQuery: boolean;
  page: number;
  totalPages: number;
  isFetchingNextPage: boolean;
};

export const shouldFetchSearchPage = ({
  requestedPage,
  searchQuery,
  totalPages,
}: SearchFetchGuardInput): boolean => {
  if (requestedPage < 1 || searchQuery.trim().length === 0) {
    return false;
  }

  if (requestedPage === 1) {
    return true;
  }

  return totalPages > 0 && requestedPage <= totalPages;
};

export const shouldLoadNextSearchPage = ({
  hasQuery,
  page,
  totalPages,
  isFetchingNextPage,
}: SearchNextPageGuardInput): boolean => {
  if (!hasQuery || isFetchingNextPage || page < 1) {
    return false;
  }

  return totalPages > 0 && page < totalPages;
};
