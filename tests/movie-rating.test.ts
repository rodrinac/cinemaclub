import { formatVoteCount, isMovieRated } from "../src/utils/movieRating";

describe("isMovieRated", () => {
  it("treats a movie with no votes as unrated", () => {
    expect(isMovieRated({ vote_average: 0, vote_count: 0 })).toBe(false);
  });

  it("ignores a leftover average when the vote count is zero", () => {
    expect(isMovieRated({ vote_average: 7.5, vote_count: 0 })).toBe(false);
  });

  it("treats a positive vote count as rated", () => {
    expect(isMovieRated({ vote_average: 7.5, vote_count: 1 })).toBe(true);
    expect(isMovieRated({ vote_average: 9, vote_count: 30000 })).toBe(true);
  });

  it("falls back to the average when the vote count is missing", () => {
    expect(isMovieRated({ vote_average: 8.2 })).toBe(true);
    expect(isMovieRated({ vote_average: 8.2, vote_count: null })).toBe(true);
    expect(isMovieRated({ vote_average: 0 })).toBe(false);
    expect(isMovieRated({ vote_average: 0, vote_count: undefined })).toBe(false);
    expect(isMovieRated({})).toBe(false);
  });

  it("treats a non-finite vote count as missing and uses the average", () => {
    expect(isMovieRated({ vote_average: Number.NaN, vote_count: Number.NaN })).toBe(false);
    expect(isMovieRated({ vote_average: 0, vote_count: Number.NaN })).toBe(false);
    expect(isMovieRated({ vote_average: 6, vote_count: Number.POSITIVE_INFINITY })).toBe(true);
  });

  it("treats a negative vote count as unrated", () => {
    expect(isMovieRated({ vote_average: 8, vote_count: -1 })).toBe(false);
  });
});

describe("formatVoteCount", () => {
  it("uses the singular for one vote", () => {
    expect(formatVoteCount(1)).toBe("1 vote");
  });

  it("keeps counts under one thousand exact", () => {
    expect(formatVoteCount(2)).toBe("2 votes");
    expect(formatVoteCount(842)).toBe("842 votes");
    expect(formatVoteCount(999)).toBe("999 votes");
  });

  it("compacts thousands and millions", () => {
    expect(formatVoteCount(1000)).toBe("1K votes");
    expect(formatVoteCount(1200)).toBe("1.2K votes");
    expect(formatVoteCount(34000)).toBe("34K votes");
    expect(formatVoteCount(1_200_000)).toBe("1.2M votes");
  });

  it("rounds to the nearest vote before choosing singular", () => {
    expect(formatVoteCount(1.4)).toBe("1 vote");
    expect(formatVoteCount(1.5)).toBe("2 votes");
  });
});
