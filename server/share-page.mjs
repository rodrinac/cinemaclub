const SITE_NAME = "Cinema Club";
const DESCRIPTION_MAX_LENGTH = 200;
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";
const DEFAULT_DESCRIPTION = "Discover now playing, top rated, and upcoming movies with Cinema Club.";
const TMDB_IMAGE_PATH = /^\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/;

// Link-preview crawlers only read the HTML, so nothing here may depend on
// scripts, and every TMDB string is escaped before it lands in markup.
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const truncate = (text, maxLength) => {
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const cut = cleaned.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

const tmdbImageUrl = (size, path) =>
  typeof path === "string" && TMDB_IMAGE_PATH.test(path) ? `${TMDB_IMAGE_BASE_URL}${size}${path}` : null;

const toOgLocale = (language) => language.replace("-", "_");

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const SHARE_PAGE_HEADERS = Object.freeze({
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": "default-src 'none'; img-src https:",
  "X-Content-Type-Options": "nosniff",
});

export const parseShareAppOrigin = (value) => {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }

  const trimmedValue = String(value).trim();
  let url;
  try {
    url = new URL(trimmedValue);
  } catch {
    throw new Error("Share app origin must be an absolute URL origin.");
  }

  const isLoopback = url.protocol === "http:" && LOOPBACK_HOSTNAMES.has(url.hostname);

  if ((url.protocol !== "https:" && !isLoopback) || url.origin !== trimmedValue.replace(/\/$/, "")) {
    throw new Error("Share app origin must be an https origin without a path.");
  }

  return url.origin;
};

/**
 * An explicit SHARE_APP_ORIGIN must be valid. Falling back to the CORS origin is
 * best-effort: an origin share pages cannot use disables them instead of
 * failing the whole proxy at startup.
 */
export const resolveShareAppOrigin = ({ shareAppOrigin, corsAllowOrigin }) => {
  if (shareAppOrigin != null) {
    return parseShareAppOrigin(shareAppOrigin);
  }

  try {
    return parseShareAppOrigin(corsAllowOrigin);
  } catch {
    return null;
  }
};

const renderPage = ({ language, title, description, image, imageAlt, redirectUrl, type }) => {
  const metaTags = [
    ["name", "description", description],
    ["property", "og:type", type],
    ["property", "og:site_name", SITE_NAME],
    ["property", "og:title", title],
    ["property", "og:description", description],
    ["property", "og:image", image],
    ["property", "og:image:alt", imageAlt],
    ["property", "og:locale", toOgLocale(language)],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", title],
    ["name", "twitter:description", description],
    ["name", "twitter:image", image],
  ]
    .map(([attribute, key, content]) => `<meta ${attribute}="${key}" content="${escapeHtml(content)}">`)
    .join("\n");

  return `<!doctype html>
<html lang="${escapeHtml(language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
${metaTags}
<meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}">
</head>
<body>
<p><a href="${escapeHtml(redirectUrl)}">${escapeHtml(title)}</a></p>
</body>
</html>
`;
};

export const buildMovieSharePage = ({ movie, movieId, language, appOrigin }) => {
  const year = /^\d{4}/.test(movie.release_date ?? "") ? movie.release_date.slice(0, 4) : null;
  const movieTitle = movie.title || movie.original_title || SITE_NAME;
  const title = `${year ? `${movieTitle} (${year})` : movieTitle} • ${SITE_NAME}`;
  // Previews render landscape, so the backdrop beats the poster when both exist.
  const image =
    tmdbImageUrl("w1280", movie.backdrop_path) ??
    tmdbImageUrl("w780", movie.poster_path) ??
    `${appOrigin}/apple-touch-icon.png`;

  return renderPage({
    language,
    title,
    description: movie.overview ? truncate(movie.overview, DESCRIPTION_MAX_LENGTH) : DEFAULT_DESCRIPTION,
    image,
    imageAlt: movieTitle,
    redirectUrl: `${appOrigin}/movie/${movieId}`,
    type: "video.movie",
  });
};

export const buildFallbackSharePage = ({ redirectPath, language, appOrigin }) =>
  renderPage({
    language,
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    image: `${appOrigin}/apple-touch-icon.png`,
    imageAlt: SITE_NAME,
    redirectUrl: `${appOrigin}${redirectPath}`,
    type: "website",
  });
