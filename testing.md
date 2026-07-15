# Testing Guide

This project ships three test suites: unit, integration (API + real DB/Redis), and E2E (Playwright).

## One command for all tests

```bash
npm run test:all
```

## Run each suite separately

Unit tests (no Docker):

```bash
npm run test:unit
```

Integration tests (starts Postgres + Redis in Docker):

```bash
npm run test:integration
```

E2E tests (starts Postgres + Redis in Docker, runs the app, then Playwright):

```bash
npm run test:e2e
```

## Playwright setup

The first time you run E2E tests, install browsers:

```bash
npx playwright install --with-deps
```
