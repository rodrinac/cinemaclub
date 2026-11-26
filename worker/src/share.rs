use serde_json::Value;
use url::Url;

const SITE_NAME: &str = "Cinema Club";
const DESCRIPTION_MAX_LENGTH: usize = 200;
const TMDB_IMAGE_BASE_URL: &str = "https://image.tmdb.org/t/p/";
const DEFAULT_DESCRIPTION: &str =
    "Discover now playing, top rated, and upcoming movies with Cinema Club.";

pub const SHARE_PAGE_HEADERS: &[(&str, &str)] = &[
    ("Content-Type", "text/html; charset=utf-8"),
    (
        "Content-Security-Policy",
        "default-src 'none'; img-src https:",
    ),
    ("X-Content-Type-Options", "nosniff"),
];

fn escape_html(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            other => out.push(other),
        }
    }
    out
}

fn truncate(text: &str, max_length: usize) -> String {
    let cleaned = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if cleaned.chars().count() <= max_length {
        return cleaned;
    }

    let cut: String = cleaned.chars().take(max_length - 1).collect();
    if let Some(last_space) = cut.rfind(' ') {
        if cut[..last_space].chars().count() > max_length / 2 {
            return format!("{}…", cut[..last_space].trim_end());
        }
    }
    format!("{}…", cut.trim_end())
}

fn is_valid_tmdb_image_path(path: &str) -> bool {
    let Some(rest) = path.strip_prefix('/') else {
        return false;
    };
    let Some((stem, ext)) = rest.rsplit_once('.') else {
        return false;
    };
    if stem.is_empty()
        || !stem
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return false;
    }
    matches!(ext, "jpg" | "jpeg" | "png" | "webp")
}

fn tmdb_image_url(size: &str, path: Option<&str>) -> Option<String> {
    let path = path?;
    if is_valid_tmdb_image_path(path) {
        Some(format!("{TMDB_IMAGE_BASE_URL}{size}{path}"))
    } else {
        None
    }
}

fn to_og_locale(language: &str) -> String {
    language.replacen('-', "_", 1)
}

fn is_loopback_host(host: &str) -> bool {
    matches!(host, "localhost" | "127.0.0.1" | "[::1]")
}

pub fn parse_share_app_origin(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let url = Url::parse(trimmed)
        .map_err(|_| "Share app origin must be an absolute URL origin.".to_string())?;
    let host = url.host_str().unwrap_or("");
    let is_loopback = url.scheme() == "http" && is_loopback_host(host);
    let origin = url.origin().ascii_serialization();
    let without_trailing_slash = trimmed.strip_suffix('/').unwrap_or(trimmed);

    if (url.scheme() != "https" && !is_loopback) || origin != without_trailing_slash {
        return Err("Share app origin must be an https origin without a path.".to_string());
    }

    Ok(Some(origin))
}

/// An explicit `SHARE_APP_ORIGIN` must be valid. Falling back to the CORS
/// origin is best-effort: an origin share pages cannot use disables them
/// instead of failing the whole proxy at startup.
pub fn resolve_share_app_origin(
    share_app_origin: Option<&str>,
    cors_allow_origin: Option<&str>,
) -> Result<Option<String>, String> {
    if share_app_origin.is_some() {
        return parse_share_app_origin(share_app_origin);
    }
    Ok(parse_share_app_origin(cors_allow_origin).ok().flatten())
}

struct PageParams<'a> {
    language: &'a str,
    title: &'a str,
    description: &'a str,
    image: &'a str,
    image_alt: &'a str,
    redirect_url: &'a str,
    og_type: &'a str,
}

fn render_page(params: PageParams<'_>) -> String {
    let og_locale = to_og_locale(params.language);
    let meta_tags = [
        ("name", "description", params.description),
        ("property", "og:type", params.og_type),
        ("property", "og:site_name", SITE_NAME),
        ("property", "og:title", params.title),
        ("property", "og:description", params.description),
        ("property", "og:image", params.image),
        ("property", "og:image:alt", params.image_alt),
        ("property", "og:locale", og_locale.as_str()),
        ("name", "twitter:card", "summary_large_image"),
        ("name", "twitter:title", params.title),
        ("name", "twitter:description", params.description),
        ("name", "twitter:image", params.image),
    ]
    .iter()
    .map(|(attr, key, content)| {
        format!(
            r#"<meta {attr}="{key}" content="{}">"#,
            escape_html(content)
        )
    })
    .collect::<Vec<_>>()
    .join("\n");

    let escaped_lang = escape_html(params.language);
    let escaped_title = escape_html(params.title);
    let escaped_redirect = escape_html(params.redirect_url);

    format!(
        "<!doctype html>\n\
<html lang=\"{escaped_lang}\">\n\
<head>\n\
<meta charset=\"utf-8\">\n\
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n\
<meta name=\"robots\" content=\"noindex\">\n\
<title>{escaped_title}</title>\n\
{meta_tags}\n\
<meta http-equiv=\"refresh\" content=\"0;url={escaped_redirect}\">\n\
</head>\n\
<body>\n\
<p><a href=\"{escaped_redirect}\">{escaped_title}</a></p>\n\
</body>\n\
</html>\n"
    )
}

