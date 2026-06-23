const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.resolve(__dirname, '../../../proto/notification/v1/notification.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition);
const notificationProto = proto.notification.v1;

let server;
let client;

function grpcCall(method, request) {
    return new Promise((resolve, reject) => {
        client[method](request, (err, response) => {
            if (err) {return reject(err);}
            resolve(response);
        });
    });
}

beforeAll(() => new Promise((resolve, reject) => {
    server = new grpc.Server();

    server.addService(notificationProto.NotificationService.service, {
        sendConfirmation: (call, callback) => {
            const { to, repo, confirmUrl } = call.request;

            if (!to || !repo || !confirmUrl) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'Missing required fields',
                });
            }
            callback(null, { success: true });
        },
        sendReleaseNotification: (call, callback) => {
            const { to, repo, release } = call.request;

            if (!to || !repo || !release) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'Missing required fields',
                });
            }
            callback(null, { success: true });
        },
    });

    server.bindAsync(
        '127.0.0.1:0',
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
            if (err) {return reject(err);}

            client = new notificationProto.NotificationService(
                `127.0.0.1:${port}`,
                grpc.credentials.createInsecure(),
            );
            resolve();
        },
    );
}));

afterAll(() => {
    if (client) {grpc.closeClient(client);}
    if (server) {server.forceShutdown();}
});

describe('gRPC NotificationService', () => {
    describe('SendConfirmation', () => {
        it('should send confirmation successfully', async () => {
            const response = await grpcCall('sendConfirmation', {
                to: 'user@example.com',
                repo: 'owner/repo',
                confirmUrl: 'http://localhost:3000/api/confirm/token123',
                unsubscribeToken: 'unsub-token',
            });

            expect(response.success).toBe(true);
        });

        it('should return INVALID_ARGUMENT when missing required fields', async () => {
            await expect(
                grpcCall('sendConfirmation', { to: '', repo: '', confirmUrl: '' }),
            ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
        });
    });

    describe('SendReleaseNotification', () => {
        it('should send release notification successfully', async () => {
            const response = await grpcCall('sendReleaseNotification', {
                to: 'user@example.com',
                repo: 'owner/repo',
                release: {
                    tag: 'v1.0.0',
                    name: 'First Release',
                    url: 'https://github.com/owner/repo/releases/tag/v1.0.0',
                    publishedAt: '2024-01-01T00:00:00Z',
                },
                unsubscribeUrl: 'http://localhost:3000/api/unsubscribe/token456',
            });

            expect(response.success).toBe(true);
        });

        it('should return INVALID_ARGUMENT when missing required fields', async () => {
            await expect(
                grpcCall('sendReleaseNotification', { to: '', repo: '', unsubscribeUrl: '' }),
            ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
        });
    });
});
