require('dotenv').config();

const config = require('./config');
const logger = require('./logger');
const createApp = require('./app');
const { startConsumer } = require('./consumers/notificationConsumer');
const { getRedisConnection } = require('../../../shared/redisConnection');

async function main() {
    try {
        const app = createApp();

        const server = app.listen(config.port, () => {
            logger.info(`Notification service listening on port ${config.port} (${config.nodeEnv})`);
        });

        let worker = null;
        const redisConnection = getRedisConnection(config.redis.url);

        if (redisConnection) {
            worker = startConsumer(redisConnection);
            logger.info('Message broker consumer started');
        } else {
            logger.warn('REDIS_URL not set — running in HTTP-only mode (no queue consumer)');
        }

        const shutdown = async (signal) => {
            logger.info(`Received ${signal}. Shutting down...`);

            if (worker) {
                await worker.close();
                logger.info('Notification consumer stopped');
            }

            server.close(() => {
                logger.info('Notification service shut down');
                process.exit(0);
            });

            setTimeout(() => {
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (err) {
        logger.error('Failed to start notification service', err);
        process.exit(1);
    }
}

main();
