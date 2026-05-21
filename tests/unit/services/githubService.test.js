
const githubService = require('@/services/githubService');
const githubApiClient = require('@/infrastructure/github/apiClient');
const redisCache = require('@/cache/redisCache');

jest.mock('@/infrastructure/github/apiClient');
jest.mock('@/cache/redisCache');

beforeEach(() => {
    redisCache.getJson.mockResolvedValue(undefined);
    redisCache.setJson.mockResolvedValue();
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('checkRepoExists', () => {
    it('should return true when repo exists', async () => {
        githubApiClient.fetchRepo.mockResolvedValue({ data: { full_name: 'facebook/react' } });

        const result = await githubService.checkRepoExists('facebook/react');

        expect(result).toBe(true);
    });

    it('should return false when repo returns 404', async () => {
        const error = new Error('Not Found');
        error.response = { status: 404 };
        githubApiClient.fetchRepo.mockRejectedValue(error);

        const result = await githubService.checkRepoExists('nonexistent/repo');

        expect(result).toBe(false);
    });

    it('should throw 503 when rate limited after retries', async () => {
        const error = new Error('Rate Limited');
        error.response = { status: 429, headers: { 'retry-after': '1' } };
        githubApiClient.fetchRepo.mockRejectedValue(error);

        await expect(githubService.checkRepoExists('facebook/react')).rejects.toMatchObject({
            statusCode: 503,
        });
    });
});

describe('getLatestRelease', () => {
    it('should return release info when available', async () => {
        githubApiClient.fetchLatestRelease.mockResolvedValue({
            data: {
                tag_name: 'v1.21.0',
                name: 'React 1.21.0',
                html_url: 'https://github.com/facebook/react/releases/tag/v1.21.0',
                published_at: '2024-01-01T00:00:00Z',
            },
        });

        const result = await githubService.getLatestRelease('facebook/react');

        expect(result).toEqual({
            tag: 'v1.21.0',
            name: 'React 1.21.0',
            url: 'https://github.com/facebook/react/releases/tag/v1.21.0',
            publishedAt: '2024-01-01T00:00:00Z',
        });
    });

    it('should return null when no releases (404)', async () => {
        const error = new Error('Not Found');
        error.response = { status: 404 };
        githubApiClient.fetchLatestRelease.mockRejectedValue(error);

        const result = await githubService.getLatestRelease('new/repo');

        expect(result).toBeNull();
    });

    it('should return null on rate limit (429) instead of throwing', async () => {
        const error = new Error('Rate Limited');
        error.response = { status: 429, headers: { 'retry-after': '1' } };
        githubApiClient.fetchLatestRelease.mockRejectedValue(error);

        const result = await githubService.getLatestRelease('facebook/react');

        expect(result).toBeNull();
    });

    it('should use tag_name as name when name is missing', async () => {
        githubApiClient.fetchLatestRelease.mockResolvedValue({
            data: {
                tag_name: 'v2.0.0',
                name: null,
                html_url: 'https://github.com/org/repo/releases/tag/v2.0.0',
                published_at: null,
            },
        });

        const result = await githubService.getLatestRelease('org/repo');

        expect(result.name).toBe('v2.0.0');
    });
});