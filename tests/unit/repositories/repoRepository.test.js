const repoRepository = require('@/modules/scanner/repoRepository');
const { query } = require('@/db/connection');

jest.mock('@/db/connection', () => ({
    query: jest.fn(),
}));

afterEach(() => {
    jest.clearAllMocks();
});

describe('repoRepository', () => {
    it('should return matching row or null', async () => {
        query.mockResolvedValue({ rows: [{ repo: 'a/b', last_seen_tag: 'v1' }] });

        const result = await repoRepository.findByRepo('a/b');

        expect(result).toEqual({ repo: 'a/b', last_seen_tag: 'v1' });
    });

    it('should return null when no rows', async () => {
        query.mockResolvedValue({ rows: [] });

        const result = await repoRepository.findByRepo('x/y');

        expect(result).toBeNull();
    });

    it('should insert or update and return the row', async () => {
        const row = { repo: 'a/b', last_seen_tag: 'v2' };
        query.mockResolvedValue({ rows: [row] });

        const result = await repoRepository.upsert('a/b', 'v2');

        expect(result).toEqual(row);
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT'), ['a/b', 'v2']);
    });
});
