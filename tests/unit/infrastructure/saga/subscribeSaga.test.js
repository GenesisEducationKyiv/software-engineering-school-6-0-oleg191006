jest.mock('@/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));

const { executeSaga, SagaStatus } = require('@/infrastructure/saga/sagaOrchestrator');
const { createSubscribeSaga } = require('@/infrastructure/saga/subscribeSaga');

describe('subscribeSaga', () => {
    let mockRepo;
    let mockNotification;
    let mockEventPublisher;

    beforeEach(() => {
        mockRepo = {
            create: jest.fn().mockResolvedValue({ id: 99 }),
            remove: jest.fn().mockResolvedValue(),
        };
        mockNotification = {
            sendConfirmationEmail: jest.fn().mockResolvedValue(),
        };
        mockEventPublisher = {
            publishEmailCancellation: jest.fn().mockResolvedValue(),
        };
    });

    const baseContext = {
        email: 'user@example.com',
        repo: 'nodejs/node',
        confirmToken: 'tok-123',
        unsubscribeToken: 'unsub-456',
        lastSeenTag: 'v20.0.0',
        confirmUrl: 'http://localhost:3000/api/confirm/tok-123',
    };

    it('should complete successfully when both steps succeed', async () => {
        const saga = createSubscribeSaga({
            subscriptionRepository: mockRepo,
            notificationClient: mockNotification,
            eventPublisher: mockEventPublisher,
        });

        const result = await executeSaga(saga, baseContext);

        expect(result.status).toBe(SagaStatus.COMPLETED);
        expect(mockRepo.create).toHaveBeenCalledWith({
            email: 'user@example.com',
            repo: 'nodejs/node',
            confirmToken: 'tok-123',
            unsubscribeToken: 'unsub-456',
            lastSeenTag: 'v20.0.0',
        });
        expect(mockNotification.sendConfirmationEmail).toHaveBeenCalledWith(
            'user@example.com', 'nodejs/node', 'tok-123', 'unsub-456',
        );
        expect(result.context.subscriptionId).toBe(99);
        expect(result.context.emailSent).toBe(true);
    });

    it('should compensate (delete subscription) when email sending fails', async () => {
        mockNotification.sendConfirmationEmail.mockRejectedValue(new Error('SMTP timeout'));

        const saga = createSubscribeSaga({
            subscriptionRepository: mockRepo,
            notificationClient: mockNotification,
            eventPublisher: mockEventPublisher,
        });

        const result = await executeSaga(saga, baseContext);

        expect(result.status).toBe(SagaStatus.COMPENSATED);
        expect(result.failedStep).toBe('sendConfirmationEmail');
        expect(mockRepo.remove).toHaveBeenCalledWith(99);
    });

    it('should report COMPENSATION_FAILED when rollback also fails', async () => {
        mockNotification.sendConfirmationEmail.mockRejectedValue(new Error('SMTP timeout'));
        mockRepo.remove.mockRejectedValue(new Error('DB connection lost'));

        const saga = createSubscribeSaga({
            subscriptionRepository: mockRepo,
            notificationClient: mockNotification,
            eventPublisher: mockEventPublisher,
        });

        const result = await executeSaga(saga, baseContext);

        expect(result.status).toBe(SagaStatus.COMPENSATION_FAILED);
    });

    it('should not call notification if subscription creation fails', async () => {
        mockRepo.create.mockRejectedValue(new Error('unique constraint violation'));

        const saga = createSubscribeSaga({
            subscriptionRepository: mockRepo,
            notificationClient: mockNotification,
            eventPublisher: mockEventPublisher,
        });

        const result = await executeSaga(saga, baseContext);

        expect(result.status).toBe(SagaStatus.COMPENSATED);
        expect(result.failedStep).toBe('createSubscription');
        expect(mockNotification.sendConfirmationEmail).not.toHaveBeenCalled();
        expect(mockRepo.remove).not.toHaveBeenCalled();
    });
});
