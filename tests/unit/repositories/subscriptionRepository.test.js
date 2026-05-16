const subscriptionRepository = require('@/repositories/subscriptionRepository');
const { query } = require('@/db/connection');

jest.mock('@/db/connection', () => ({
    query: jest.fn(),
}));

afterEach(() => {
    jest.clearAllMocks();
});

describe('subscriptionRepository', () => {
    it('should create a subscription row', async () => {
        query.mockResolvedValue({ rows: [{ id: 1, email: 'user@example.com' }] });

        const result = await subscriptionRepository.create({
            email: 'user@example.com',
            repo: 'nodejs/node',
            confirmToken: 'confirm',
            unsubscribeToken: 'unsubscribe',
            lastSeenTag: 'v1.0.0',
        });

        expect(result).toEqual({ id: 1, email: 'user@example.com' });
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO subscriptions'),
            ['user@example.com', 'nodejs/node', 'confirm', 'unsubscribe', 'v1.0.0'],
        );
    });

    it('should set lastSeenTag to null when missing', async () => {
        query.mockResolvedValue({ rows: [{ id: 2, email: 'user@example.com' }] });

        await subscriptionRepository.create({
            email: 'user@example.com',
            repo: 'nodejs/node',
            confirmToken: 'confirm',
            unsubscribeToken: 'unsubscribe',
            lastSeenTag: null,
        });

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO subscriptions'),
            ['user@example.com', 'nodejs/node', 'confirm', 'unsubscribe', null],
        );
    });

    it('should return null when subscription is not found', async () => {
        query.mockResolvedValue({ rows: [] });

        const result = await subscriptionRepository.findByEmailAndRepo('user@example.com', 'nodejs/node');

        expect(result).toBeNull();
    });

    it('should return subscription when found by email and repo', async () => {
        query.mockResolvedValue({ rows: [{ id: 9, email: 'user@example.com' }] });

        const result = await subscriptionRepository.findByEmailAndRepo('user@example.com', 'nodejs/node');

        expect(result).toEqual({ id: 9, email: 'user@example.com' });
        expect(query).toHaveBeenCalledWith(
            'SELECT * FROM subscriptions WHERE email = $1 AND repo = $2',
            ['user@example.com', 'nodejs/node'],
        );
    });

    it('should return subscription when found by confirm token', async () => {
        query.mockResolvedValue({ rows: [{ id: 3, confirm_token: 'token' }] });

        const result = await subscriptionRepository.findByConfirmToken('token');

        expect(result).toEqual({ id: 3, confirm_token: 'token' });
        expect(query).toHaveBeenCalledWith(
            'SELECT * FROM subscriptions WHERE confirm_token = $1',
            ['token'],
        );
    });

    it('should return subscription when found by unsubscribe token', async () => {
        query.mockResolvedValue({ rows: [{ id: 4, unsubscribe_token: 'token' }] });

        const result = await subscriptionRepository.findByUnsubscribeToken('token');

        expect(result).toEqual({ id: 4, unsubscribe_token: 'token' });
        expect(query).toHaveBeenCalledWith(
            'SELECT * FROM subscriptions WHERE unsubscribe_token = $1',
            ['token'],
        );
    });

    it('should return subscriptions by email', async () => {
        const rows = [{ id: 1 }, { id: 2 }];
        query.mockResolvedValue({ rows });

        const result = await subscriptionRepository.findAllByEmail('user@example.com');

        expect(result).toEqual(rows);
        expect(query).toHaveBeenCalledWith(
            'SELECT * FROM subscriptions WHERE email = $1 ORDER BY created_at DESC',
            ['user@example.com'],
        );
    });

    it('should return all confirmed subscriptions', async () => {
        const rows = [{ id: 1 }, { id: 2 }];
        query.mockResolvedValue({ rows });

        const result = await subscriptionRepository.findAllConfirmed();

        expect(result).toEqual(rows);
        expect(query).toHaveBeenCalledWith(
            'SELECT * FROM subscriptions WHERE confirmed = TRUE ORDER BY repo',
        );
    });

    it('should confirm subscription by id', async () => {
        query.mockResolvedValue({ rows: [{ id: 5, confirmed: true }] });

        const result = await subscriptionRepository.confirm(5);

        expect(result).toEqual({ id: 5, confirmed: true });
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE subscriptions SET confirmed = TRUE'),
            [5],
        );
    });

    it('should remove subscription by id', async () => {
        query.mockResolvedValue({ rows: [] });

        await subscriptionRepository.remove(7);

        expect(query).toHaveBeenCalledWith('DELETE FROM subscriptions WHERE id = $1', [7]);
    });

    it('should return distinct confirmed repos', async () => {
        query.mockResolvedValue({ rows: [{ repo: 'nodejs/node' }, { repo: 'golang/go' }] });

        const result = await subscriptionRepository.getDistinctConfirmedRepos();

        expect(result).toEqual(['nodejs/node', 'golang/go']);
    });

    it('should update last seen tag', async () => {
        query.mockResolvedValue({ rows: [] });

        await subscriptionRepository.updateLastSeenTag(4, 'v1.2.0');

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE subscriptions SET last_seen_tag'),
            ['v1.2.0', 4],
        );
    });

    it('should return confirmed subscriptions by repo', async () => {
        const rows = [{ id: 1, repo: 'nodejs/node' }];
        query.mockResolvedValue({ rows });

        const result = await subscriptionRepository.findConfirmedByRepo('nodejs/node');

        expect(result).toEqual(rows);
        expect(query).toHaveBeenCalledWith(
            'SELECT * FROM subscriptions WHERE repo = $1 AND confirmed = TRUE',
            ['nodejs/node'],
        );
    });
});
