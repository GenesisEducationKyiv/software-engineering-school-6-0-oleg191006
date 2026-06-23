const axios = require('axios');

jest.mock('axios');
jest.mock('@/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));
jest.mock('@/config', () => ({
    appUrl: 'http://localhost:3000',
    notificationServiceUrl: 'http://localhost:3001',
    notificationGrpcUrl: 'localhost:50051',
    resend: { apiKey: '' },
    smtp: { user: '', pass: '' },
    redis: { url: '' },
}));
jest.mock('@/infrastructure/messageBroker/eventPublisher', () => ({
    publishConfirmationEmail: jest.fn().mockResolvedValue(null),
    publishReleaseNotification: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/grpc/clients/notificationClient', () => ({
    sendConfirmationViaGrpc: jest.fn().mockRejectedValue(new Error('gRPC unavailable')),
    sendReleaseNotificationViaGrpc: jest.fn().mockRejectedValue(new Error('gRPC unavailable')),
    closeClient: jest.fn(),
}));

const notificationClient = require('@/modules/notification/notificationClient');
const eventPublisher = require('@/infrastructure/messageBroker/eventPublisher');
const grpcClient = require('@/grpc/clients/notificationClient');
const logger = require('@/utils/logger');

afterEach(() => {
    jest.clearAllMocks();
});

describe('notificationClient', () => {
    describe('sendConfirmationEmail', () => {
        it('should publish to queue when broker is available', async () => {
            eventPublisher.publishConfirmationEmail.mockResolvedValue({ id: 'job-1' });

            await notificationClient.sendConfirmationEmail(
                'user@example.com', 'nodejs/node', 'confirm-token', 'unsub-token',
            );

            expect(eventPublisher.publishConfirmationEmail).toHaveBeenCalledWith({
                email: 'user@example.com',
                repo: 'nodejs/node',
                confirmToken: 'confirm-token',
                unsubscribeToken: 'unsub-token',
                confirmUrl: 'http://localhost:3000/api/confirm/confirm-token',
            });
            expect(axios.post).not.toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalled();
        });

        it('should fall back to HTTP when queue returns null and gRPC fails', async () => {
            eventPublisher.publishConfirmationEmail.mockResolvedValue(null);
            grpcClient.sendConfirmationViaGrpc.mockRejectedValue(new Error('gRPC unavailable'));
            axios.post.mockResolvedValue({ data: { success: true } });

            await notificationClient.sendConfirmationEmail(
                'user@example.com', 'nodejs/node', 'confirm-token', 'unsub-token',
            );

            expect(grpcClient.sendConfirmationViaGrpc).toHaveBeenCalled();
            expect(axios.post).toHaveBeenCalledWith(
                'http://localhost:3001/api/notify/confirmation',
                {
                    to: 'user@example.com',
                    repo: 'nodejs/node',
                    confirmUrl: 'http://localhost:3000/api/confirm/confirm-token',
                    unsubscribeToken: 'unsub-token',
                },
                { timeout: 15000 },
            );
        });

        it('should fall back through gRPC to HTTP when queue publish throws', async () => {
            eventPublisher.publishConfirmationEmail.mockRejectedValue(new Error('Redis down'));
            grpcClient.sendConfirmationViaGrpc.mockRejectedValue(new Error('gRPC unavailable'));
            axios.post.mockResolvedValue({ data: { success: true } });

            await notificationClient.sendConfirmationEmail(
                'user@example.com', 'nodejs/node', 'confirm-token', 'unsub-token',
            );

            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('falling back to gRPC'),
            );
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('falling back to REST'),
            );
            expect(axios.post).toHaveBeenCalled();
        });

        it('should use gRPC when queue returns null and gRPC succeeds', async () => {
            eventPublisher.publishConfirmationEmail.mockResolvedValue(null);
            grpcClient.sendConfirmationViaGrpc.mockResolvedValue({ success: true });

            await notificationClient.sendConfirmationEmail(
                'user@example.com', 'nodejs/node', 'confirm-token', 'unsub-token',
            );

            expect(grpcClient.sendConfirmationViaGrpc).toHaveBeenCalled();
            expect(axios.post).not.toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('gRPC'),
            );
        });

        it('should throw when queue, gRPC, and HTTP all fail', async () => {
            eventPublisher.publishConfirmationEmail.mockRejectedValue(new Error('Redis down'));
            grpcClient.sendConfirmationViaGrpc.mockRejectedValue(new Error('gRPC unavailable'));
            axios.post.mockRejectedValue(new Error('ECONNREFUSED'));

            await expect(
                notificationClient.sendConfirmationEmail(
                    'user@example.com', 'nodejs/node', 'confirm-token', 'unsub-token',
                ),
            ).rejects.toThrow('ECONNREFUSED');
        });
    });

    describe('sendReleaseNotification', () => {
        const release = {
            tag: 'v1.0.0',
            name: 'Release 1',
            url: 'https://github.com/nodejs/node/releases/tag/v1.0.0',
            publishedAt: '2024-01-01',
        };

        it('should publish to queue when broker is available', async () => {
            eventPublisher.publishReleaseNotification.mockResolvedValue({ id: 'job-2' });

            await notificationClient.sendReleaseNotification(
                'user@example.com', 'nodejs/node', release, 'unsub-token',
            );

            expect(eventPublisher.publishReleaseNotification).toHaveBeenCalledWith({
                email: 'user@example.com',
                repo: 'nodejs/node',
                release,
                unsubscribeToken: 'unsub-token',
                unsubscribeUrl: 'http://localhost:3000/api/unsubscribe/unsub-token',
            });
            expect(axios.post).not.toHaveBeenCalled();
        });

        it('should fall back to HTTP when queue returns null and gRPC fails', async () => {
            eventPublisher.publishReleaseNotification.mockResolvedValue(null);
            grpcClient.sendReleaseNotificationViaGrpc.mockRejectedValue(new Error('gRPC unavailable'));
            axios.post.mockResolvedValue({ data: { success: true } });

            await notificationClient.sendReleaseNotification(
                'user@example.com', 'nodejs/node', release, 'unsub-token',
            );

            expect(grpcClient.sendReleaseNotificationViaGrpc).toHaveBeenCalled();
            expect(axios.post).toHaveBeenCalledWith(
                'http://localhost:3001/api/notify/release',
                {
                    to: 'user@example.com',
                    repo: 'nodejs/node',
                    release,
                    unsubscribeUrl: 'http://localhost:3000/api/unsubscribe/unsub-token',
                },
                { timeout: 15000 },
            );
        });

        it('should use gRPC when queue returns null and gRPC succeeds', async () => {
            eventPublisher.publishReleaseNotification.mockResolvedValue(null);
            grpcClient.sendReleaseNotificationViaGrpc.mockResolvedValue({ success: true });

            await notificationClient.sendReleaseNotification(
                'user@example.com', 'nodejs/node', release, 'unsub-token',
            );

            expect(grpcClient.sendReleaseNotificationViaGrpc).toHaveBeenCalled();
            expect(axios.post).not.toHaveBeenCalled();
        });

        it('should swallow errors when queue, gRPC, and HTTP all fail for release', async () => {
            eventPublisher.publishReleaseNotification.mockRejectedValue(new Error('Redis down'));
            grpcClient.sendReleaseNotificationViaGrpc.mockRejectedValue(new Error('gRPC unavailable'));
            axios.post.mockRejectedValue(new Error('network error'));

            await expect(
                notificationClient.sendReleaseNotification(
                    'user@example.com', 'nodejs/node', release, 'unsub-token',
                ),
            ).resolves.toBeUndefined();

            expect(logger.error).toHaveBeenCalled();
        });
    });
});
