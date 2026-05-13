const Redis = require('ioredis');
const config = require('@/config');
const logger = require('@/utils/logger');

let redisClient = null;
let connectPromise = null;
let disabled = !config.redis.url;

function createClient() {
    return new Redis(config.redis.url, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: config.redis.connectTimeoutMs,
    });
}

async function getClient() {
    if (disabled) {
        return null;
    }

    if (!redisClient) {
        redisClient = createClient();
    }

    if (redisClient.status === 'ready') {
        return redisClient;
    }

    if (!connectPromise) {
        connectPromise = redisClient.connect()
            .catch((err) => {
                logger.warn('Redis cache disabled: failed to connect.', { message: err.message });
                disabled = true;
                if (redisClient) {
                    redisClient.disconnect();
                    redisClient = null;
                }
                return null;
            })
            .finally(() => {
                connectPromise = null;
            });
    }

    await connectPromise;
    return redisClient && redisClient.status === 'ready' ? redisClient : null;
}

async function getJson(key) {
    const client = await getClient();
    if (!client) {
        return undefined;
    }

    try {
        const raw = await client.get(key);
        if (raw === null) {
            return undefined;
        }

        return JSON.parse(raw);
    } catch (err) {
        logger.warn('Redis cache read failed. Continuing without cache.', { key, message: err.message });
        return undefined;
    }
}

async function setJson(key, value, ttlSeconds) {
    const client = await getClient();
    if (!client) {
        return;
    }

    try {
        await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
        logger.warn('Redis cache write failed. Continuing without cache.', { key, message: err.message });
    }
}

module.exports = {
    getJson,
    setJson,
};
