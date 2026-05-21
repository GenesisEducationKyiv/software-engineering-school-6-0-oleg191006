const cron = require('node-cron');
const config = require('@/config');
const logger = require('@/utils/logger');


let cronTask = null;
function start(taskFn) {
    if (cronTask) {
        logger.warn('Scheduler: already running');
        return;
    }

    const expression = config.scanner.cron;
    logger.info(`Scheduler: scheduling with cron expression "${expression}"`);

    cronTask = cron.schedule(expression, () => {
        taskFn().catch((err) => {
            logger.error('Scheduler: unhandled error during scan', err);
        });
    });

    logger.info('Scheduler: started');
}

function stop() {
    if (cronTask) {
        cronTask.stop();
        cronTask = null;
        logger.info('Scheduler: stopped');
    }
}

module.exports = { start, stop };