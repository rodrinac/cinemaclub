use std::collections::{BTreeMap, HashSet, VecDeque};

use serde::Serialize;
use url::Url;

pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const SUCCESS_CACHE_CONTROL: &str = "public, max-age=60";
pub const DEFAULT_CACHE_TTL_MS: f64 = 60_000.0;
pub const PITCH_CACHE_TTL_MS: f64 = 24.0 * 60.0 * 60.0 * 1000.0;
pub const DEFAULT_CACHE_MAX_ENTRIES: usize = 100;
pub const DEFAULT_SHARE_LANGUAGE: &str = "en-US";
pub const RATE_LIMITER_PERIOD_SECONDS: u64 = 10;
pub const PITCH_RATE_LIMITER_PERIOD_SECONDS: u64 = 60;

const TMDB_BASE_URL: &str = "https://api.themoviedb.org/3/";
const TMDB_API_PATH_PREFIX: &str = "/3/";
const CORS_METHODS: &str = "GET, OPTIONS";
const CORS_HEADERS: &str = "Content-Type";
const DAY_SECONDS: i64 = 86_400;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Policy {
    Common,
    Paged,
    Regional,
    Share,
    Detail,
    Search,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Endpoint {
    NowPlaying,
    Popular,
    TopRated,
    Upcoming,
    Genres,
    Search,
    Movie,
    Pitch,
    Share,
}

impl Endpoint {
    pub fn policy(self) -> Policy {
        match self {
            Endpoint::NowPlaying | Endpoint::Upcoming => Policy::Regional,
            Endpoint::Popular | Endpoint::TopRated => Policy::Paged,
            Endpoint::Genres | Endpoint::Pitch => Policy::Common,
            Endpoint::Search => Policy::Search,
            Endpoint::Movie => Policy::Detail,
            Endpoint::Share => Policy::Share,
        }
    }

    pub fn tmdb_path(self) -> &'static str {
        match self {
            Endpoint::NowPlaying => "movie/now_playing",
            Endpoint::Popular => "movie/popular",
            Endpoint::TopRated | Endpoint::Upcoming => "discover/movie",
            Endpoint::Genres => "genre/movie/list",
            Endpoint::Search => "search/movie",
            Endpoint::Movie | Endpoint::Pitch | Endpoint::Share => "movie",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RouteMatch {
    Health,
    InvalidMovieId,
    Tmdb {
        endpoint: Endpoint,
        movie_id: Option<u64>,
        canonical_path: String,
    },
    Pitch {
        movie_id: u64,
        canonical_path: String,
    },
    Share {
        movie_id: u64,
        canonical_path: String,
    },
    Unknown,
}

impl RouteMatch {
    pub fn supported_path(&self) -> bool {
        !matches!(self, RouteMatch::Unknown)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Reply {
    pub status: u16,
    pub headers: Vec<(&'static str, String)>,
    pub body: String,
}

impl Reply {
    pub fn json<T: Serialize>(
        status: u16,
        payload: &T,
        extra_headers: Vec<(&'static str, String)>,
    ) -> Self {
        let mut headers = vec![
            (
                "Content-Type",
                "application/json; charset=utf-8".to_string(),
            ),
            ("X-Content-Type-Options", "nosniff".to_string()),
        ];
        headers.extend(extra_headers);
        Self {
            status,
            headers,
            body: serde_json::to_string(payload).unwrap_or_else(|_| "{}".to_string()),
        }
    }

    pub fn raw_json(status: u16, body: String, extra_headers: Vec<(&'static str, String)>) -> Self {
        let mut headers = vec![
            (
                "Content-Type",
                "application/json; charset=utf-8".to_string(),
            ),
            ("X-Content-Type-Options", "nosniff".to_string()),
        ];
        headers.extend(extra_headers);
        Self {
            status,
            headers,
            body,
        }
    }

    pub fn empty(status: u16, headers: Vec<(&'static str, String)>) -> Self {
        Self {
            status,
            headers,
            body: String::new(),
        }
    }

    pub fn error(status: u16, message: &str, cors: Vec<(&'static str, String)>) -> Self {
        #[derive(Serialize)]
        struct ErrorBody<'a> {
            error: &'a str,
        }
        Self::json(status, &ErrorBody { error: message }, cors)
    }

    pub fn rate_limited(retry_after: u64, mut cors: Vec<(&'static str, String)>) -> Self {
        #[derive(Serialize)]
        struct RateLimitParams {
            retry_after: u64,
        }
        #[derive(Serialize)]
        struct RateLimitBody {
            error: &'static str,
            parameters: RateLimitParams,
        }
        cors.push(("Retry-After", retry_after.to_string()));
        Self::json(
            429,
            &RateLimitBody {
                error: "Too many requests. Please retry shortly.",
                parameters: RateLimitParams { retry_after },
            },
            cors,
        )
    }

    pub fn health(cors: Vec<(&'static str, String)>) -> Self {
        #[derive(Serialize)]
        struct HealthBody {
            status: &'static str,
            version: &'static str,
        }
        Self::json(
            200,
            &HealthBody {
                status: "ok",
                version: APP_VERSION,
            },
            cors,
        )
    }
}

pub fn parse_cors_allow_origin(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("CORS allow origin cannot be blank or whitespace.".to_string());
    }
    if trimmed == "*" || trimmed.contains(',') {
        return Err("CORS allow origin must be a single exact origin.".to_string());
    }
    Ok(Some(trimmed.to_string()))
}

pub fn build_cors_headers(
    cors_allow_origin: Option<&str>,
    include_preflight: bool,
) -> Vec<(&'static str, String)> {
    let Some(origin) = cors_allow_origin else {
        return Vec::new();
    };
    let mut headers = vec![
        ("Access-Control-Allow-Origin", origin.to_string()),
        ("Vary", "Origin".to_string()),
    ];
    if include_preflight {
        headers.push(("Access-Control-Allow-Methods", CORS_METHODS.to_string()));
        headers.push(("Access-Control-Allow-Headers", CORS_HEADERS.to_string()));
    }
    headers
}

pub fn parse_cache_max_entries(value: Option<&str>) -> Result<usize, String> {
    let Some(raw) = value else {
        return Ok(DEFAULT_CACHE_MAX_ENTRIES);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("CACHE_MAX_ENTRIES cannot be blank.".to_string());
    }
    let parsed = trimmed
        .parse::<usize>()
        .map_err(|_| "CACHE_MAX_ENTRIES must be a positive safe integer.".to_string())?;
    if parsed < 1 {
        return Err("CACHE_MAX_ENTRIES must be a positive safe integer.".to_string());
    }
    Ok(parsed)
}

fn contains_encoded_traversal(s: &str) -> bool {
    let bytes = s.as_bytes();
    let mut i = 0;
    while i + 2 < bytes.len() {
        if bytes[i] == b'%' {
            let hi = bytes[i + 1].to_ascii_lowercase();
            let lo = bytes[i + 2].to_ascii_lowercase();
            if (hi == b'2' && (lo == b'e' || lo == b'f')) || (hi == b'5' && lo == b'c') {
                return true;
            }
        }
        i += 1;
    }
    false
}

fn percent_decode_once(input: &str) -> Result<String, ()> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            if i + 2 >= bytes.len() {
                return Err(());
            }
            let hi = hex_val(bytes[i + 1]).ok_or(())?;
            let lo = hex_val(bytes[i + 2]).ok_or(())?;
            out.push((hi << 4) | lo);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).map_err(|_| ())
}

fn hex_val(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

pub fn has_unsafe_path_traversal(raw_pathname: &str) -> bool {
    if raw_pathname.contains('\\') || raw_pathname.contains('\0') {
        return true;
    }

    let mut current = raw_pathname.to_string();
    for _ in 0..3 {
        if contains_encoded_traversal(&current) {
            return true;
        }
        if current.split('/').any(|seg| seg == "." || seg == "..") {
            return true;
        }
        let Ok(decoded) = percent_decode_once(&current) else {
            return true;
        };
        if decoded == current {
            break;
        }
        current = decoded;
        if current.contains('\\') || current.contains('\0') {
            return true;
        }
    }

    contains_encoded_traversal(&current) || current.split('/').any(|seg| seg == "." || seg == "..")
}

/// Extract the raw pathname (preserving percent-encoding) from a full URL string.
pub fn raw_pathname_from_url(request_url: &str) -> &str {
    let after_scheme = request_url
        .find("://")
        .map(|idx| &request_url[idx + 3..])
        .unwrap_or(request_url);
    let path_and_more = after_scheme
        .find('/')
        .map(|idx| &after_scheme[idx..])
        .unwrap_or("/");
    let without_hash = path_and_more.split('#').next().unwrap_or("/");
    without_hash.split('?').next().unwrap_or("/")
}

fn parse_movie_id(text: &str) -> Option<u64> {
    if text.is_empty() || !text.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let id = text.parse::<u64>().ok()?;
    // JS Number.MAX_SAFE_INTEGER and no leading zeroes (e.g. "0687163").
    if id > 9_007_199_254_740_991 || id.to_string() != text {
        return None;
    }
    Some(id)
}

pub fn match_route(pathname: &str) -> RouteMatch {
    if pathname == "/health" {
        return RouteMatch::Health;
    }

    if let Some(rest) = pathname.strip_prefix("/share/movie/") {
        if !rest.is_empty() && rest.bytes().all(|b| b.is_ascii_digit()) {
            return match parse_movie_id(rest) {
                Some(movie_id) => RouteMatch::Share {
                    movie_id,
                    canonical_path: format!("/share/movie/{movie_id}"),
                },
                None => RouteMatch::InvalidMovieId,
            };
        }
    }

    if let Some(rest) = pathname
        .strip_prefix("/api/movies/")
        .and_then(|s| s.strip_suffix("/pitch"))
    {
        if !rest.is_empty() && rest.bytes().all(|b| b.is_ascii_digit()) {
            return match parse_movie_id(rest) {
                Some(movie_id) => RouteMatch::Pitch {
                    movie_id,
                    canonical_path: format!("/api/movies/{movie_id}/pitch"),
                },
                None => RouteMatch::InvalidMovieId,
            };
        }
    }

    if let Some(rest) = pathname
        .strip_prefix("/api/movies/")
        .or_else(|| pathname.strip_prefix("/api/movie/"))
    {
        if !rest.is_empty() && rest.bytes().all(|b| b.is_ascii_digit()) {
            return match parse_movie_id(rest) {
                Some(movie_id) => RouteMatch::Tmdb {
                    endpoint: Endpoint::Movie,
                    movie_id: Some(movie_id),
                    canonical_path: format!("/api/movies/{movie_id}"),
                },
                None => RouteMatch::InvalidMovieId,
            };
        }
    }

    let (endpoint, canonical_path) = match pathname {
        "/api/movies/now-playing" | "/api/movie/now_playing" => {
            (Endpoint::NowPlaying, "/api/movies/now-playing")
        }
        "/api/movies/popular" | "/api/movie/popular" => (Endpoint::Popular, "/api/movies/popular"),
        "/api/movies/top-rated" => (Endpoint::TopRated, "/api/movies/top-rated"),
        "/api/movies/upcoming" | "/api/movie/upcoming" => {
            (Endpoint::Upcoming, "/api/movies/upcoming")
        }
        "/api/genres" | "/api/genre/movie/list" => (Endpoint::Genres, "/api/genres"),
        "/api/search/movies" | "/api/search/movie" => (Endpoint::Search, "/api/search/movies"),
        _ => return RouteMatch::Unknown,
    };

    RouteMatch::Tmdb {
        endpoint,
        movie_id: None,
        canonical_path: canonical_path.to_string(),
    }
}

fn validate_language(value: &str) -> bool {
    if value.len() < 2 || value.len() > 35 {
        return false;
    }
    let mut parts = value.split('-');
    let Some(first) = parts.next() else {
        return false;
    };
    if first.len() < 2 || first.len() > 8 || !first.bytes().all(|b| b.is_ascii_alphanumeric()) {
        return false;
    }
    parts.all(|part| {
        !part.is_empty() && part.len() <= 8 && part.bytes().all(|b| b.is_ascii_alphanumeric())
    })
}

fn validate_region(value: &str) -> bool {
    value.len() == 2 && value.bytes().all(|b| b.is_ascii_uppercase())
}

fn validate_include_adult(value: &str) -> bool {
    value == "true" || value == "false"
}

fn validate_page(value: &str) -> bool {
    if value.is_empty() || value.starts_with('0') || !value.bytes().all(|b| b.is_ascii_digit()) {
        return false;
    }
    value
        .parse::<u32>()
        .is_ok_and(|n| (1..=500).contains(&n) && n.to_string() == value)
}

fn validate_append_to_response(value: &str) -> bool {
    if value.is_empty() {
        return false;
    }
    let mut seen = HashSet::new();
    for part in value.split(',') {
        if (part != "videos" && part != "credits") || !seen.insert(part) {
            return false;
        }
    }
    true
}

fn validate_query(value: &str) -> bool {
    let char_len = value.chars().count();
    if char_len == 0 || char_len > 500 {
        return false;
    }
    !value.bytes().any(|b| b < 0x20 || b == 0x7f)
}

fn allowed_fields(policy: Policy) -> &'static [&'static str] {
    match policy {
        Policy::Common => &["language", "include_adult"],
        Policy::Paged => &["language", "include_adult", "page"],
        Policy::Regional => &["language", "include_adult", "page", "region"],
        Policy::Share => &["lang"],
        Policy::Detail => &["language", "include_adult", "append_to_response"],
        Policy::Search => &[
            "language",
            "include_adult",
            "page",
            "append_to_response",
            "query",
        ],
    }
}

pub fn validate_query_params(
    url: &Url,
    policy: Policy,
) -> Result<BTreeMap<String, String>, String> {
    let allowed = allowed_fields(policy);
    let mut safe_params = BTreeMap::new();

    for (key, value) in url.query_pairs() {
        let key_str = key.as_ref();
        let value_str = value.as_ref();

        if !allowed.contains(&key_str) {
            return Err("Unknown parameter.".to_string());
        }
        if safe_params.contains_key(key_str) {
            return Err(format!("Duplicate parameter: {key_str}"));
        }

        let valid = match key_str {
            "language" | "lang" => validate_language(value_str),
            "include_adult" => validate_include_adult(value_str),
            "region" => validate_region(value_str),
            "page" => validate_page(value_str),
            "append_to_response" => validate_append_to_response(value_str),
            "query" => validate_query(value_str),
            _ => false,
        };

        if !valid {
            return Err(format!("Invalid value for parameter: {key_str}"));
        }

        safe_params.insert(key_str.to_string(), value_str.to_string());
    }

    if policy == Policy::Search && !safe_params.contains_key("query") {
        return Err("Missing required search query parameter.".to_string());
    }

    Ok(safe_params)
}

pub fn build_cache_key(canonical_path: &str, safe_params: &BTreeMap<String, String>) -> String {
    if safe_params.is_empty() {
        return canonical_path.to_string();
    }
    let mut serializer = url::form_urlencoded::Serializer::new(String::new());
    for (k, v) in safe_params {
        serializer.append_pair(k, v);
    }
    format!("{canonical_path}?{}", serializer.finish())
}

/// Convert a UTC Unix timestamp in milliseconds to `YYYY-MM-DD` (Howard Hinnant's civil-from-days).
pub fn to_tmdb_date(timestamp_ms: i64) -> String {
    let days = timestamp_ms.div_euclid(DAY_SECONDS * 1000);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };
    format!("{year:04}-{m:02}-{d:02}")
}

pub fn build_upstream_params(
    endpoint: Endpoint,
    safe_params: &BTreeMap<String, String>,
    now_ms: i64,
) -> Vec<(String, String)> {
    match endpoint {
        Endpoint::Upcoming => {
            let mut params: Vec<(String, String)> = safe_params
                .iter()
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect();
            let tomorrow = to_tmdb_date(now_ms + DAY_SECONDS * 1000);
            params.push(("sort_by".to_string(), "popularity.desc".to_string()));
            if safe_params.contains_key("region") {
                params.push(("release_date.gte".to_string(), tomorrow));
                params.push(("with_release_type".to_string(), "2|3".to_string()));
                params.push((
                    "primary_release_date.gte".to_string(),
                    to_tmdb_date(now_ms - 365 * DAY_SECONDS * 1000),
                ));
            } else {
                params.push(("primary_release_date.gte".to_string(), tomorrow));
            }
            params
        }
        Endpoint::TopRated => {
            let mut params: Vec<(String, String)> = safe_params
                .iter()
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect();
            params.push(("sort_by".to_string(), "vote_average.desc".to_string()));
            params.push(("vote_count.gte".to_string(), "5000".to_string()));
            params
        }
        Endpoint::Pitch => {
            let mut params: Vec<(String, String)> = safe_params
                .iter()
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect();
            params.push((
                "append_to_response".to_string(),
                "keywords,credits,release_dates".to_string(),
            ));
            params
        }
        Endpoint::Share => {
            let mut params = Vec::new();
            if let Some(lang) = safe_params.get("lang") {
                params.push(("language".to_string(), lang.clone()));
            }
            params
        }
        _ => safe_params
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect(),
    }
}

pub fn build_tmdb_url(
    endpoint: Endpoint,
    movie_id: Option<u64>,
    upstream_params: &[(String, String)],
) -> Result<Url, String> {
    let mut url = Url::parse(TMDB_BASE_URL).map_err(|_| "Invalid TMDB base URL".to_string())?;
    let path = match movie_id {
        Some(id) => format!("{TMDB_API_PATH_PREFIX}movie/{id}"),
        None => format!("{TMDB_API_PATH_PREFIX}{}", endpoint.tmdb_path()),
    };
    url.set_path(&path);
    if !upstream_params.is_empty() {
        let mut pairs = url.query_pairs_mut();
        for (k, v) in upstream_params {
            pairs.append_pair(k, v);
        }
    }

    if url.scheme() != "https"
        || url.host_str() != Some("api.themoviedb.org")
        || url.port().is_some()
        || !url.path().starts_with(TMDB_API_PATH_PREFIX)
    {
        return Err("Refusing a non-TMDB target URL".to_string());
    }

    Ok(url)
}

#[derive(Debug, Clone)]
struct CacheEntry<V> {
    cached_at_ms: f64,
    value: V,
}

/// Simple bounded LRU cache with per-entry TTL, used per Worker isolate.
#[derive(Debug)]
pub struct ResponseCache<V> {
    ttl_ms: f64,
    max_entries: usize,
    entries: VecDeque<(String, CacheEntry<V>)>,
}

impl<V: Clone> ResponseCache<V> {
    pub fn new(ttl_ms: f64, max_entries: usize) -> Self {
        Self {
            ttl_ms,
            max_entries: max_entries.max(1),
            entries: VecDeque::new(),
        }
    }

    pub fn get(&mut self, key: &str, now_ms: f64) -> Option<V> {
        let pos = self.entries.iter().position(|(k, _)| k == key)?;
        let (k, entry) = self.entries.remove(pos)?;
        if now_ms - entry.cached_at_ms >= self.ttl_ms {
            return None;
        }
        let value = entry.value.clone();
        self.entries.push_back((k, entry));
        Some(value)
    }

    pub fn set(&mut self, key: String, value: V, now_ms: f64) {
        if let Some(pos) = self.entries.iter().position(|(k, _)| k == &key) {
            self.entries.remove(pos);
        }
        self.entries.push_back((
            key,
            CacheEntry {
                cached_at_ms: now_ms,
                value,
            },
        ));
        while self.entries.len() > self.max_entries {
            self.entries.pop_front();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_canonical_and_legacy_routes() {
        assert_eq!(match_route("/health"), RouteMatch::Health);
        assert_eq!(
            match_route("/api/movies/popular"),
            RouteMatch::Tmdb {
                endpoint: Endpoint::Popular,
                movie_id: None,
                canonical_path: "/api/movies/popular".to_string(),
            }
        );
        assert_eq!(
            match_route("/api/movie/popular"),
            RouteMatch::Tmdb {
                endpoint: Endpoint::Popular,
                movie_id: None,
                canonical_path: "/api/movies/popular".to_string(),
            }
        );
        assert_eq!(
            match_route("/api/movies/687163"),
            RouteMatch::Tmdb {
                endpoint: Endpoint::Movie,
                movie_id: Some(687163),
                canonical_path: "/api/movies/687163".to_string(),
            }
        );
        assert_eq!(
            match_route("/api/movies/687163/pitch"),
            RouteMatch::Pitch {
                movie_id: 687163,
                canonical_path: "/api/movies/687163/pitch".to_string(),
            }
        );
        assert_eq!(match_route("/api/movie/687163/pitch"), RouteMatch::Unknown);
        assert_eq!(
            match_route("/api/movies/0687163/pitch"),
            RouteMatch::InvalidMovieId
        );
        assert_eq!(
            match_route("/share/movie/687163"),
            RouteMatch::Share {
                movie_id: 687163,
                canonical_path: "/share/movie/687163".to_string(),
            }
        );
        assert_eq!(
            match_route("/share/movie/0687163"),
            RouteMatch::InvalidMovieId
        );
        assert_eq!(match_route("/nope"), RouteMatch::Unknown);
    }

    #[test]
    fn detects_path_traversal() {
        assert!(has_unsafe_path_traversal("/api/..%2f..%2fetc/passwd"));
        assert!(has_unsafe_path_traversal("/api/../secret"));
        assert!(has_unsafe_path_traversal("/api/%252e%252e/secret"));
        assert!(has_unsafe_path_traversal("/api/a\\b"));
        assert!(!has_unsafe_path_traversal("/api/movies/now-playing"));
    }

    #[test]
    fn validates_query_params_per_policy() {
        let ok =
            Url::parse("https://proxy.example/api/movies/now-playing?page=1&region=US").unwrap();
        let params = validate_query_params(&ok, Policy::Regional).unwrap();
        assert_eq!(params.get("region").map(String::as_str), Some("US"));

        for bad_url in [
            "https://proxy.example/api/movies/now-playing?region=br",
            "https://proxy.example/api/movies/upcoming?region=BRA",
            "https://proxy.example/api/movies/top-rated?region=BR",
            "https://proxy.example/api/movies/popular?page=1&page=2",
            "https://proxy.example/api/movies/popular?unknown=1",
            "https://proxy.example/api/search/movies?language=en-US",
        ] {
            let url = Url::parse(bad_url).unwrap();
            let policy = if bad_url.contains("top-rated") || bad_url.contains("popular") {
                Policy::Paged
            } else if bad_url.contains("search") {
                Policy::Search
            } else {
                Policy::Regional
            };
            assert!(
                validate_query_params(&url, policy).is_err(),
                "expected err for {bad_url}"
            );
        }
    }

    #[test]
    fn builds_discover_backed_upcoming_and_top_rated_urls() {
        // 2026-10-26T12:00:00Z
        let now_ms = 1_793_016_000_000_i64;
        assert_eq!(to_tmdb_date(now_ms), "2026-10-26");

        let global_upcoming = build_tmdb_url(
            Endpoint::Upcoming,
            None,
            &build_upstream_params(Endpoint::Upcoming, &BTreeMap::new(), now_ms),
        )
        .unwrap();
        assert_eq!(global_upcoming.path(), "/3/discover/movie");
        assert!(global_upcoming
            .query()
            .unwrap()
            .contains("primary_release_date.gte=2026-10-27"));
        assert!(global_upcoming
            .query()
            .unwrap()
            .contains("sort_by=popularity.desc"));

        let mut regional_params = BTreeMap::new();
        regional_params.insert("region".to_string(), "BR".to_string());
        let regional_upcoming = build_tmdb_url(
            Endpoint::Upcoming,
            None,
            &build_upstream_params(Endpoint::Upcoming, &regional_params, now_ms),
        )
        .unwrap();
        let q = regional_upcoming.query().unwrap();
        assert!(q.contains("region=BR"));
        assert!(q.contains("release_date.gte=2026-10-27"));
        assert!(q.contains("with_release_type=2%7C3"));
        assert!(q.contains("primary_release_date.gte=2025-10-26"));

        let top_rated = build_tmdb_url(
            Endpoint::TopRated,
            None,
            &build_upstream_params(Endpoint::TopRated, &BTreeMap::new(), now_ms),
        )
        .unwrap();
        assert_eq!(
            top_rated.as_str(),
            "https://api.themoviedb.org/3/discover/movie?sort_by=vote_average.desc&vote_count.gte=5000"
        );
    }

    #[test]
    fn cache_evicts_lru_and_expired_entries() {
        let mut cache = ResponseCache::new(60_000.0, 2);
        cache.set("a".to_string(), 1, 0.0);
        cache.set("b".to_string(), 2, 100.0);
        assert_eq!(cache.get("a", 200.0), Some(1));
        cache.set("c".to_string(), 3, 300.0);
        assert_eq!(cache.get("b", 400.0), None);
        assert_eq!(cache.get("a", 400.0), Some(1));
        assert_eq!(cache.get("a", 60_000.0), None);
    }

    #[test]
    fn rate_limit_reply_matches_header_and_body() {
        let reply = Reply::rate_limited(10, Vec::new());
        assert_eq!(reply.status, 429);
        assert!(reply
            .headers
            .iter()
            .any(|(k, v)| *k == "Retry-After" && v == "10"));
        let body: serde_json::Value = serde_json::from_str(&reply.body).unwrap();
        assert_eq!(body["parameters"]["retry_after"], 10);
    }

    #[test]
    fn cors_rejects_wildcard_and_lists() {
        assert_eq!(parse_cors_allow_origin(None).unwrap(), None);
        assert_eq!(
            parse_cors_allow_origin(Some("https://cinemaclub.expo.app")).unwrap(),
            Some("https://cinemaclub.expo.app".to_string())
        );
        assert!(parse_cors_allow_origin(Some("*")).is_err());
        assert!(parse_cors_allow_origin(Some("https://a.example,https://b.example")).is_err());
        assert!(parse_cors_allow_origin(Some("   ")).is_err());
    }
}
