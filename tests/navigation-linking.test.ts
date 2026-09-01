import {
  appLinkingConfig,
  parseMovieIdPathParam,
} from "../src/navigation/linking";

describe("Navigation linking config", () => {
  it("should map routes to web paths", () => {
    expect(appLinkingConfig.initialRouteName).toBe("Home");
    expect(appLinkingConfig.screens.Home).toBe("");
    expect(appLinkingConfig.screens.SearchMovie).toBe("search");
    expect(appLinkingConfig.screens.SearchFilters).toBe("filters");
    expect(appLinkingConfig.screens.Settings).toBe("settings");
    expect(appLinkingConfig.screens.MovieDetail.path).toBe("movie/:movieId");
  });

  it("should parse movie deep link parameter", () => {
    expect(parseMovieIdPathParam("1001")).toBe(1001);
    expect(parseMovieIdPathParam("invalid")).toBe(0);
  });
});
