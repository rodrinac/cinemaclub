# Cinema Club 🎬✨

> A cozy React Native (Expo) movie app with web support, powered by TMDB.

[![GitHub version](https://badge.fury.io/gh/rodrinac%2Fcinemaclub.svg)](https://badge.fury.io/gh/rodrinac%2Fcinemaclub)

Cinema Club keeps movie discovery fun and clean across web + mobile, while routing all TMDB access through a local API layer.

## App peek (live mobile captures)

<img src="showcase/screenshot_01.png" width="195" alt="Discover screen" /><img src="showcase/screenshot_02.png" width="195" alt="Search screen" /><img src="showcase/screenshot_03.png" width="195" alt="Movie detail screen" />

## Installation

```sh
npm install
```

## Development

```sh
# 1) Copy .env.template to .env and set TMDB_API_TOKEN
npm run api

# 2) In a second terminal, run Expo (web / iOS / Android)
npm start
```

The Expo app talks only to the Movies API proxy. The TMDB bearer token is read by that API from `.env` locally or Secrets Manager in AWS, and it never gets embedded in the client app. On a physical device, set `EXPO_PUBLIC_MOVIES_API_URL` to your machine's LAN address, for example `http://192.168.1.10:3001/api`.

The local API defaults to **no CORS headers** and **no in-memory rate limiting**. If you want to exercise the web app from a different origin locally, set `CORS_ALLOW_ORIGIN` to that exact origin before starting `npm run api`.

## Movies API

`npm run api` starts a small read-only API on port `3001`. The AWS deployment uses API Gateway REST API -> Node.js Lambda -> TMDB and keeps the same `/api` contract by setting `EXPO_PUBLIC_MOVIES_API_URL` to `<stage invoke url>/api`.

- `GET /health`
- `GET /api/movies/now-playing`, `/api/movies/popular`, `/api/movies/upcoming`
- `GET /api/movies/:id`
- `GET /api/search/movies?query=...`
- `GET /api/genres`
- compatibility aliases: `/api/movie/*`, `/api/search/movie`, `/api/genre/movie/list`

### Example movie details response

Sample payload: `tests/e2e/fixtures/movie-details.example.json`

## Testing

```sh
npm run test
node --test tests/tmdb-lambda.test.mjs
npm run test:e2e:stub
npm run test:e2e:live
```

## Milestones

- [x] Start Page
- [x] Movies Search Page
- [x] Movie Details Page
- [x] Splash Screen
- [ ] TMDB Authentication
- [ ] Favorites Page
- [ ] User lists
- [ ] i18n
- [ ] Tests (:D)
- [ ] ...what more?

## Release History

- beta01
  - Work in progress

## Spider-Man universe banners

Banner visual references/inspirations used for this project:

- [Spider-Man: Into the Spider-Verse – Official posters (TMDB)](https://www.themoviedb.org/movie/324857-spider-man-into-the-spider-verse/images/posters)
- [Spider-Man: Across the Spider-Verse – Official posters (TMDB)](https://www.themoviedb.org/movie/569094-spider-man-across-the-spider-verse/images/posters)
- [Spider-Man: Beyond the Spider-Verse – Title/brand references (Sony Pictures)](https://www.sonypictures.com/movies/spidermanbeyondthespiderverse)

## Meta

José Inácio – [👨‍💻 @josersinacio](https://www.linkedin.com/in/josersinacio/)

Distributed under the MIT license. See `LICENSE` for more information.

## Contributing

1. Fork it (<https://github.com/rodrinac/cinemaclub/fork>)
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -am 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Create a new Pull Request
