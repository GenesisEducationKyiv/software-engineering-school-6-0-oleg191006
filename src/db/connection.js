const { Pool } = require('pg');
const config = require('@/config');
const logger = require('@/utils/logger');

let pool;

function getPool() {
    if (!pool) {
        const poolConfig = config.db.connectionString
            ? {
                connectionString: config.db.connectionString,
                ssl: config.db.ssl,
            }
            : {
                host: config.db.host,
                port: config.db.port,
                database: config.db.database,
                user: config.db.user,
                password: config.db.password,
                ssl: config.db.ssl,
            };

        pool = new Pool({
            ...poolConfig,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err) => {
            logger.error('Unexpected error on idle database client', err);
        });
    }
    return pool;
}

async function query(text, params) {
    const p = getPool();
    return p.query(text, params);
}

async function close() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

module.exports = { getPool, query, close };
