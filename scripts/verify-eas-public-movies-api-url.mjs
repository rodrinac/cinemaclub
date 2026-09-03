import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const TMDB_HOSTNAMES = new Set(["api.themoviedb.org", "www.themoviedb.org"]);
const REQUIRED_ENVIRONMENTS = new Set(["preview", "production"]);
const REQUIRED_PROFILE_NAMES = new Set(["preview", "production"]);

const truthyValues = new Set(["1", "true", "yes"]);

const isTruthy = (value) => truthyValues.has(String(value ?? "").toLowerCase());

const fail = (reason) => {
  console.error(
    [
      `EAS remote preview/release builds require EXPO_PUBLIC_MOVIES_API_URL: ${reason}`,
      "Local .env files are not uploaded to EAS Build workers.",
      "Set EXPO_PUBLIC_MOVIES_API_URL to your deployed Movies API proxy, for example:",
      "  https://<api-id>.execute-api.<region>.amazonaws.com/<stage>/api",
      "Then set it remotely with:",
      "  eas env:set --environment production --name EXPO_PUBLIC_MOVIES_API_URL --value https://<stage invoke url>/api --visibility plaintext",
    ].join("\n"),
  );
  process.exit(1);
};

const loadBuildProfiles = () => {
  const easConfigPath = path.join(process.cwd(), "eas.json");
  const easConfigText = readFileSync(easConfigPath, "utf8");
  const easConfig = JSON.parse(easConfigText);

  return easConfig.build ?? {};
};

const resolveProfile = (profiles, profileName, visited = new Set()) => {
  if (!profileName) {
    return {};
  }

  const profile = profiles[profileName];

  if (!profile || typeof profile !== "object") {
    return {};
  }

  if (!profile.extends) {
    return profile;
  }

  if (visited.has(profileName)) {
    throw new Error(`Circular EAS profile inheritance detected for "${profileName}".`);
  }

  visited.add(profileName);

  const parentProfile = resolveProfile(profiles, profile.extends, visited);
  const { extends: _ignoredExtends, ...currentProfile } = profile;

  return {
    ...parentProfile,
    ...currentProfile,
  };
};

const shouldEnforce = (profileName, profile) => {
  if (REQUIRED_PROFILE_NAMES.has(profileName)) {
    return true;
  }

  if (REQUIRED_ENVIRONMENTS.has(profile.environment)) {
    return true;
  }

  return profile.distribution === "store";
};

const isEasBuild = () => {
  return isTruthy(process.env.EAS_BUILD) || Boolean(process.env.EAS_BUILD_RUNNER);
};

if (!isEasBuild()) {
  console.log(
    "[eas-guard] Skipping EXPO_PUBLIC_MOVIES_API_URL validation outside EAS Build.",
  );
  process.exit(0);
}

const easBuildProfile = process.env.EAS_BUILD_PROFILE?.trim();

let profile = {};

try {
  profile = resolveProfile(loadBuildProfiles(), easBuildProfile);
} catch (error) {
  fail(
    error instanceof Error
      ? `unable to inspect eas.json (${error.message})`
      : "unable to inspect eas.json",
  );
}

if (!shouldEnforce(easBuildProfile, profile)) {
  console.log(
    "[eas-guard] Skipping EXPO_PUBLIC_MOVIES_API_URL validation for local/dev EAS build profile.",
  );
  process.exit(0);
}

const configuredBaseUrl = process.env.EXPO_PUBLIC_MOVIES_API_URL?.trim();

if (!configuredBaseUrl) {
  fail("the variable is missing or blank.");
}

let parsedUrl;

try {
  parsedUrl = new URL(configuredBaseUrl);
} catch {
  fail("the value must be a valid absolute URL.");
}

if (!["http:", "https:"].includes(parsedUrl.protocol)) {
  fail("the value must use http or https.");
}

if (LOCALHOST_HOSTNAMES.has(parsedUrl.hostname)) {
  fail("localhost-style URLs are not allowed for remote preview/release builds.");
}

if (TMDB_HOSTNAMES.has(parsedUrl.hostname)) {
  fail("the value must point at the Movies API proxy, not TMDB directly.");
}

console.log(
  "[eas-guard] EXPO_PUBLIC_MOVIES_API_URL is configured for this EAS preview/release build.",
);
