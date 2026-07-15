# System Design: GitHub Release Notificator

## 1. Overview

GitHub Release Notificator is a web service that allows users to subscribe to GitHub repository release events and receive email notifications when a new release is published. The service handles the full subscription lifecycle: opt-in via email confirmation, periodic release scanning, notification delivery, and unsubscription.

---

## 2. Goals

- Allow any user to subscribe to releases of any public GitHub repository using only their email address.
- Confirm subscriptions via email to prevent spam and unauthorized sign-ups.
- Detect new GitHub releases with minimal delay (configurable polling interval).
- Deliver release notifications reliably with at least one fallback delivery mechanism.
- Keep GitHub API usage within rate limits.
- Provide basic observability.

## 3. Non-Goals

- Real-time delivery via webhooks (GitHub webhooks require ownership of the repository).
- Supporting GitHub private repositories.
- Mobile push notifications.
- Managing GitHub releases (read-only integration).

---

## 4. Architecture

### 4.1 High-Level Components

```
Browser / API Client
        │
        ▼
  Express HTTP Server  ─── /health, /metrics
        │
        ├── POST /api/subscriptions        (subscribe)
        ├── GET  /api/confirm/:token       (confirm)
        └── DELETE /api/subscriptions/:token (unsubscribe)
        │
        ├── subscriptionService
        │       ├── subscriptionRepository  ──► PostgreSQL
        │       ├── gitHubService           ──► Redis Cache ──► GitHub REST API
        │       └── emailService            ──► Resend API / SMTP
        │
        └── scannerService (node-cron)
                ├── gitHubService
                ├── repoRepository          ──► PostgreSQL
                ├── subscriptionRepository
                └── emailService
```

### 4.2 Data Flow: Subscribe

1. Client sends `POST /api/subscriptions` with `{ email, repo }`.
2. `SubscriptionService` validates input, checks for duplicates in PostgreSQL.
3. `GitHubService` verifies the repository exists (cached in Redis, TTL 10 min).
4. Service fetches the latest release tag (also cached) to record the starting point.
5. A new subscription row is inserted with `confirmed = false` and two UUID tokens.
6. A confirmation email is sent (Resend API preferred, SMTP fallback).
7. If email delivery fails, the subscription row is rolled back.

### 4.3 Data Flow: Release Scanning

1. `ScannerService` runs on a cron schedule (default: every 10 minutes).
2. It fetches all distinct repos with at least one confirmed subscription.
3. For each repo, it calls `GitHubService.getLatestRelease()` (cached).
4. If a new tag is detected compared to `repo_releases.last_seen_tag`, notifications are sent to all confirmed subscribers whose `last_seen_tag` differs.
5. Each subscriber's `last_seen_tag` is updated after a successful notification.

---

## 5. Data Model

### `subscriptions`

| Column              | Type      | Notes                                        |
| ------------------- | --------- | -------------------------------------------- |
| `id`                | SERIAL PK |                                              |
| `email`             | VARCHAR   | Normalized to lowercase                      |
| `repo`              | VARCHAR   | Format: `owner/repo`                         |
| `confirm_token`     | UUID      | Single-use token for email confirmation      |
| `unsubscribe_token` | UUID      | Stable token for one-click unsubscription    |
| `confirmed`         | BOOLEAN   | `false` until user clicks confirmation link  |
| `last_seen_tag`     | VARCHAR   | Last release tag the subscriber was notified |
| `created_at`        | TIMESTAMP |                                              |

Unique constraint: `(email, repo)`.

### `repo_releases`

| Column          | Type      | Notes                                   |
| --------------- | --------- | --------------------------------------- |
| `id`            | SERIAL PK |                                         |
| `repo`          | VARCHAR   | Unique                                  |
| `last_seen_tag` | VARCHAR   | Latest release tag known to the scanner |
| `updated_at`    | TIMESTAMP |                                         |

---

## 6. External Integrations

### GitHub REST API

