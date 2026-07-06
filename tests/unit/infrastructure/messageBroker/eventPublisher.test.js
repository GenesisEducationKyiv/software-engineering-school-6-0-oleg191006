jest.mock('@/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

jest.mock('@/config', () => ({
    redis: { url: 'redis://localhost:6379' },
}));

const mockAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
const mockClose = jest.fn().mockResolvedValue();
const mockOn = jest.fn();

jest.mock('bullmq', () => ({
    Queue: jest.fn().mockImplementation(() => ({
        add: mockAdd,
        close: mockClose,
        on: mockOn,
    })),
}));

const { Queue } = require('bullmq');
const logger = require('@/utils/logger');
const eventPublisher = require('@/infrastructure/messageBroker/eventPublisher');

afterEach(() => {
    jest.clearAllMocks();
});

describe('eventPublisher', () => {
    describe('publishConfirmationEmail', () => {
        it('should add a job to the queue with correct event type and data', async () => {
            const payload = {
                email: 'user@example.com',
                repo: 'nodejs/node',
                confirmToken: 'confirm-123',
                unsubscribeToken: 'unsub-456',
                confirmUrl: 'http://localhost:3000/api/confirm/confirm-123',
            };

            const job = await eventPublisher.publishConfirmationEmail(payload);

            expect(job).toEqual({ id: 'job-1' });
            expect(mockAdd).toHaveBeenCalledWith('send-confirmation-email', {
                to: 'user@example.com',
                repo: 'nodejs/node',
                confirmUrl: 'http://localhost:3000/api/confirm/confirm-123',
                confirmToken: 'confirm-123',
                unsubscribeToken: 'unsub-456',
            });
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('send-confirmation-email'),
                expect.objectContaining({ jobId: 'job-1' }),
            );
        });

        it('should reuse existing Queue (singleton)', async () => {
            Queue.mockClear();

            await eventPublisher.publishConfirmationEmail({
                email: 'a@b.com', repo: 'a/b', confirmToken: 'ct', unsubscribeToken: 'ut', confirmUrl: 'http://x',
            });
            await eventPublisher.publishConfirmationEmail({
                email: 'c@d.com', repo: 'c/d', confirmToken: 'ct2', unsubscribeToken: 'ut2', confirmUrl: 'http://y',
            });

            expect(mockAdd).toHaveBeenCalledTimes(2);
            expect(Queue).toHaveBeenCalledTimes(0);
        });
    });

    describe('publishReleaseNotification', () => {
        it('should add a job to the queue with correct event type and data', async () => {
            const release = { tag: 'v1.0.0', name: 'Release 1', url: 'http://gh/1', publishedAt: '2024-01-01' };
            const payload = {
                email: 'user@example.com',
                repo: 'nodejs/node',
                release,
                unsubscribeToken: 'unsub-789',
                unsubscribeUrl: 'http://localhost:3000/api/unsubscribe/unsub-789',
            };

            const job = await eventPublisher.publishReleaseNotification(payload);

            expect(job).toEqual({ id: 'job-1' });
            expect(mockAdd).toHaveBeenCalledWith('send-release-notification', {
                to: 'user@example.com',
                repo: 'nodejs/node',
                release,
                unsubscribeToken: 'unsub-789',
                unsubscribeUrl: 'http://localhost:3000/api/unsubscribe/unsub-789',
            });
        });
    });

    describe('close', () => {
        it('should close the queue', async () => {
            await eventPublisher.close();

            expect(mockClose).toHaveBeenCalledTimes(1);
            expect(logger.info).toHaveBeenCalledWith('Message broker queue closed');
        });
    });
});
