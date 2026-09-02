# AGENTS

Quick guidance for contributors/agents.

## Quick start

```sh
npm install
npm run api
npm start
npm run build:web
```

## Tests

```sh
npm run test
npm run test:e2e:stub
npm run test:e2e:live
```

## Refresh README screenshots (live mobile)

```sh
npm run build:web
npm run test:e2e:live -- tests/e2e/readme-screenshots.live.spec.ts
```

## Conventions

- Update `showcase/screenshot_01.png`, `showcase/screenshot_02.png`, and `showcase/screenshot_03.png` using Playwright capture only (no manual image edits).
- Keep the movie-details sample payload in `tests/e2e/fixtures/movie-details.example.json` as the canonical example for docs/tests.
