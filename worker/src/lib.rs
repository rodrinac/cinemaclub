pub mod pitch;
pub mod proxy;
pub mod share;

#[cfg(target_arch = "wasm32")]
mod runtime {
    use std::cell::RefCell;
    use std::collections::BTreeMap;

    use serde_json::{json, Value};
    use url::Url;
    use worker::{
        console_error, console_log, event, js_sys, Context, Env, Fetch, Headers, Method, Request,
        RequestInit, RequestRedirect, Response, Result,
    };

    use crate::pitch::{self, PitchApiBody, DEFAULT_PITCH_MODEL};
    use crate::proxy::{
        self, Endpoint, Policy, Reply, ResponseCache, RouteMatch, DEFAULT_CACHE_MAX_ENTRIES,
        DEFAULT_CACHE_TTL_MS, DEFAULT_SHARE_LANGUAGE, PITCH_CACHE_TTL_MS,
        PITCH_RATE_LIMITER_PERIOD_SECONDS, RATE_LIMITER_PERIOD_SECONDS, SUCCESS_CACHE_CONTROL,
    };
    use crate::share::{self, SHARE_PAGE_HEADERS};

    #[derive(Clone)]
    struct CachedTmdb {
        status: u16,
        body: String,
    }

    thread_local! {
        static TMDB_CACHE: RefCell<ResponseCache<CachedTmdb>> =
            RefCell::new(ResponseCache::new(DEFAULT_CACHE_TTL_MS, DEFAULT_CACHE_MAX_ENTRIES));
        static SHARE_CACHE: RefCell<ResponseCache<String>> =
            RefCell::new(ResponseCache::new(DEFAULT_CACHE_TTL_MS, DEFAULT_CACHE_MAX_ENTRIES));
        static PITCH_CACHE: RefCell<ResponseCache<String>> =
            RefCell::new(ResponseCache::new(PITCH_CACHE_TTL_MS, DEFAULT_CACHE_MAX_ENTRIES));
    }

    fn now_ms() -> f64 {
        js_sys::Date::now()
    }

    fn env_var(env: &Env, name: &str) -> Option<String> {
        env.var(name).ok().map(|v| v.to_string())
    }

    fn tmdb_token(env: &Env) -> Option<String> {
        env.secret("TMDB_API_TOKEN")
            .ok()
            .or_else(|| env.var("TMDB_API_TOKEN").ok())
            .map(|v| v.to_string().trim().to_string())
            .filter(|v| !v.is_empty())
    }

    fn client_ip(request: &Request) -> Option<String> {
        request
            .headers()
            .get("cf-connecting-ip")
            .ok()
            .flatten()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
    }

