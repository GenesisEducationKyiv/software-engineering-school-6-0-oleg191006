const subscriptionRepository = require('@/modules/subscription/subscriptionRepository');
const { query } = require('@/db/connection');

jest.mock('@/db/connection', () => ({
    query: jest.fn(),
}));

afterEach(() => {
    jest.clearAllMocks();
});

describe('subscriptionRepository', () => {
    it('should insert and return the new row', async () => {
        const row = { id: 1, email: 'u@e.com', repo: 'a/b' };
        query.mockResolvedValue({ rows: [row] });

        const result = await subscriptionRepository.create({
            email: 'u@e.com',
            repo: 'a/b',
            confirmToken: 'ct',
            unsubscribeToken: 'ut',
            lastSeenTag: 'v1',
        });

        expect(result).toEqual(row);
        expect(query).toHaveBeenCalledTimes(1);
    });

    it('should return matching row or null', async () => {
        query.mockResolvedValue({ rows: [] });

        const result = await subscriptionRepository.findByEmailAndRepo('u@e.com', 'a/b');

        expect(result).toBeNull();
    });

    it('should return matching row', async () => {
        const row = { id: 1, confirm_token: 'tok' };
        query.mockResolvedValue({ rows: [row] });

        const result = await subscriptionRepository.findByConfirmToken('tok');

        expect(result).toEqual(row);
    });

    it('should update confirmed flag', async () => {
        const row = { id: 1, confirmed: true };
        query.mockResolvedValue({ rows: [row] });

        const result = await subscriptionRepository.confirm(1);

        expect(result).toEqual(row);
    });

    it('should delete by id', async () => {
        query.mockResolvedValue({ rows: [] });

        await subscriptionRepository.remove(1);

        expect(query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), [1]);
    });

    it('should return repo names', async () => {
        query.mockResolvedValue({ rows: [{ repo: 'a/b' }, { repo: 'c/d' }] });

        const result = await subscriptionRepository.getDistinctConfirmedRepos();

        expect(result).toEqual(['a/b', 'c/d']);
    });
});
