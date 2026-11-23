import {
  partitionSettled,
  savedCountLabel,
  savedMoviesLoadFailureMessage,
  settleInOrder,
} from "../src/pages/Saved/loadSavedMovies";

const rejected = (reason: string): Promise<never> => {
  const task = Promise.reject(new Error(reason));
  task.catch(() => undefined);
  return task;
};

describe("partitionSettled", () => {
  it("returns every value when all succeed", () => {
    const results: PromiseSettledResult<string>[] = [
      { status: "fulfilled", value: "first" },
      { status: "fulfilled", value: "second" },
    ];

    expect(partitionSettled(results)).toEqual({
      values: ["first", "second"],
      failedCount: 0,
    });
  });

  it("keeps successful values in input order and counts failures", () => {
    const results: PromiseSettledResult<number>[] = [
      { status: "rejected", reason: new Error("removed") },
      { status: "fulfilled", value: 20 },
      { status: "rejected", reason: new Error("offline") },
      { status: "fulfilled", value: 40 },
    ];

    expect(partitionSettled(results)).toEqual({
      values: [20, 40],
      failedCount: 2,
    });
  });

  it("counts every result as failed when none succeed", () => {
    const results: PromiseSettledResult<string>[] = [
      { status: "rejected", reason: new Error("missing") },
      { status: "rejected", reason: new Error("timeout") },
    ];

    expect(partitionSettled(results)).toEqual({
      values: [],
      failedCount: 2,
    });
  });
});

describe("settleInOrder", () => {
  it("returns every value when all succeed", async () => {
    await expect(settleInOrder([Promise.resolve("a"), Promise.resolve("b")])).resolves.toEqual({
      values: ["a", "b"],
      failedCount: 0,
    });
  });

  it("keeps successful values in input order and counts failures", async () => {
    await expect(
      settleInOrder([
        rejected("removed"),
        Promise.resolve("kept-first"),
        rejected("offline"),
        Promise.resolve("kept-second"),
      ]),
    ).resolves.toEqual({
      values: ["kept-first", "kept-second"],
      failedCount: 2,
    });
  });

  it("counts every result as failed when none succeed", async () => {
    await expect(settleInOrder([rejected("missing"), rejected("timeout")])).resolves.toEqual({
      values: [],
      failedCount: 2,
    });
  });
});

describe("savedCountLabel", () => {
  it("stays silent when nothing is saved", () => {
    expect(savedCountLabel(0)).toBeNull();
  });

  it("uses the singular copy for one movie", () => {
    expect(savedCountLabel(1)).toBe("1 movie saved");
  });

  it("uses the plural copy for more than one movie", () => {
    expect(savedCountLabel(3)).toBe("3 movies saved");
  });
});

describe("savedMoviesLoadFailureMessage", () => {
  it("uses the singular copy for one failure", () => {
    expect(savedMoviesLoadFailureMessage(1)).toBe("1 saved movie couldn't be loaded");
  });

  it("uses the plural copy for more than one failure", () => {
    expect(savedMoviesLoadFailureMessage(3)).toBe("3 saved movies couldn't be loaded");
  });
});
