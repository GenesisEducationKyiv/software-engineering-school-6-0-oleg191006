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

https://notificator-production-c9bd.up.railway.app/

Notes:

- The app is hosted on Railway.
- API key protection can be enabled/disabled via `API_KEY` environment variable.
- If `API_KEY` is set, API requests must include `X-API-Key`.

## Current Demo Limitations

- Email sending is currently in test mode because no custom verified sending domain is configured.
- In this mode, subscribe/unsubscribe email flow is effectively limited to the verified test inbox: `olegchaplia2006@gmail.com`.
- To support subscriptions for any user email, a verified domain must be added in Resend and used in `RESEND_FROM`.

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
- `npm run buf:lint` - lint `.proto` files with buf
- `npm run buf:generate` - generate JS code from `.proto` files

## gRPC Implementation

### Overview

The inter-service communication between the **Main App** and the **Notification Service** has been extended with gRPC alongside the existing REST API.

### Contract (`.proto`)

The gRPC contract is defined in `proto/notification/v1/notification.proto` with two Unary RPCs:

| RPC | Description |
|-----|-------------|
| `SendConfirmation` | Sends a subscription confirmation email |
| `SendReleaseNotification` | Sends a release notification email |

### Fallback Chain

The notification client uses a three-tier fallback:

1. **BullMQ Queue** (async, preferred) - via Redis
2. **gRPC** (sync, new) - HTTP/2 + Protobuf to notification service
3. **REST** (sync, old) - HTTP/1.1 + JSON to notification service

### Configuration

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `GRPC_PORT` | Notification | `50051` | gRPC server port |
| `NOTIFICATION_GRPC_URL` | Main App | `localhost:50051` | gRPC target address |

### Throughput Benchmark: gRPC vs REST

Benchmark measured locally with `autocannon` (REST) and parallel gRPC clients.  
Each level runs for **10 seconds**, endpoint: stub `SendConfirmation` with no real email sending.

```
node scripts/benchmark-grpc-vs-rest.js
```

#### Results

| Connections | Protocol | Req/sec | Lat avg | Lat p50 | Lat p99 | Errors |
|-------------|----------|--------:|--------:|--------:|--------:|-------:|
| **10** | REST (HTTP/1.1) | 3 732 | 2.23 ms | 2 ms | 7 ms | 0 |
| **10** | gRPC (HTTP/2) | 956 | 10.46 ms | 11.56 ms | 31.99 ms | 0 |
| **100** | REST (HTTP/1.1) | 1 070 | 94.4 ms | 93 ms | 129 ms | 0 |
| **100** | gRPC (HTTP/2) | 748 | 133.44 ms | 128.98 ms | 290.88 ms | 0 |
| **1 000** | REST (HTTP/1.1) | 1 095 | 3 303 ms | 3 167 ms | 8 918 ms | **9 984**  |
| **1 000** | gRPC (HTTP/2) | 815 | 1 190 ms | 1 157 ms | 2 077 ms | **0**  |

#### Analysis of results

**With 10 connections** REST is faster (~3.9x): gRPC has higher overhead for connection initialization (HTTP/2 handshake), which is noticeable under low load.

**With 100 connections** the difference shrinks significantly (REST 1070 vs gRPC 748 rps) as HTTP/2 multiplexing starts to offset the overhead.

**With 1000 connections** the most important result:

- **REST** received **9,984 errors** (`ECONNRESET` / connection dropped) - HTTP/1.1 cannot handle such a number of simultaneous connections, the server starts dropping them
- **gRPC** worked **without a single error** - HTTP/2 multiplexes all 1000 clients over fewer physical connections, without overloading the server

Average latency at 1000 connections: REST 3,303 ms vs. gRPC 1,190 ms - gRPC is 2.8x better in latency.
