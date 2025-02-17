# Cinema Club

> React Native (Expo) Movie App

[![GitHub version](https://badge.fury.io/gh/josersi%2Fcinemaclub.svg)](https://badge.fury.io/gh/josersi%2Fcinemaclub)

This is a React Native application based on Expo using the [TMDB api](https://www.themoviedb.org/).

<img src="showcase/screenshot_01.png" width="195" /><img src="showcase/screenshot_02.png" width="195" /><img src="showcase/screenshot_03.png" width="195" />

## Installation

Yarn:

```sh
yarn
```

NPM:

```sh
npm install
```

Go to **src/api/tmdb** and create the file **conf.json**

```json
{
  "authToken": "<your_api_token_goes_here"
}
```

## Dev

Yarn:

```sh
yarn start
```

NPM:

```sh
npm start
```

## Milestones

- [x] Start Page.
- [x] Movies Search Page
- [x] Movie Details Page
- [x] Splash Screen
- [ ] TMDB Authentication
- [ ] Favorites Page
- [ ] User lists
- [ ] App Modularization
- [ ] i18n
- [ ] Tests (:D)
- [ ] ... what more?

## Release History

- beta01
  - Work in progress

## Meta

José Rodrigo– [@kaomi_jose](https://twitter.com/kaomi_jose) – jose.rodrigo@kaomidev.tech

Distributed under the MIT license. See `LICENSE` for more information.

## Contributing

1. Fork it (<https://github.com/josersi/cinemaclub/fork>)
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -am 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Create a new Pull Request
