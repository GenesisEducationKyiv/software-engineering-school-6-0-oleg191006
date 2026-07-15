const grpc = require('@grpc/grpc-js');
const emailService = require('../../services/emailService');
const logger = require('../../logger');

async function sendConfirmation(call, callback) {
    const { to, repo, confirmUrl, unsubscribeToken } = call.request;

    if (!to || !repo || !confirmUrl) {
        return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Missing required fields: to, repo, confirm_url',
        });
    }

    try {
        await emailService.sendConfirmation({ to, repo, confirmUrl, unsubscribeToken });
        logger.info(`[gRPC] Confirmation email sent to ${to} for repo ${repo}`);
        callback(null, { success: true });
    } catch (err) {
        logger.error('[gRPC] Failed to send confirmation email', err);
        callback({
            code: grpc.status.INTERNAL,
            message: `Failed to send confirmation email: ${err.message}`,
        });
    }
}

module.exports = { sendConfirmation };
