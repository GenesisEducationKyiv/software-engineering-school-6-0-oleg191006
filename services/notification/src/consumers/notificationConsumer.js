const { Worker } = require('bullmq');
const { NOTIFICATION_QUEUE, EventTypes } = require('./eventTypes');
const emailService = require('../services/emailService');
const logger = require('../logger');

async function processJob(job) {
    logger.info(`Processing job ${job.id} [${job.name}]`, { data: job.data });

    switch (job.name) {
    case EventTypes.SEND_CONFIRMATION_EMAIL: {
        const { to, repo, confirmUrl, unsubscribeToken } = job.data;
        if (!to || !repo || !confirmUrl) {
            throw new Error('Missing required fields: to, repo, confirmUrl');
        }
        await emailService.sendConfirmation({ to, repo, confirmUrl, unsubscribeToken });
        logger.info(`Confirmation email sent to ${to} for ${repo}`, { jobId: job.id });
        break;
    }
    case EventTypes.SEND_RELEASE_NOTIFICATION: {
        const { to, repo, release, unsubscribeUrl } = job.data;
        if (!to || !repo || !release) {
            throw new Error('Missing required fields: to, repo, release');
        }
        await emailService.sendRelease({ to, repo, release, unsubscribeUrl });
        logger.info(`Release notification sent to ${to} for ${repo}@${release.tag}`, { jobId: job.id });
        break;
    }
    default:
        logger.warn(`Unknown event type: ${job.name}`, { jobId: job.id });
        throw new Error(`Unknown event type: ${job.name}`);
    }
}

function startConsumer(redisConnection) {
    const worker = new Worker(NOTIFICATION_QUEUE, processJob, {
        connection: redisConnection,
        concurrency: 5,
    });

    worker.on('completed', (job) => {
        logger.info(`Job ${job.id} [${job.name}] completed successfully`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`Job ${job?.id} [${job?.name}] failed: ${err.message}`, {
            attempt: job?.attemptsMade,
            maxAttempts: job?.opts?.attempts,
        });
    });

    worker.on('error', (err) => {
        logger.error('Notification consumer error', { error: err.message });
    });

    logger.info(`Notification consumer started, listening on queue: ${NOTIFICATION_QUEUE}`);

    return worker;
}

module.exports = { startConsumer, processJob };