    fn request_id(request: &Request) -> String {
        request
            .headers()
            .get("cf-ray")
            .ok()
            .flatten()
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| format!("worker-{}", now_ms() as i64))
    }

    /// Check a Cloudflare Rate Limiting binding. If the binding is configured,
    /// fail closed when client identity is missing or the limiter errors.
    async fn within_rate_limit(env: &Env, request: &Request, binding: &str) -> bool {
        let Ok(limiter) = env.rate_limiter(binding) else {
            return true;
        };
        let Some(key) = client_ip(request) else {
            return false;
        };
        limiter
            .limit(key)
            .await
            .is_ok_and(|outcome| outcome.success)
    }

    fn to_worker_response(reply: Reply) -> Result<Response> {
        let mut response = if reply.body.is_empty() {
            Response::empty()?
        } else {
            Response::ok(reply.body)?
        }
        .with_status(reply.status);

        for (name, value) in reply.headers {
            response.headers_mut().set(name, &value)?;
        }
        Ok(response)
    }

    fn html_reply(status: u16, body: String, extra_headers: Vec<(&'static str, String)>) -> Reply {
        let mut headers: Vec<(&'static str, String)> = SHARE_PAGE_HEADERS
            .iter()
            .map(|(k, v)| (*k, (*v).to_string()))
            .collect();
        headers.extend(extra_headers);
        Reply {
            status,
            headers,
            body,
        }
    }

    async fn fetch_tmdb(url: &Url, token: &str) -> std::result::Result<(u16, String), String> {
        let headers = Headers::new();
        headers
            .set("Accept", "application/json")
            .map_err(|e| e.to_string())?;
        headers
            .set("Authorization", &format!("Bearer {token}"))
            .map_err(|e| e.to_string())?;

        // workerd does not implement `redirect: "error"` (throws TypeError).
        // Use `manual` and explicitly reject 3xx responses so redirects are never followed.
        let mut init = RequestInit::new();
        init.with_method(Method::Get)
            .with_headers(headers)
            .with_redirect(RequestRedirect::Manual);

        let outbound = Request::new_with_init(url.as_str(), &init).map_err(|e| e.to_string())?;
        let mut response = Fetch::Request(outbound)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = response.status_code();
        if (300..400).contains(&status) {
            return Err(format!("Refusing upstream redirect ({status})"));
        }
        let text = response.text().await.map_err(|e| e.to_string())?;
        Ok((status, text))
    }

    fn log_info(payload: Value) {
        console_log!("{}", payload);
    }

    fn log_error(payload: Value) {
        console_error!("{}", payload);
    }

    struct ReqCtx<'a> {
        env: &'a Env,
        request: &'a Request,
        req_id: &'a str,
    }

    async fn handle_tmdb_request(
        ctx: &ReqCtx<'_>,
        endpoint: Endpoint,
        movie_id: Option<u64>,
        canonical_path: &str,
        safe_params: &BTreeMap<String, String>,
        cors_headers: Vec<(&'static str, String)>,
    ) -> Reply {
        let ReqCtx {
            env,
            request,
            req_id,
        } = *ctx;
        let cache_key = proxy::build_cache_key(canonical_path, safe_params);
        let now = now_ms();

        if let Some(cached) = TMDB_CACHE.with_borrow_mut(|c| c.get(&cache_key, now)) {
            log_info(json!({
                "kind": "tmdb_proxy_request",
                "source": "worker",
                "requestId": req_id,
                "route": canonical_path,
                "method": "GET",
                "status": cached.status,
                "cache": "hit",
            }));
            let mut headers = cors_headers;
            headers.push(("Cache-Control", SUCCESS_CACHE_CONTROL.to_string()));
            return Reply::raw_json(cached.status, cached.body, headers);
        }

        if !within_rate_limit(env, request, "RATE_LIMITER").await {
            return Reply::rate_limited(RATE_LIMITER_PERIOD_SECONDS, cors_headers);
        }

        let Some(token) = tmdb_token(env) else {
            log_error(json!({
                "kind": "tmdb_proxy_error",
                "requestId": req_id,
                "route": canonical_path,
                "reason": "token_unavailable",
                "message": "TMDB_API_TOKEN Worker secret is not configured.",
            }));
            return Reply::error(502, "Unable to reach the movie service.", cors_headers);
        };

        let upstream_params = proxy::build_upstream_params(endpoint, safe_params, now as i64);
        let Ok(upstream_url) = proxy::build_tmdb_url(endpoint, movie_id, &upstream_params) else {
            return Reply::error(502, "Unable to reach the movie service.", cors_headers);
        };

        let started_at = now_ms();
        match fetch_tmdb(&upstream_url, &token).await {
            Ok((status, text)) => {
                let parsed: Value = if text.is_empty() {
                    json!({})
                } else {
                    match serde_json::from_str(&text) {
                        Ok(val) => val,
                        Err(err) => {
                            log_error(json!({
                                "kind": "tmdb_proxy_error",
                                "requestId": req_id,
                                "route": canonical_path,
                                "reason": "upstream_failure",
                                "message": err.to_string(),
                            }));
                            return Reply::error(
                                502,
                                "Unable to reach the movie service.",
                                cors_headers,
                            );
                        }
                    }
                };
                let body = serde_json::to_string(&parsed).unwrap_or_else(|_| "{}".to_string());
                let is_success = (200..300).contains(&status);

                if is_success {
                    TMDB_CACHE.with_borrow_mut(|c| {
                        c.set(
                            cache_key,
                            CachedTmdb {
                                status,
                                body: body.clone(),
                            },
                            now_ms(),
                        );
                    });
                }

                log_info(json!({
                    "kind": "tmdb_proxy_request",
                    "source": "worker",
                    "requestId": req_id,
                    "route": canonical_path,
                    "method": "GET",
                    "status": status,
                    "upstreamStatus": status,
                    "cache": "miss",
                    "upstreamLatencyMs": (now_ms() - started_at) as i64,
                }));

                let mut headers = cors_headers;
                if is_success {
                    headers.push(("Cache-Control", SUCCESS_CACHE_CONTROL.to_string()));
                }
                Reply::raw_json(status, body, headers)
            }
            Err(message) => {
                log_error(json!({
                    "kind": "tmdb_proxy_error",
                    "requestId": req_id,
                    "route": canonical_path,
                    "reason": "upstream_failure",
                    "message": message,
                }));
                Reply::error(502, "Unable to reach the movie service.", cors_headers)
            }
        }
    }

    async fn handle_pitch_request(
        env: &Env,
        request: &Request,
        movie_id: u64,
        canonical_path: &str,
        safe_params: &BTreeMap<String, String>,
        cors_headers: Vec<(&'static str, String)>,
        req_id: &str,
    ) -> Reply {
        let Ok(ai) = env.ai("AI") else {
            return Reply::error(503, "Movie pitches are unavailable.", cors_headers);
        };

        let cache_key = proxy::build_cache_key(canonical_path, safe_params);
        let now = now_ms();

        if let Some(cached_body) = PITCH_CACHE.with_borrow_mut(|c| c.get(&cache_key, now)) {
            log_info(json!({
                "kind": "movie_pitch_request",
                "requestId": req_id,
                "route": "/api/movies/:id/pitch",
                "status": 200,
                "cache": "hit",
            }));
            let mut headers = cors_headers;
            headers.push(("Cache-Control", SUCCESS_CACHE_CONTROL.to_string()));
            return Reply::raw_json(200, cached_body, headers);
        }

        if !within_rate_limit(env, request, "RATE_LIMITER").await {
            return Reply::rate_limited(RATE_LIMITER_PERIOD_SECONDS, cors_headers);
        }
        if !within_rate_limit(env, request, "PITCH_RATE_LIMITER").await {
            return Reply::rate_limited(PITCH_RATE_LIMITER_PERIOD_SECONDS, cors_headers);
        }

        let Some(token) = tmdb_token(env) else {
            return Reply::error(502, "Unable to reach the movie service.", cors_headers);
        };

        let upstream_params =
            proxy::build_upstream_params(Endpoint::Pitch, safe_params, now as i64);
        let Ok(upstream_url) =
            proxy::build_tmdb_url(Endpoint::Pitch, Some(movie_id), &upstream_params)
        else {
            return Reply::error(502, "Unable to reach the movie service.", cors_headers);
        };

        let movie: Value = match fetch_tmdb(&upstream_url, &token).await {
            Ok((404, _)) => return Reply::error(404, "Movie not found.", cors_headers),
            Ok((status, text)) if (200..300).contains(&status) => {
                match serde_json::from_str(&text) {
                    Ok(val) => val,
                    Err(err) => {
                        log_error(json!({
                            "kind": "movie_pitch_error",
                            "requestId": req_id,
                            "route": "/api/movies/:id/pitch",
                            "reason": "upstream_failure",
                            "message": err.to_string(),
                        }));
                        return Reply::error(
                            502,
                            "Unable to reach the movie service.",
                            cors_headers,
                        );
                    }
                }
            }
            Ok((status, _)) => {
                log_error(json!({
                    "kind": "movie_pitch_error",
                    "requestId": req_id,
                    "route": "/api/movies/:id/pitch",
                    "reason": "upstream_failure",
                    "message": format!("TMDB responded with status {status}"),
                }));
                return Reply::error(502, "Unable to reach the movie service.", cors_headers);
            }
            Err(message) => {
                log_error(json!({
                    "kind": "movie_pitch_error",
                    "requestId": req_id,
                    "route": "/api/movies/:id/pitch",
                    "reason": "upstream_failure",
                    "message": message,
                }));
                return Reply::error(502, "Unable to reach the movie service.", cors_headers);
            }
        };

        let language = safe_params
            .get("language")
            .map(String::as_str)
            .unwrap_or(DEFAULT_SHARE_LANGUAGE);
        let model = env_var(env, "PITCH_MODEL")
            .map(|m| m.trim().to_string())
            .filter(|m| !m.is_empty())
            .unwrap_or_else(|| DEFAULT_PITCH_MODEL.to_string());

        let ai_request = pitch::build_ai_request(&movie, language);
        let started_at = now_ms();
        let envelope: Value = match ai.run(&model, &ai_request).await {
            Ok(val) => val,
            Err(err) => {
                log_error(json!({
                    "kind": "movie_pitch_error",
                    "requestId": req_id,
                    "route": "/api/movies/:id/pitch",
                    "reason": "generation_failure",
                    "message": err.to_string(),
                }));
                return Reply::error(502, "Unable to generate a pitch right now.", cors_headers);
            }
        };

        let generated = match pitch::parse_workers_ai_envelope(&envelope) {
            Ok(res) => res,
            Err(message) => {
                log_error(json!({
                    "kind": "movie_pitch_error",
                    "requestId": req_id,
                    "route": "/api/movies/:id/pitch",
                    "reason": "generation_failure",
                    "message": message,
                }));
                return Reply::error(502, "Unable to generate a pitch right now.", cors_headers);
            }
        };

        let payload = PitchApiBody {
            id: movie_id,
            pitch: generated.pitch,
            moods: generated.moods,
        };
        let body = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
        PITCH_CACHE.with_borrow_mut(|c| c.set(cache_key, body.clone(), now_ms()));

        log_info(json!({
            "kind": "movie_pitch_request",
            "requestId": req_id,
            "route": "/api/movies/:id/pitch",
            "status": 200,
            "cache": "miss",
            "generationLatencyMs": (now_ms() - started_at) as i64,
        }));

        let mut headers = cors_headers;
        headers.push(("Cache-Control", SUCCESS_CACHE_CONTROL.to_string()));
        Reply::raw_json(200, body, headers)
    }

    async fn handle_share_request(
        env: &Env,
        request: &Request,
        movie_id: u64,
        canonical_path: &str,
        safe_params: &BTreeMap<String, String>,
        share_app_origin: Option<&str>,
        req_id: &str,
    ) -> Reply {
        let Some(app_origin) = share_app_origin else {
            return Reply::error(503, "Share pages are unavailable.", Vec::new());
        };

        let language = safe_params
            .get("lang")
            .map(String::as_str)
            .unwrap_or(DEFAULT_SHARE_LANGUAGE);
        let cache_key = proxy::build_cache_key(canonical_path, safe_params);
        let now = now_ms();

        if let Some(cached_html) = SHARE_CACHE.with_borrow_mut(|c| c.get(&cache_key, now)) {
            log_info(json!({
                "kind": "movie_share_request",
                "requestId": req_id,
                "route": "/share/movie/:id",
                "status": 200,
                "cache": "hit",
            }));
            return html_reply(
                200,
                cached_html,
                vec![("Cache-Control", SUCCESS_CACHE_CONTROL.to_string())],
            );
        }

        if !within_rate_limit(env, request, "RATE_LIMITER").await {
            return Reply::rate_limited(RATE_LIMITER_PERIOD_SECONDS, Vec::new());
        }

        let fallback = |status: u16, redirect_path: &str| {
            html_reply(
                status,
                share::build_fallback_share_page(redirect_path, language, app_origin),
                Vec::new(),
            )
        };

        let Some(token) = tmdb_token(env) else {
            return fallback(502, &format!("/movie/{movie_id}"));
        };

        let upstream_params =
            proxy::build_upstream_params(Endpoint::Share, safe_params, now as i64);
        let Ok(upstream_url) =
            proxy::build_tmdb_url(Endpoint::Share, Some(movie_id), &upstream_params)
        else {
            return fallback(502, &format!("/movie/{movie_id}"));
        };

        let movie: Value = match fetch_tmdb(&upstream_url, &token).await {
            Ok((404, _)) => {
                log_info(json!({
                    "kind": "movie_share_request",
                    "requestId": req_id,
                    "route": "/share/movie/:id",
                    "status": 404,
                    "upstreamStatus": 404,
                    "cache": "miss",
                }));
                return fallback(404, "/");
            }
            Ok((status, text)) if (200..300).contains(&status) => {
                match serde_json::from_str(&text) {
                    Ok(val) => val,
                    Err(err) => {
                        log_error(json!({
                            "kind": "movie_share_error",
                            "requestId": req_id,
                            "route": "/share/movie/:id",
                            "reason": "upstream_failure",
                            "message": err.to_string(),
                        }));
                        return fallback(502, &format!("/movie/{movie_id}"));
                    }
                }
            }
            Ok((status, _)) => {
                log_error(json!({
                    "kind": "movie_share_error",
                    "requestId": req_id,
                    "route": "/share/movie/:id",
                    "reason": "upstream_failure",
                    "message": format!("TMDB responded with status {status}"),
                }));
                return fallback(502, &format!("/movie/{movie_id}"));
            }
            Err(message) => {
                log_error(json!({
                    "kind": "movie_share_error",
                    "requestId": req_id,
                    "route": "/share/movie/:id",
                    "reason": "upstream_failure",
                    "message": message,
                }));
                return fallback(502, &format!("/movie/{movie_id}"));
            }
        };

        let html = share::build_movie_share_page(&movie, movie_id, language, app_origin);
        SHARE_CACHE.with_borrow_mut(|c| c.set(cache_key, html.clone(), now_ms()));
        log_info(json!({
            "kind": "movie_share_request",
            "requestId": req_id,
            "route": "/share/movie/:id",
            "status": 200,
            "cache": "miss",
        }));
        html_reply(
            200,
            html,
            vec![("Cache-Control", SUCCESS_CACHE_CONTROL.to_string())],
        )
    }

    #[event(fetch)]
    async fn fetch(request: Request, env: Env, _ctx: Context) -> Result<Response> {
        let cors_raw = env_var(&env, "CORS_ALLOW_ORIGIN");
        let share_raw = env_var(&env, "SHARE_APP_ORIGIN");

        let cors_allow_origin = match proxy::parse_cors_allow_origin(cors_raw.as_deref()) {
            Ok(origin) => origin,
            Err(message) => {
                log_error(json!({
                    "kind": "tmdb_proxy_error",
                    "reason": "invalid_configuration",
                    "message": message,
                }));
                return to_worker_response(Reply::error(500, "Internal server error.", Vec::new()));
            }
        };

        let share_app_origin = match share::resolve_share_app_origin(
            share_raw.as_deref(),
            cors_allow_origin.as_deref(),
        ) {
            Ok(origin) => origin,
            Err(message) => {
                log_error(json!({
                    "kind": "tmdb_proxy_error",
                    "reason": "invalid_configuration",
                    "message": message,
                }));
                return to_worker_response(Reply::error(500, "Internal server error.", Vec::new()));
            }
        };

        let url_string = request.inner().url();
        let Ok(url) = Url::parse(&url_string) else {
            return to_worker_response(Reply::error(400, "Invalid request URL.", Vec::new()));
        };
        let raw_pathname = proxy::raw_pathname_from_url(&url_string);
        let route_match = proxy::match_route(url.path());
        let cors_headers = if route_match.supported_path() {
            proxy::build_cors_headers(cors_allow_origin.as_deref(), false)
        } else {
            Vec::new()
        };

        if proxy::has_unsafe_path_traversal(raw_pathname) {
            return to_worker_response(Reply::error(400, "Invalid path format.", cors_headers));
        }

        let method = request.method();
        if method == Method::Options {
            if cors_allow_origin.is_some() && route_match.supported_path() {
                let preflight_headers =
                    proxy::build_cors_headers(cors_allow_origin.as_deref(), true);
                return to_worker_response(Reply::empty(204, preflight_headers));
            }
            if route_match.supported_path() {
                return to_worker_response(Reply::error(
                    405,
                    "Only GET requests are supported.",
                    cors_headers,
                ));
            }
            return to_worker_response(Reply::error(404, "Route not found.", Vec::new()));
        }

        if method != Method::Get {
            if route_match.supported_path() {
                return to_worker_response(Reply::error(
                    405,
                    "Only GET requests are supported.",
                    cors_headers,
                ));
            }
            return to_worker_response(Reply::error(404, "Route not found.", Vec::new()));
        }

        let req_id = request_id(&request);
        let req_ctx = ReqCtx {
            env: &env,
            request: &request,
            req_id: &req_id,
        };

        let reply = match route_match {
            RouteMatch::Unknown => Reply::error(404, "Route not found.", Vec::new()),
            RouteMatch::Health => Reply::health(cors_headers),
            RouteMatch::InvalidMovieId => Reply::error(400, "Invalid movie ID.", cors_headers),
            RouteMatch::Share {
                movie_id,
                canonical_path,
            } => match proxy::validate_query_params(&url, Policy::Share) {
                Ok(safe_params) => {
                    handle_share_request(
                        &env,
                        &request,
                        movie_id,
                        &canonical_path,
                        &safe_params,
                        share_app_origin.as_deref(),
                        &req_id,
                    )
                    .await
                }
                Err(message) => Reply::error(400, &message, cors_headers),
            },
            RouteMatch::Pitch {
                movie_id,
                canonical_path,
            } => match proxy::validate_query_params(&url, Policy::Common) {
                Ok(safe_params) => {
                    handle_pitch_request(
                        &env,
                        &request,
                        movie_id,
                        &canonical_path,
                        &safe_params,
                        cors_headers,
                        &req_id,
                    )
                    .await
                }
                Err(message) => Reply::error(400, &message, cors_headers),
            },
            RouteMatch::Tmdb {
                endpoint,
                movie_id,
                canonical_path,
            } => match proxy::validate_query_params(&url, endpoint.policy()) {
                Ok(safe_params) => {
                    handle_tmdb_request(
                        &req_ctx,
                        endpoint,
                        movie_id,
                        &canonical_path,
                        &safe_params,
                        cors_headers,
                    )
                    .await
                }
                Err(message) => Reply::error(400, &message, cors_headers),
            },
        };

        to_worker_response(reply)
    }
}
