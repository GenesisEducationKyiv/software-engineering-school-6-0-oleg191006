const { Queue } = require('bullmq');
const { getRedisConnection } = require('./connection');
const { NOTIFICATION_QUEUE, EventTypes } = require('./eventTypes');
const logger = require('@/utils/logger');

let queue = null;

function getQueue() {
    if (queue) {
        return queue;
    }

    const connection = getRedisConnection();
    if (!connection) {
        return null;
    }

    queue = new Queue(NOTIFICATION_QUEUE, {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { count: 1000 },
            removeOnFail: { count: 5000 },
        },
    });

    queue.on('error', (err) => {
        logger.error('Message broker queue error', { error: err.message });
    });

    return queue;
}

async function publishConfirmationEmail({ email, repo, confirmToken, unsubscribeToken, confirmUrl }) {
    const q = getQueue();
    if (!q) {
        logger.warn('Message broker unavailable, skipping confirmation email event');
        return null;
    }

    const job = await q.add(EventTypes.SEND_CONFIRMATION_EMAIL, {
        to: email,
        repo,
        confirmUrl,
        confirmToken,
        unsubscribeToken,
    });

    logger.info(`Published ${EventTypes.SEND_CONFIRMATION_EMAIL} event`, {
        jobId: job.id, email, repo,
    });

    return job;
}

async function publishReleaseNotification({ email, repo, release, unsubscribeToken, unsubscribeUrl }) {
    const q = getQueue();
    if (!q  ) {
        logger.warn('Message broker unavailable, skipping release notification event');
        return null;
    }

    const job = await q.add(EventTypes.SEND_RELEASE_NOTIFICATION, {
        to: email,
        repo,
        release,
        unsubscribeToken,
        unsubscribeUrl,
    });

    logger.info(`Published ${EventTypes.SEND_RELEASE_NOTIFICATION} event`, {
        jobId: job.id, email, repo, tag: release.tag,
    });

    return job;
}

async function close() {
    if (queue) {
        await queue.close();
        queue = null;
        logger.info('Message broker queue closed');
    }
}

module.exports = {
    publishConfirmationEmail,
    publishReleaseNotification,
    close,
    getQueue,
};
