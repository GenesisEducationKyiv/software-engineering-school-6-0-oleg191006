const axios = require('axios');
const config = require('@/config');
const logger = require('@/utils/logger');
const eventPublisher = require('@/infrastructure/messageBroker/eventPublisher');

function getBaseUrl() {
    return config.notificationServiceUrl || 'http://localhost:3001';
}

async function sendViaHttp(endpoint, payload) {
    return axios.post(`${getBaseUrl()}${endpoint}`, payload, { timeout: 15000 });
}

async function sendConfirmationEmail(email, repo, confirmToken, unsubscribeToken) {
    const confirmUrl = `${config.appUrl}/api/confirm/${confirmToken}`;

    try {
        const job = await eventPublisher.publishConfirmationEmail({
            email, repo, confirmToken, unsubscribeToken, confirmUrl,
        });

        if (job) {
            logger.info(`Confirmation email queued for ${email} (${repo})`, { jobId: job.id });
            return;
        }
    } catch (err) {
        logger.warn(`Failed to queue confirmation email, falling back to HTTP: ${err.message}`);
    }

    try {
        await sendViaHttp('/api/notify/confirmation', {
            to: email, repo, confirmUrl, unsubscribeToken,
        });
        logger.info(`Confirmation notification dispatched via HTTP for ${email} (${repo})`);
    } catch (err) {
        logger.error(`Failed to dispatch confirmation notification for ${email}`, err.message);
        throw err;
    }
}

async function sendReleaseNotification(email, repo, release, unsubscribeToken) {
    const unsubscribeUrl = `${config.appUrl}/api/unsubscribe/${unsubscribeToken}`;

    try {
        const job = await eventPublisher.publishReleaseNotification({
            email, repo, release, unsubscribeToken, unsubscribeUrl,
        });

        if (job) {
            logger.info(`Release notification queued for ${email} (${repo}@${release.tag})`, { jobId: job.id });
            return;
        }
    } catch (err) {
        logger.warn(`Failed to queue release notification, falling back to HTTP: ${err.message}`);
    }

    try {
        await sendViaHttp('/api/notify/release', {
            to: email, repo, release, unsubscribeUrl,
        });
        logger.info(`Release notification dispatched via HTTP for ${email} (${repo}@${release.tag})`);
    } catch (err) {
        logger.error(`Failed to dispatch release notification for ${email}`, err.message);
    }
}

module.exports = { sendConfirmationEmail, sendReleaseNotification };
