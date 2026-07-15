const grpc = require('@grpc/grpc-js');
const emailService = require('../../services/emailService');
const logger = require('../../logger');

async function sendReleaseNotification(call, callback) {
    const { to, repo, release, unsubscribeUrl } = call.request;

    if (!to || !repo || !release) {
        return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Missing required fields: to, repo, release',
        });
    }

    try {
        await emailService.sendRelease({ to, repo, release, unsubscribeUrl });
        logger.info(`[gRPC] Release notification sent to ${to} for ${repo}@${release.tag}`);
        callback(null, { success: true });
    } catch (err) {
        logger.error('[gRPC] Failed to send release notification', err);
        callback({
            code: grpc.status.INTERNAL,
            message: `Failed to send release notification: ${err.message}`,
        });
    }
}

module.exports = { sendReleaseNotification };