- Endpoints used: `GET /repos/{owner}/{repo}`, `GET /repos/{owner}/{repo}/releases/latest`.
- Authentication: optional Bearer token to increase rate limit (5000 req/h authenticated vs 60 req/h unauthenticated).
- Rate limiting handled with exponential-like retry: on HTTP 429, the service reads the `Retry-After` header and waits accordingly (up to 3 retries).
- All responses cached in Redis with a configurable TTL (default: 600 seconds).

### Email Delivery

Two drivers are supported (see [ADR-002](adrs/ADR-002-email-delivery-strategy.md)):

| Driver          | When used                              | Config vars                           |
| --------------- | -------------------------------------- | ------------------------------------- |
| Resend API      | Primary — when `RESEND_API_KEY` is set | `RESEND_API_KEY`, `RESEND_FROM`       |
| Nodemailer SMTP | Fallback — when Resend key is absent   | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` |

---

## 7. API Reference

All `/api` routes are optionally protected by an API key (`X-API-Key` header) when `API_KEY` env var is set.

| Method | Path                                | Description                             |
| ------ | ----------------------------------- | --------------------------------------- |
| POST   | `/api/subscriptions`                | Create a new (unconfirmed) subscription |
| GET    | `/api/subscriptions/confirm/:token` | Confirm subscription by token           |
| DELETE | `/api/subscriptions/:token`         | Unsubscribe by token                    |
| GET    | `/health`                           | Health check (public)                   |
| GET    | `/metrics`                          | Prometheus metrics (public)             |

---

## 8. Configuration

All configuration is provided via environment variables. Key variables:

| Variable                   | Default                 | Description                           |
| -------------------------- | ----------------------- | ------------------------------------- |
| `PORT`                     | `3000`                  | HTTP server port                      |
| `APP_URL`                  | `http://localhost:3000` | Base URL used in confirmation emails  |
| `API_KEY`                  | _(empty)_               | If set, requires `X-API-Key` header   |
| `DATABASE_URL`             | _(empty)_               | Full PostgreSQL connection string     |
| `GITHUB_TOKEN`             | _(empty)_               | GitHub personal access token          |
| `REDIS_URL`                | _(empty)_               | Redis connection URL                  |
| `GITHUB_CACHE_TTL_SECONDS` | `600`                   | GitHub API response TTL in Redis      |
| `RESEND_API_KEY`           | _(empty)_               | Resend API key (primary email driver) |
| `SCAN_CRON`                | `*/10 * * * *`          | Cron expression for release scanner   |

---

## 9. Observability

- **Logging:** Winston with JSON output. Log level controlled by `NODE_ENV`.
- **Metrics:** `prom-client` exposes Prometheus-compatible metrics at `GET /metrics`. Includes default Node.js process metrics.
- **Health:** `GET /health` returns `{ status: "ok", timestamp }`. Used by Render's health check.

---

## 10. Deployment

The service is containerized (see `Dockerfile`) and deployable via:

- **Docker Compose** (local): `docker-compose.yml` includes the app, PostgreSQL, and Redis.
- **Render** (production): `render.yaml` defines the web service with linked PostgreSQL and Redis add-ons.

Database migrations run automatically on application startup via `src/db/migrations.js`.

---

## 11. Testing Strategy

- **Unit tests** (`tests/unit/`): Cover service logic, validators, and middleware in isolation using Jest mocks.
- **Integration tests** (`tests/integration/`): Use Supertest to exercise full HTTP request/response cycles against an in-process Express app.
- **Coverage:** Collected via `jest --coverage`.

---

## 12. Known Limitations & Future Work

| Limitation                                                                | Potential improvement                                           |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Polling every 10 min introduces latency                                   | Support GitHub webhooks for repos the owner controls            |
| No de-duplication guard across scanner restarts if multiple instances run | Distributed lock via Redis (e.g., Redlock)                      |
| Email sending is sequential per subscriber                                | Batch/queue-based delivery (e.g., Bull + Redis)                 |
| No retry queue for failed notification emails                             | Persist failed notifications and retry with exponential backoff |
