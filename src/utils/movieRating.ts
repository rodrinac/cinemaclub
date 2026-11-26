export type MovieVoteStats = {
  vote_average?: number | null;
  vote_count?: number | null;
};

const COMPACT_COUNT_OPTIONS: Intl.NumberFormatOptions = {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

// Some JS engines accept the options but ignore `notation`, or throw. Both
// should still produce "1.2K" / "34K" on web and native.
const compactCountFormatter = (() => {
  try {
    const formatter = new Intl.NumberFormat("en-US", COMPACT_COUNT_OPTIONS);

    return /[A-Za-z]/.test(formatter.format(1200)) ? formatter : null;
  } catch {
    return null;
  }
})();

const formatManualCompact = (count: number): string => {
  if (count < 1000) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(count);
  }

  const exponent = Math.min(3, Math.floor(Math.log10(count) / 3));
  const suffix = ["", "K", "M", "B"][exponent];
  const rounded = Math.round((count / 1000 ** exponent) * 10) / 10;

  // 999,950 rounds to 1000K; step up a tier so it reads as 1M.
  if (rounded >= 1000 && exponent < 3) {
    return formatManualCompact(1000 ** (exponent + 1));
  }

  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);

  return `${text}${suffix}`;
};

const formatCompactCount = (count: number): string => {
  if (!compactCountFormatter) {
    return formatManualCompact(count);
  }

  return compactCountFormatter
    .format(count)
    .replace(/\s+/g, "")
    .replace(/[kmb]$/i, (suffix) => suffix.toUpperCase());
};

/**
 * TMDB reports vote_average 0 until someone votes. A present count decides;
 * a missing count falls back to a positive average so older payloads still
 * show a score.
 */
export const isMovieRated = (movie: MovieVoteStats): boolean => {
  if (isFiniteNumber(movie.vote_count)) {
    return movie.vote_count > 0;
  }

  return isFiniteNumber(movie.vote_average) && movie.vote_average > 0;
};

/** Compact vote total: "1 vote", "842 votes", "1.2K votes", "34K votes". */
export const formatVoteCount = (voteCount: number): string => {
  const count = Math.max(0, Math.round(voteCount));
  const noun = count === 1 ? "vote" : "votes";

  return `${formatCompactCount(count)} ${noun}`;
};
