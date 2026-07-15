const config = require('@/config');
const logger = require('@/utils/logger');
const {getRedisConnection:createRedisConnection} = require('../../../shared/redisConnection');

function getRedisConnection() {
    const connection = createRedisConnection(config.redis.url);
    if (!connection) {
        logger.warn('Message broker: REDIS_URL not set, queue publishing disabled');
        return null;
    }
    return connection;
}

module.exports = { getRedisConnection };
