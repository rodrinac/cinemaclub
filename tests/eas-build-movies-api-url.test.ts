import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(__dirname, "..");
const validatorPath = path.join(
  repositoryRoot,
  "scripts",
  "verify-eas-public-movies-api-url.mjs",
);

const runValidator = (env: Record<string, string> = {}) => {
  return spawnSync(process.execPath, [validatorPath], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });
};

describe("verify-eas-public-movies-api-url", () => {
  it("uses a clean Expo export with the production EAS environment", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
    );
    const command = packageJson.scripts["build:web:production"];

    expect(command).toContain("eas env:exec production");
    expect(command).toContain("expo export --platform web --clear");
  });

  it("passes outside EAS", () => {
    const result = runValidator({
      EAS_BUILD: "",
      EAS_BUILD_RUNNER: "",
      EAS_BUILD_PROFILE: "",
      EXPO_PUBLIC_MOVIES_API_URL: "",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Skipping");
  });

  it("passes for the development profile", () => {
    const result = runValidator({
      EAS_BUILD: "true",
      EAS_BUILD_RUNNER: "eas-build",
      EAS_BUILD_PROFILE: "development",
      EXPO_PUBLIC_MOVIES_API_URL: "",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("local/dev");
  });

  it("fails for the production profile when the URL is missing", () => {
    const result = runValidator({
      EAS_BUILD: "true",
      EAS_BUILD_RUNNER: "eas-build",
      EAS_BUILD_PROFILE: "production",
      EXPO_PUBLIC_MOVIES_API_URL: "",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("require EXPO_PUBLIC_MOVIES_API_URL");
    expect(result.stderr).toContain("not uploaded to EAS Build");
  });

  it("fails for release-style builds when localhost is provided", () => {
    const result = runValidator({
      EAS_BUILD: "true",
      EAS_BUILD_RUNNER: "eas-build",
      EAS_BUILD_PROFILE: "production",
      EXPO_PUBLIC_MOVIES_API_URL: "http://localhost:3001/api",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("localhost-style");
  });

  it("fails when TMDB is provided directly", () => {
    const result = runValidator({
      EAS_BUILD: "true",
      EAS_BUILD_RUNNER: "eas-build",
      EAS_BUILD_PROFILE: "production",
      EXPO_PUBLIC_MOVIES_API_URL: "https://api.themoviedb.org/3",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Movies API proxy");
    expect(result.stderr).toContain("TMDB directly");
  });

  it("passes for a deployed proxy URL", () => {
    const result = runValidator({
      EAS_BUILD: "true",
      EAS_BUILD_RUNNER: "eas-build",
      EAS_BUILD_PROFILE: "production",
      EXPO_PUBLIC_MOVIES_API_URL:
        "https://abc123.execute-api.eu-west-1.amazonaws.com/prod/api",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("configured for this EAS preview/release build");
  });
});
