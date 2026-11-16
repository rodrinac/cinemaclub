export type SettledPartition<T> = {
  values: T[];
  failedCount: number;
};

/**
 * Splits settled results into successes, in input order, and a failure count.
 * A rejection never drops the values that fulfilled.
 */
export const partitionSettled = <T>(
  results: readonly PromiseSettledResult<T>[],
): SettledPartition<T> => {
  const values: T[] = [];
  let failedCount = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      values.push(result.value);
    } else {
      failedCount += 1;
    }
  }

  return { values, failedCount };
};

/** Waits for every task. One rejection does not discard the other results. */
export const settleInOrder = async <T>(
  tasks: readonly Promise<T>[],
): Promise<SettledPartition<T>> => partitionSettled(await Promise.allSettled(tasks));

export const savedMoviesLoadFailureMessage = (failedCount: number): string => {
  const noun = failedCount === 1 ? "movie" : "movies";
  return `${failedCount} saved ${noun} couldn't be loaded`;
};
