## Demo

https://github.com/user-attachments/assets/3291d081-16f4-450a-842d-8a4633ec1944

# GitHub Release Notificator

A Node.js + Express service that lets users subscribe to GitHub repository releases and receive email notifications.

## Features

- Subscribe with `email + owner/repo`
- Email confirmation by opening a confirmation link
- Unsubscribe by token (confirmed subscriptions only)
- Periodic release scanner (cron)
- PostgreSQL persistence
- Redis cache for GitHub API responses (TTL 10 minutes)
- Email delivery via Resend API (recommended) with SMTP fallback support
- Prometheus-compatible metrics endpoint: `/metrics` (basic service metrics)
- Unit and integration tests with Jest

## Hosted App (Render)

Production deployment:

- https://notificator-rxb1.onrender.com/

Notes:

- The app is hosted on Render.
- API key protection can be enabled/disabled via `API_KEY` environment variable.
- If `API_KEY` is set, API requests must include `X-API-Key`.

## Current Demo Limitations

- Email sending is currently in test mode because no custom verified sending domain is configured.
- In this mode, subscribe/unsubscribe email flow is effectively limited to the verified test inbox: `olegchaplia2006@gmail.com`.
- To support subscriptions for any user email, a verified domain must be added in Resend and used in `RESEND_FROM`.
- The Render free tier can put the service to sleep when idle.
- Because of this, the first request after inactivity may take extra time while the service wakes up.

## Tech Stack

- Node.js
- Express
- PostgreSQL
- Redis
- Axios
- Nodemailer
- Resend API
- Jest + Supertest

## Prerequisites

Install the following before starting:

- Node.js 18+ (LTS recommended)
- npm 9+
- Docker Desktop (optional, but recommended for local PostgreSQL)

## 1. Clone and Install

```bash
git clone https://github.com/oleg191006/release-watcher.git
cd release-watcher
npm install
```

## 2. Create Environment File

Create a `.env` file in the project root:

```env
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Optional API key auth (leave empty to disable)
API_KEY=

# Database (local Postgres)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=notificator
DB_USER=postgres
DB_PASSWORD=postgres

# GitHub API token (optional, but recommended to reduce rate-limit issues)
GITHUB_TOKEN=

# Redis cache (optional but recommended)
REDIS_URL=redis://localhost:6379
REDIS_CONNECT_TIMEOUT_MS=5000
GITHUB_CACHE_TTL_SECONDS=600

# Email (recommended: Resend)
RESEND_API_KEY=
RESEND_FROM=Notificator <onboarding@resend.dev>
RESEND_TIMEOUT_MS=10000

# SMTP fallback (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REJECT_UNAUTHORIZED=true
SMTP_CONNECTION_TIMEOUT_MS=10000
SMTP_GREETING_TIMEOUT_MS=10000
SMTP_SOCKET_TIMEOUT_MS=15000
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=GitHub Notificator <noreply@notificator.app>

# Scanner schedule (every 10 minutes)
SCAN_CRON=*/10 * * * *
```

Notes:

- If `API_KEY` is empty, API key middleware is disabled.
- For local/dev and cloud deployment, `RESEND_API_KEY` is the recommended email path.
- `RESEND_FROM` must be a sender accepted by your Resend account.

## 3. Start PostgreSQL

### Option A: Docker (recommended)

```bash
docker compose up -d db redis
```

This starts PostgreSQL on `localhost:5432` with:

- database: `notificator`
- user: `postgres`
- password: `postgres`

### Option B: Existing local Postgres

Use your own DB and update `.env` (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) accordingly.

## 4. Run the App

Development mode:

```bash
npm run dev
```

Production-like mode:

```bash
npm start
```

Server should be available at:

- `http://localhost:3000`
- Health check: `http://localhost:3000/health`
- Metrics: `http://localhost:3000/metrics`

## 5. Database Migrations

No manual migration command is required.

Migrations run automatically on startup in `src/server.js`.

## 6. Test the API Quickly

### Browser UI

Open:

`http://localhost:3000`

### Postman

Import collection:

`postman/GitHub_Release_Notificator.postman_collection.json`

Recommended variable setup:

- `baseUrl = http://localhost:3000`
- `apiKey =` (empty unless API key is enabled)
- `email = your test email`
- `repo = nodejs/node` (or another public repo)

### Subscription Flow (Current Behavior)

1. User subscribes with email + repo.
2. Service sends an email with a confirmation link.
3. The same confirmation email also contains an unsubscribe token.
4. Subscription remains `Pending` until the user opens the confirmation link.
5. User confirms by opening the link in a browser.
6. Confirmation page is shown in browser.
7. Only confirmed subscriptions can be unsubscribed.
8. Unsubscribe is done by providing the token in the app form or API call.

## 7. Run Tests

Unit/integration test run:

```bash
npm run test:unit
```

Coverage run:

```bash
npm test
```

## Project Scripts

- `npm run dev` - start server with nodemon
- `npm start` - start server in normal mode
- `npm run lint` - run ESLint
- `npm run lint:fix` - auto-fix lint issues
- `npm run test:unit` - run tests once
- `npm test` - run tests with coverage
