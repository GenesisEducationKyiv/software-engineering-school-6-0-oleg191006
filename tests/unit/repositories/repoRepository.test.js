const repoRepository = require('@/repositories/repoRepository');
const { query } = require('@/db/connection');

jest.mock('@/db/connection', () => ({
    query: jest.fn(),
}));

afterEach(() => {
    jest.clearAllMocks();
});

describe('repoRepository', () => {
    it('should return null when repo is missing', async () => {
        query.mockResolvedValue({ rows: [] });

        const result = await repoRepository.findByRepo('nodejs/node');

        expect(result).toBeNull();
    });

    it('should upsert repo cache row', async () => {
        query.mockResolvedValue({ rows: [{ id: 1, repo: 'nodejs/node', last_seen_tag: 'v1.0.0' }] });

        const result = await repoRepository.upsert('nodejs/node', 'v1.0.0');

        expect(result).toEqual({ id: 1, repo: 'nodejs/node', last_seen_tag: 'v1.0.0' });
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO repositories'),
            ['nodejs/node', 'v1.0.0'],
        );
    });
});
