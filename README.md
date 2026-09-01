# Cinema Club

> React Native (Expo) Movie App

[![GitHub version](https://badge.fury.io/gh/rodrinac%2Fcinemaclub.svg)](https://badge.fury.io/gh/rodrinac%2Fcinemaclub)

This is a React Native application based on Expo, with web support, using the [TMDB api](https://www.themoviedb.org/).

<img src="showcase/screenshot_01.png" width="195" /><img src="showcase/screenshot_02.png" width="195" /><img src="showcase/screenshot_03.png" width="195" />

## Installation

```sh
npm install
```

## Dev

```sh
# Copy .env.template to .env and set TMDB_API_TOKEN first.
npm run api

# In a second terminal, start Expo and choose web, iOS, or Android.
npm start
```

The Expo app communicates only with the local Movies API; the TMDB bearer token is read by that API from `.env` and is never embedded in the app. On a physical device, set `EXPO_PUBLIC_MOVIES_API_URL` to your computer's LAN address, for example `http://192.168.1.10:3001/api`.

## Movies API

`npm run api` starts a small read-only API on port `3001`.

- `GET /health`
- `GET /api/movies/now-playing`, `/api/movies/popular`, `/api/movies/upcoming`
- `GET /api/movies/:id`
- `GET /api/search/movies?query=...`
- `GET /api/genres`

## Milestones

- [x] Start Page.
- [x] Movies Search Page
- [x] Movie Details Page
- [x] Splash Screen
- [ ] TMDB Authentication
- [ ] Favorites Page
- [ ] User lists
- [ ] i18n
- [ ] Tests (:D)
- [ ] ... what more?

## Release History

- beta01
  - Work in progress

## Meta

José Inácio – [👨‍💻 @josersinacio](https://www.linkedin.com/in/josersinacio/) – jose.rs.inacio@gmail.com

Distributed under the MIT license. See `LICENSE` for more information.

## Contributing

1. Fork it (<https://github.com/rodrinac/cinemaclub/fork>)
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -am 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Create a new Pull Request
