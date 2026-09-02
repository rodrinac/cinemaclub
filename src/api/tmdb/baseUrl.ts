const DEFAULT_PROXY_PORT = "3001";
const DEFAULT_PROXY_PATH = "/api";
const LOCALHOST_PROXY_URL = `http://localhost:${DEFAULT_PROXY_PORT}${DEFAULT_PROXY_PATH}`;
const TMDB_HOSTNAMES = new Set(["api.themoviedb.org", "www.themoviedb.org"]);
const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export type MoviesApiBaseUrlOptions = {
  envBaseUrl?: string;
  expoHostUri?: string | null;
  isWeb: boolean;
};

export type MoviesApiBaseUrlResolution = {
  baseUrl: string;
  warning?: string;
};

const normalizeCandidateUrl = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    return new URL(trimmedValue);
  } catch {
    try {
      return new URL(`http://${trimmedValue}`);
    } catch {
      return null;
    }
  }
};

const ensureProxyPath = (url: URL) => {
  const normalizedUrl = new URL(url.toString());

  normalizedUrl.pathname = normalizedUrl.pathname.endsWith(DEFAULT_PROXY_PATH)
    ? normalizedUrl.pathname
    : `${normalizedUrl.pathname.replace(/\/+$/, "")}${DEFAULT_PROXY_PATH}`;

  return normalizedUrl.toString().replace(/\/+$/, "");
};

const getExpoHostName = (expoHostUri?: string | null) => {
  const parsedUrl = expoHostUri ? normalizeCandidateUrl(expoHostUri) : null;

  return parsedUrl?.hostname || null;
};

const buildProxyUrlFromHostName = (hostName: string) => {
  return `http://${hostName}:${DEFAULT_PROXY_PORT}${DEFAULT_PROXY_PATH}`;
};

export const resolveMoviesApiBaseUrl = ({
  envBaseUrl,
  expoHostUri,
  isWeb,
}: MoviesApiBaseUrlOptions): MoviesApiBaseUrlResolution => {
  const expoHostName = getExpoHostName(expoHostUri);
  const nativeFallbackUrl = expoHostName
    ? buildProxyUrlFromHostName(expoHostName)
    : LOCALHOST_PROXY_URL;
  const defaultBaseUrl = isWeb ? LOCALHOST_PROXY_URL : nativeFallbackUrl;
  const parsedEnvUrl = envBaseUrl ? normalizeCandidateUrl(envBaseUrl) : null;

  if (!parsedEnvUrl) {
    return {
      baseUrl: defaultBaseUrl,
      warning:
        !isWeb && !expoHostName
          ? "EXPO_PUBLIC_MOVIES_API_URL is unset and Expo host detection was unavailable. Falling back to localhost; use your machine LAN URL on physical devices if needed."
          : undefined,
    };
  }

  if (TMDB_HOSTNAMES.has(parsedEnvUrl.hostname)) {
    return {
      baseUrl: defaultBaseUrl,
      warning:
        "EXPO_PUBLIC_MOVIES_API_URL must point to the local Movies API proxy, not TMDB. Falling back to the proxy URL instead.",
    };
  }

  if (!isWeb && LOCALHOST_HOSTNAMES.has(parsedEnvUrl.hostname) && expoHostName) {
    return {
      baseUrl: buildProxyUrlFromHostName(expoHostName),
      warning:
        "EXPO_PUBLIC_MOVIES_API_URL pointed at localhost on native. Falling back to the Expo host LAN URL so physical devices can reach the Movies API proxy.",
    };
  }

  return {
    baseUrl: ensureProxyPath(parsedEnvUrl),
  };
};

export {
  buildProxyUrlFromHostName,
  ensureProxyPath,
  getExpoHostName,
  LOCALHOST_PROXY_URL,
};
