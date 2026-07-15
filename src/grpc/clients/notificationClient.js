const grpc = require('@grpc/grpc-js');
const config = require('@/config');
const logger = require('@/utils/logger');
const { notificationProto } = require('../../../shared/grpcProto');

const DEFAULT_DEADLINE_MS = 15000;

let client = null;

function getClient() {
    if (!client) {
        const target = config.notificationGrpcUrl || 'localhost:50051';
        client = new notificationProto.NotificationService(
            target,
            grpc.credentials.createInsecure(),
        );
        logger.info(`[gRPC] Client connected to notification service at ${target}`);
    }
    return client;
}

function callWithDeadline(method, request, deadlineMs = DEFAULT_DEADLINE_MS) {
    return new Promise((resolve, reject) => {
        const deadline = new Date(Date.now() + deadlineMs);
        getClient()[method](request, { deadline }, (err, response) => {
            if (err) {return reject(err);}
            resolve(response);
        });
    });
}

async function sendConfirmationViaGrpc({ to, repo, confirmUrl, unsubscribeToken }) {
    return callWithDeadline('sendConfirmation', {
        to,
        repo,
        confirmUrl,
        unsubscribeToken,
    });
}

async function sendReleaseNotificationViaGrpc({ to, repo, release, unsubscribeUrl }) {
    return callWithDeadline('sendReleaseNotification', {
        to,
        repo,
        release: {
            tag: release.tag || '',
            name: release.name || '',
            url: release.url || '',
            publishedAt: release.publishedAt || '',
        },
        unsubscribeUrl,
    });
}

function closeClient() {
    if (client) {
        grpc.closeClient(client);
        client = null;
    }
}

module.exports = { sendConfirmationViaGrpc, sendReleaseNotificationViaGrpc, closeClient };
