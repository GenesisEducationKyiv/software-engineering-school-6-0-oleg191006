const subscriptionService = require('@/services/subscriptionService');
const subscriptionRepo = require('@/repositories/subscriptionRepository');
const githubService = require('@/services/githubService');
const emailService = require('@/services/emailService');

jest.mock('@/repositories/subscriptionRepository');
jest.mock('@/services/githubService');
jest.mock('@/services/emailService');

afterEach(() => {
    jest.clearAllMocks();
});

describe('subscriptionService.subscribe', () => {
    const validEmail = 'user@example.com';
    const validRepo = 'golang/go';

    it('should throw 400 for invalid email', async () => {
        await expect(subscriptionService.subscribe('', validRepo))
            .rejects
            .toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 for invalid repo format', async () => {
        await expect(subscriptionService.subscribe(validEmail, 'invalid'))
            .rejects
            .toMatchObject({ statusCode: 400 });
    });

    it('should throw 409 if subscription already exists', async () => {
        subscriptionRepo.findByEmailAndRepo.mockResolvedValue({ id: 1 });

        await expect(subscriptionService.subscribe(validEmail, validRepo))
            .rejects
            .toMatchObject({ statusCode: 409 });
    });

    it('should throw 404 if repo does not exist on GitHub', async () => {
        subscriptionRepo.findByEmailAndRepo.mockResolvedValue(null);
        githubService.checkRepoExists.mockResolvedValue(false);

        await expect(subscriptionService.subscribe(validEmail, validRepo))
            .rejects
            .toMatchObject({ statusCode: 404 });
    });

    it('should create subscription and send confirmation email on success', async () => {
        subscriptionRepo.findByEmailAndRepo.mockResolvedValue(null);
        githubService.checkRepoExists.mockResolvedValue(true);
        githubService.getLatestRelease.mockResolvedValue({ tag: 'v1.21.0', name: 'React 1.21', url: 'https://github.com/facebook/react/releases/tag/v1.21.0' });
        subscriptionRepo.create.mockResolvedValue({ id: 1 });
        emailService.sendConfirmationEmail.mockResolvedValue();

        const result = await subscriptionService.subscribe(validEmail, validRepo);

        expect(result.message).toContain('Confirmation email sent');
        expect(subscriptionRepo.create).toHaveBeenCalledTimes(1);
        expect(subscriptionRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                email: validEmail,
                repo: validRepo,
                lastSeenTag: 'v1.21.0',
            }),
        );
        expect(emailService.sendConfirmationEmail).toHaveBeenCalledTimes(1);
    });

    it('should set lastSeenTag to null when repo has no releases', async () => {
        subscriptionRepo.findByEmailAndRepo.mockResolvedValue(null);
        githubService.checkRepoExists.mockResolvedValue(true);
        githubService.getLatestRelease.mockResolvedValue(null);
        subscriptionRepo.create.mockResolvedValue({ id: 1 });
        emailService.sendConfirmationEmail.mockResolvedValue();

        await subscriptionService.subscribe(validEmail, validRepo);

        expect(subscriptionRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({ lastSeenTag: null }),
        );
    });

    it('should normalize email to lowercase', async () => {
        subscriptionRepo.findByEmailAndRepo.mockResolvedValue(null);
        githubService.checkRepoExists.mockResolvedValue(true);
        githubService.getLatestRelease.mockResolvedValue(null);
        subscriptionRepo.create.mockResolvedValue({ id: 1 });
        emailService.sendConfirmationEmail.mockResolvedValue();

        await subscriptionService.subscribe('User@Example.COM', validRepo);

        expect(subscriptionRepo.findByEmailAndRepo).toHaveBeenCalledWith('user@example.com', validRepo);
        expect(subscriptionRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'user@example.com' }),
        );
    });
});

