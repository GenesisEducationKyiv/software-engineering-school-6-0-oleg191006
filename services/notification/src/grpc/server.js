const grpc = require('@grpc/grpc-js');
const logger = require('../logger');
const { notificationProto } = require('../../../../shared/grpcProto');
const { sendConfirmation } = require('./handlers/confirmationHandler');
const { sendReleaseNotification } = require('./handlers/releaseHandler');

function createGrpcServer() {
    const server = new grpc.Server();

    server.addService(notificationProto.NotificationService.service, {
        sendConfirmation,
        sendReleaseNotification,
    });

    return server;
}

function startGrpcServer(port, host) {
    const server = createGrpcServer();
    const bindAddress = host || process.env.GRPC_HOST || '0.0.0.0';

    return new Promise((resolve, reject) => {
        server.bindAsync(
            `${bindAddress}:${port}`,
            grpc.ServerCredentials.createInsecure(),
            (err, boundPort) => {
                if (err) {
                    logger.error(`[gRPC] Failed to bind on port ${port}`, err);
                    return reject(err);
                }

                logger.info(`[gRPC] Notification gRPC server listening on port ${boundPort}`);
                resolve(server);
            },
        );
    });
}

module.exports = { createGrpcServer, startGrpcServer };
