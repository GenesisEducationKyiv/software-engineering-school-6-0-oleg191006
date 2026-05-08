# ADR-001: Use PostgreSQL as the Primary Data Store

## Context

The service needs to persist subscription records (email, repo, tokens, confirmation state, last-seen release tag) and per-repository release state. The data is relational: a subscription belongs to a specific (email, repo) pair, and a repo-release record tracks one canonical latest tag per repository.

Key requirements:

- Strong consistency for subscription state (double-subscribe prevention, confirmed flag, token lookup).
- ACID transactions — when a subscription is rolled back after email send failure, the delete must be atomic.
- Unique-constraint enforcement at the database level (`email + repo`).
- Simple joins (e.g., confirmed subscriptions for a given repo).
- Available as a managed service on the target hosting platform (Render).

## Decision

Use **PostgreSQL** as the sole persistent data store.

## Considered Alternatives

| Option              | Reason rejected                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SQLite**          | Not suitable for multi-process/container deployments and no managed cloud offering on Render.                                                                 |
| **MongoDB**         | Document model adds no value for this relational data and would require manual unique-index management and lacks built-in ACID transactions across documents. |
| **MySQL / MariaDB** | Viable, but PostgreSQL is preferred for its richer feature set, better JSONB support, and first-class Render add-on availability.                             |

## Consequences

**Positive:**

- ACID guarantees simplify rollback logic in `SubscriptionService.subscribe()`.
- Unique constraint `(email, repo)` is enforced at the DB level — no race-condition double-subscribe.
- `pg` (node-postgres) is a mature, well-supported driver with connection pooling.
- Render provides a managed PostgreSQL add-on with automatic backups and SSL.

**Negative:**

- Requires a running PostgreSQL instance for local development (mitigated by the provided `docker-compose.yml`).
- Schema migrations must be managed manually (currently handled by `src/db/migrations.js` on startup).

## Notes

The connection string supports both individual environment variables (`DB_HOST`, `DB_PORT`, etc.) and a single `DATABASE_URL` for cloud deployments. SSL is automatically enabled when `DATABASE_URL` is present.
