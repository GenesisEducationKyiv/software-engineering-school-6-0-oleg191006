jest.mock('../../../services/notification/src/services/emailService', () => ({
    sendConfirmation: jest.fn(),
    sendRelease: jest.fn(),
}));
jest.mock('../../../services/notification/src/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const { processJob } = require('../../../services/notification/src/consumers/notificationConsumer');
const { EventTypes } = require('../../../services/notification/src/consumers/eventTypes');
const emailService = require('../../../services/notification/src/services/emailService');
const logger = require('../../../services/notification/src/logger');

describe('notificationConsumer - processJob', () => {
    beforeEach(() => {
        emailService.sendConfirmation.mockResolvedValue();
        emailService.sendRelease.mockResolvedValue();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('SEND_CONFIRMATION_EMAIL', () => {
        const validJob = {
            id: 'job-1',
            name: EventTypes.SEND_CONFIRMATION_EMAIL,
            data: {
                to: 'user@example.com',
                repo: 'nodejs/node',
                confirmUrl: 'http://localhost:3000/api/confirm/token-123',
                unsubscribeToken: 'unsub-456',
            },
        };

        it('should call emailService.sendConfirmation with correct data', async () => {
            await processJob(validJob);

            expect(emailService.sendConfirmation).toHaveBeenCalledWith({
                to: 'user@example.com',
                repo: 'nodejs/node',
                confirmUrl: 'http://localhost:3000/api/confirm/token-123',
                unsubscribeToken: 'unsub-456',
            });
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('Confirmation email sent to user@example.com'),
                expect.any(Object),
            );
        });

        it('should throw when "to" is missing', async () => {
            const badJob = {
                ...validJob,
                data: { ...validJob.data, to: '' },
            };

            await expect(processJob(badJob)).rejects.toThrow('Missing required fields: to, repo, confirmUrl');
        });

        it('should throw when "repo" is missing', async () => {
            const badJob = {
                ...validJob,
                data: { ...validJob.data, repo: '' },
            };

            await expect(processJob(badJob)).rejects.toThrow('Missing required fields: to, repo, confirmUrl');
        });

        it('should throw when "confirmUrl" is missing', async () => {
            const badJob = {
                ...validJob,
                data: { ...validJob.data, confirmUrl: '' },
            };

            await expect(processJob(badJob)).rejects.toThrow('Missing required fields: to, repo, confirmUrl');
        });

        it('should propagate email service errors', async () => {
            emailService.sendConfirmation.mockRejectedValue(new Error('SMTP timeout'));

            await expect(processJob(validJob)).rejects.toThrow('SMTP timeout');
        });
    });

    describe('SEND_RELEASE_NOTIFICATION', () => {
        const release = {
            tag: 'v1.0.0',
            name: 'Release 1.0.0',
            url: 'https://github.com/nodejs/node/releases/tag/v1.0.0',
            publishedAt: '2024-06-01T00:00:00Z',
        };

        const validJob = {
            id: 'job-2',
            name: EventTypes.SEND_RELEASE_NOTIFICATION,
            data: {
                to: 'subscriber@example.com',
                repo: 'nodejs/node',
                release,
                unsubscribeUrl: 'http://localhost:3000/api/unsubscribe/unsub-789',
            },
        };

        it('should call emailService.sendRelease with correct data', async () => {
            await processJob(validJob);

            expect(emailService.sendRelease).toHaveBeenCalledWith({
                to: 'subscriber@example.com',
                repo: 'nodejs/node',
                release,
                unsubscribeUrl: 'http://localhost:3000/api/unsubscribe/unsub-789',
            });
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('Release notification sent to subscriber@example.com'),
                expect.any(Object),
            );
        });

        it('should throw when "to" is missing', async () => {
            const badJob = {
                ...validJob,
                data: { ...validJob.data, to: '' },
            };

            await expect(processJob(badJob)).rejects.toThrow('Missing required fields: to, repo, release');
        });

        it('should throw when "repo" is missing', async () => {
            const badJob = {
                ...validJob,
                data: { ...validJob.data, repo: null },
            };

            await expect(processJob(badJob)).rejects.toThrow('Missing required fields: to, repo, release');
        });

        it('should throw when "release" is missing', async () => {
            const badJob = {
                ...validJob,
                data: { ...validJob.data, release: null },
            };

            await expect(processJob(badJob)).rejects.toThrow('Missing required fields: to, repo, release');
        });

        it('should propagate email service errors', async () => {
            emailService.sendRelease.mockRejectedValue(new Error('Resend API limit'));

            await expect(processJob(validJob)).rejects.toThrow('Resend API limit');
        });
    });

    describe('unknown event type', () => {
        it('should throw an error for unknown event types', async () => {
            const unknownJob = {
                id: 'job-99',
                name: 'unknown-event',
                data: {},
            };

            await expect(processJob(unknownJob)).rejects.toThrow('Unknown event type: unknown-event');
            expect(logger.warn).toHaveBeenCalledWith(
                'Unknown event type: unknown-event',
                expect.any(Object),
            );
        });
    });

    describe('job processing logs', () => {
        it('should log processing start with job info', async () => {
            const job = {
                id: 'job-log',
                name: EventTypes.SEND_CONFIRMATION_EMAIL,
                data: {
                    to: 'test@example.com',
                    repo: 'test/repo',
                    confirmUrl: 'http://localhost/confirm/token',
                    unsubscribeToken: 'ut',
                },
            };

            await processJob(job);

            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('Processing job job-log'),
                expect.objectContaining({ data: job.data }),
            );
        });
    });
});
