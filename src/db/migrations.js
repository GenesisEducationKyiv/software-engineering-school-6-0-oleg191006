const { query } = require('@/db/connection');
const logger = require('@/utils/logger');

const migrations = [
    {
        version: 1,
        description: 'Create subscriptions table',
        sql: `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id              SERIAL PRIMARY KEY,
        email           VARCHAR(320)  NOT NULL,
        repo            VARCHAR(255)  NOT NULL,
        confirmed       BOOLEAN       NOT NULL DEFAULT FALSE,
        confirm_token   VARCHAR(64)   NOT NULL,
        unsubscribe_token VARCHAR(64) NOT NULL,
        last_seen_tag   VARCHAR(255),
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

        CONSTRAINT uq_email_repo UNIQUE (email, repo)
      );

      CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions (email);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_confirmed ON subscriptions (confirmed);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_confirm_token ON subscriptions (confirm_token);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_unsubscribe_token ON subscriptions (unsubscribe_token);
    `,
    },
    {
        version: 2,
        description: 'Create repositories cache table',
        sql: `
      CREATE TABLE IF NOT EXISTS repositories (
        id              SERIAL PRIMARY KEY,
        repo            VARCHAR(255) NOT NULL UNIQUE,
        last_seen_tag   VARCHAR(255),
        last_checked_at TIMESTAMPTZ,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `,
    },
    {
        version: 3,
        description: 'Create saga execution log tables',
        sql: `
      CREATE TABLE IF NOT EXISTS saga_executions (
        id          SERIAL PRIMARY KEY,
        saga_id     UUID            NOT NULL,
        saga_name   VARCHAR(128)    NOT NULL,
        status      VARCHAR(32)     NOT NULL,
        context     JSONB,
        error       TEXT,
        created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_saga_executions_saga_id ON saga_executions (saga_id);
      CREATE INDEX IF NOT EXISTS idx_saga_executions_status ON saga_executions (status);

      CREATE TABLE IF NOT EXISTS saga_step_events (
        id          SERIAL PRIMARY KEY,
        saga_id     UUID            NOT NULL,
        step_name   VARCHAR(128)    NOT NULL,
        status      VARCHAR(32)     NOT NULL,
        error       TEXT,
        created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_saga_step_events_saga_id ON saga_step_events (saga_id);
    `,
    },
];

async function runMigrations() {
    await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version     INTEGER PRIMARY KEY,
      description TEXT,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

    const { rows } = await query('SELECT version FROM _migrations ORDER BY version');
    const applied = new Set(rows.map((r) => r.version));

    for (const migration of migrations) {
        if (applied.has(migration.version)) {
            logger.debug(`Migration v${migration.version} already applied — skipping`);
            continue;
        }

        logger.info(`Applying migration v${migration.version}: ${migration.description}`);
        await query('BEGIN');
        try {
            await query(migration.sql);
            await query(
                'INSERT INTO _migrations (version, description) VALUES ($1, $2)',
                [migration.version, migration.description],
            );
            await query('COMMIT');
            logger.info(`Migration v${migration.version} applied successfully`);
        } catch (err) {
            await query('ROLLBACK');
            logger.error(`Migration v${migration.version} failed`, err);
            throw err;
        }
    }

    logger.info('All database migrations are up to date');
}

module.exports = { runMigrations };
