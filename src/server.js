require('dotenv').config();

const config = require('./config');
const logger = require('./utils/logger');
const createApp = require('./app');
const { runMigrations } = require('./db/migrations');
const { close: closeDb } = require('./db/connection');
const scanner = require('./modules/scanner/scannerService');
const scheduler = require('./infrastructure/scheduler');
const eventPublisher = require('./infrastructure/messageBroker/eventPublisher');

async function main() {
    try {
        logger.info('Running database migrations...');
        await runMigrations();

        const app = createApp();

        const server = app.listen(config.port, () => {
            logger.info(`Server listening on port ${config.port} (${config.nodeEnv})`);
        });

        scheduler.start(() => scanner.scanForNewReleases());

        const shutdown = async (signal) => {
            logger.info(`Received ${signal}. Shutting down gracefully...`);
            scheduler.stop();
            server.close(async () => {
                await eventPublisher.close();
                await closeDb();
                logger.info('Server shut down');
                process.exit(0);
            });

            setTimeout(() => {
                logger.error('Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (err) {
        logger.error('Failed to start application', {
            error: err.stack || err.message,
        });
        process.exit(1);
    }
}

main();
