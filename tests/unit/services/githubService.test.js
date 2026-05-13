
const axios = require('axios');
const githubService = require('@/services/githubService');
const redisCache = require('@/cache/redisCache');

jest.mock('axios');
jest.mock('@/cache/redisCache');

beforeEach(() => {
    jest.spyOn(githubService, 'sleep').mockResolvedValue();
    redisCache.getJson.mockResolvedValue(undefined);
    redisCache.setJson.mockResolvedValue();
});

afterEach(() => {
    jest.restoreAllMocks();
});

const mockGet = jest.fn();
beforeEach(() => {
    axios.create.mockReturnValue({ get: mockGet });
});

describe('checkRepoExists', () => {
    it('should return true when repo exists', async () => {
        mockGet.mockResolvedValue({ data: { full_name: 'facebook/react' } });

        const result = await githubService.checkRepoExists('facebook/react');

        expect(result).toBe(true);
        expect(mockGet).toHaveBeenCalledWith('/repos/facebook/react');
    });

    it('should return false when repo returns 404', async () => {
        const error = new Error('Not Found');
        error.response = { status: 404 };
        mockGet.mockRejectedValue(error);

        const result = await githubService.checkRepoExists('nonexistent/repo');

        expect(result).toBe(false);
    });

    it('should throw 503 when rate limited after retries', async () => {
        const error = new Error('Rate Limited');
        error.response = { status: 429, headers: { 'retry-after': '1' } };
        mockGet.mockRejectedValue(error);

        await expect(githubService.checkRepoExists('facebook/react')).rejects.toMatchObject({
            statusCode: 503,
        });
    });
});

describe('getLatestRelease', () => {
    it('should return release info when available', async () => {
        mockGet.mockResolvedValue({
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
        mockGet.mockRejectedValue(error);

        const result = await githubService.getLatestRelease('new/repo');

        expect(result).toBeNull();
    });

    it('should return null on rate limit (429) instead of throwing', async () => {
        const error = new Error('Rate Limited');
        error.response = { status: 429, headers: { 'retry-after': '1' } };
        mockGet.mockRejectedValue(error);

        const result = await githubService.getLatestRelease('facebook/react');

        expect(result).toBeNull();
    });

    it('should use tag_name as name when name is missing', async () => {
        mockGet.mockResolvedValue({
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

describe('withRateLimitRetry', () => {
    it('should return result on first success', async () => {
        const fn = jest.fn().mockResolvedValue('ok');

        const result = await githubService.withRateLimitRetry(fn, 2);

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 and succeed', async () => {
        const rateLimitError = new Error('Rate Limited');
        rateLimitError.response = { status: 429, headers: { 'retry-after': '1' } };

        const fn = jest.fn()
            .mockRejectedValueOnce(rateLimitError)
            .mockResolvedValueOnce('ok');

        const result = await githubService.withRateLimitRetry(fn, 2);

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
        expect(githubService.sleep).toHaveBeenCalledTimes(1);
    });

    it('should throw non-429 errors immediately', async () => {
        const error = new Error('Server Error');
        error.response = { status: 500 };

        const fn = jest.fn().mockRejectedValue(error);

        await expect(githubService.withRateLimitRetry(fn, 2)).rejects.toThrow('Server Error');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw 429 error after exhausting retries', async () => {
        const rateLimitError = new Error('Rate Limited');
        rateLimitError.response = { status: 429, headers: { 'retry-after': '1' } };

        const fn = jest.fn().mockRejectedValue(rateLimitError);

        await expect(githubService.withRateLimitRetry(fn, 2)).rejects.toThrow('Rate Limited');
        expect(fn).toHaveBeenCalledTimes(3);
    });
});

describe('sleep', () => {
    it('should resolve after the given delay', async () => {

        githubService.sleep.mockRestore();

        jest.useFakeTimers();
        const promise = githubService.sleep(1000);
        jest.advanceTimersByTime(1000);
        await promise;
        jest.useRealTimers();
    });
});