fn release_year(movie: &Value) -> Option<&str> {
    let date = movie.get("release_date")?.as_str()?;
    let year = date.get(..4)?;
    if year.bytes().all(|b| b.is_ascii_digit()) {
        Some(year)
    } else {
        None
    }
}

pub fn build_movie_share_page(
    movie: &Value,
    movie_id: u64,
    language: &str,
    app_origin: &str,
) -> String {
    let movie_title = movie
        .get("title")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .or_else(|| {
            movie
                .get("original_title")
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
        })
        .unwrap_or(SITE_NAME);

    let title = match release_year(movie) {
        Some(year) => format!("{movie_title} ({year}) • {SITE_NAME}"),
        None => format!("{movie_title} • {SITE_NAME}"),
    };

    let image = tmdb_image_url("w1280", movie.get("backdrop_path").and_then(Value::as_str))
        .or_else(|| tmdb_image_url("w780", movie.get("poster_path").and_then(Value::as_str)))
        .unwrap_or_else(|| format!("{app_origin}/apple-touch-icon.png"));

    let description = movie
        .get("overview")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(|s| truncate(s, DESCRIPTION_MAX_LENGTH))
        .unwrap_or_else(|| DEFAULT_DESCRIPTION.to_string());

    let redirect_url = format!("{app_origin}/movie/{movie_id}");

    render_page(PageParams {
        language,
        title: &title,
        description: &description,
        image: &image,
        image_alt: movie_title,
        redirect_url: &redirect_url,
        og_type: "video.movie",
    })
}

pub fn build_fallback_share_page(redirect_path: &str, language: &str, app_origin: &str) -> String {
    let image = format!("{app_origin}/apple-touch-icon.png");
    let redirect_url = format!("{app_origin}{redirect_path}");

    render_page(PageParams {
        language,
        title: SITE_NAME,
        description: DEFAULT_DESCRIPTION,
        image: &image,
        image_alt: SITE_NAME,
        redirect_url: &redirect_url,
        og_type: "website",
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn renders_escaped_localized_movie_share_page() {
        let overview = format!("{}Fim.", "Um professor acorda numa nave. ".repeat(10));
        let movie = json!({
            "id": 687163,
            "title": "Devoradores de \"Estrelas\" <script>alert(1)</script>",
            "release_date": "2026-03-15",
            "overview": overview,
            "backdrop_path": "/backdrop123.jpg",
            "poster_path": "/poster123.jpg"
        });

        let html = build_movie_share_page(&movie, 687163, "pt-BR", "https://cinemaclub.expo.app");

        assert!(!html.contains("<script>"));
        assert!(html.contains(r#"<html lang="pt-BR">"#));
        assert!(html.contains(
            r#"<meta property="og:title" content="Devoradores de &quot;Estrelas&quot; &lt;script&gt;alert(1)&lt;/script&gt; (2026) • Cinema Club">"#
        ));
        assert!(html.contains(
            r#"<meta property="og:image" content="https://image.tmdb.org/t/p/w1280/backdrop123.jpg">"#
        ));
        assert!(html.contains(r#"<meta property="og:locale" content="pt_BR">"#));
        assert!(html.contains(r#"<meta property="og:type" content="video.movie">"#));
        assert!(html.contains(
            r#"<meta http-equiv="refresh" content="0;url=https://cinemaclub.expo.app/movie/687163">"#
        ));
    }

    #[test]
    fn resolves_share_app_origin_rules() {
        assert_eq!(
            resolve_share_app_origin(None, Some("https://cinemaclub.expo.app")).unwrap(),
            Some("https://cinemaclub.expo.app".to_string())
        );
        assert_eq!(
            resolve_share_app_origin(None, Some("http://127.0.0.1:8081")).unwrap(),
            Some("http://127.0.0.1:8081".to_string())
        );
        assert_eq!(
            resolve_share_app_origin(None, Some("http://example.com")).unwrap(),
            None
        );
        assert!(resolve_share_app_origin(Some("https://cinemaclub.expo.app/app"), None).is_err());
    }
}