describe('subscriptionService.confirmSubscription', () => {
    it('should throw 400 for empty token', async () => {
        await expect(subscriptionService.confirmSubscription(''))
            .rejects
            .toMatchObject({ statusCode: 400 });
    });

    it('should throw 404 when token not found', async () => {
        subscriptionRepo.findByConfirmToken.mockResolvedValue(null);

        await expect(subscriptionService.confirmSubscription('unknown-token'))
            .rejects
            .toMatchObject({ statusCode: 404 });
    });

    it('should confirm subscription successfully', async () => {
        subscriptionRepo.findByConfirmToken.mockResolvedValue({ id: 1, confirmed: false });
        subscriptionRepo.confirm.mockResolvedValue({ id: 1, confirmed: true });

        const result = await subscriptionService.confirmSubscription('valid-token');

        expect(result.message).toContain('confirmed');
        expect(subscriptionRepo.confirm).toHaveBeenCalledWith(1);
    });

    it('should return success message if already confirmed', async () => {
        subscriptionRepo.findByConfirmToken.mockResolvedValue({ id: 1, confirmed: true });

        const result = await subscriptionService.confirmSubscription('valid-token');

        expect(result.message).toContain('already confirmed');
        expect(subscriptionRepo.confirm).not.toHaveBeenCalled();
    });
});

describe('subscriptionService.unsubscribe', () => {
    it('should throw 400 for empty token', async () => {
        await expect(subscriptionService.unsubscribe(''))
            .rejects
            .toMatchObject({ statusCode: 400 });
    });

    it('should throw 404 when token not found', async () => {
        subscriptionRepo.findByUnsubscribeToken.mockResolvedValue(null);

        await expect(subscriptionService.unsubscribe('unknown-token'))
            .rejects
            .toMatchObject({ statusCode: 404 });
    });

    it('should remove subscription successfully', async () => {
        subscriptionRepo.findByUnsubscribeToken.mockResolvedValue({ id: 5, confirmed: true });
        subscriptionRepo.remove.mockResolvedValue();

        const result = await subscriptionService.unsubscribe('valid-token');

        expect(result.message).toContain('Unsubscribed');
        expect(subscriptionRepo.remove).toHaveBeenCalledWith(5);
    });

    it('should throw 409 when subscription is not confirmed', async () => {
        subscriptionRepo.findByUnsubscribeToken.mockResolvedValue({ id: 5, confirmed: false });

        await expect(subscriptionService.unsubscribe('valid-token'))
            .rejects
            .toMatchObject({ statusCode: 409 });

        expect(subscriptionRepo.remove).not.toHaveBeenCalled();
    });
});

describe('subscriptionService.getSubscriptions', () => {
    it('should throw 400 for invalid email', async () => {
        await expect(subscriptionService.getSubscriptions(''))
            .rejects
            .toMatchObject({ statusCode: 400 });
    });

    it('should return formatted subscriptions', async () => {
        subscriptionRepo.findAllByEmail.mockResolvedValue([
            { email: 'user@example.com', repo: 'golang/go', confirmed: true, last_seen_tag: 'v1.21.0', id: 1, confirm_token: 'x' },
            { email: 'user@example.com', repo: 'nodejs/node', confirmed: false, last_seen_tag: null, id: 2, confirm_token: 'y' },
        ]);

        const result = await subscriptionService.getSubscriptions('user@example.com');

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            email: 'user@example.com',
            repo: 'golang/go',
            confirmed: true,
            last_seen_tag: 'v1.21.0',
        });
        expect(result[1]).toEqual({
            email: 'user@example.com',
            repo: 'nodejs/node',
            confirmed: false,
            last_seen_tag: null,
        });
        expect(result[0].confirm_token).toBeUndefined();
    });

    it('should return empty array when no subscriptions exist', async () => {
        subscriptionRepo.findAllByEmail.mockResolvedValue([]);

        const result = await subscriptionService.getSubscriptions('user@example.com');

        expect(result).toEqual([]);
    });
});
