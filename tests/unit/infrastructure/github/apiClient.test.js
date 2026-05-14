const axios = require('axios');
const githubApiClient = require('@/infrastructure/github/apiClient');

jest.mock('axios');

beforeEach(() => {
    jest.spyOn(githubApiClient, 'sleep').mockResolvedValue();
});

afterEach(() => {
    jest.restoreAllMocks();
});

const mockGet = jest.fn();
beforeEach(() => {
    axios.create.mockReturnValue({ get: mockGet });
});

describe('withRateLimitRetry', () => {
    it('should return result on first success', async () => {
        const fn = jest.fn().mockResolvedValue('ok');
        const sleepFn = jest.fn().mockResolvedValue();

        const result = await githubApiClient.withRateLimitRetry(fn, { maxRetries: 2, sleepFn });

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
        expect(sleepFn).not.toHaveBeenCalled();
    });

    it('should retry on 429 and succeed', async () => {
        const rateLimitError = new Error('Rate Limited');
        rateLimitError.response = { status: 429, headers: { 'retry-after': '1' } };

        const fn = jest.fn()
            .mockRejectedValueOnce(rateLimitError)
            .mockResolvedValueOnce('ok');
        const sleepFn = jest.fn().mockResolvedValue();

        const result = await githubApiClient.withRateLimitRetry(fn, { maxRetries: 2, sleepFn });

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
        expect(sleepFn).toHaveBeenCalledTimes(1);
    });

    it('should throw non-429 errors immediately', async () => {
        const error = new Error('Server Error');
        error.response = { status: 500 };

        const fn = jest.fn().mockRejectedValue(error);
        const sleepFn = jest.fn().mockResolvedValue();

        await expect(githubApiClient.withRateLimitRetry(fn, { maxRetries: 2, sleepFn })).rejects.toThrow('Server Error');
        expect(fn).toHaveBeenCalledTimes(1);
        expect(sleepFn).not.toHaveBeenCalled();
    });

    it('should throw 429 error after exhausting retries', async () => {
        const rateLimitError = new Error('Rate Limited');
        rateLimitError.response = { status: 429, headers: { 'retry-after': '1' } };

        const fn = jest.fn().mockRejectedValue(rateLimitError);
        const sleepFn = jest.fn().mockResolvedValue();

        await expect(githubApiClient.withRateLimitRetry(fn, { maxRetries: 2, sleepFn })).rejects.toThrow('Rate Limited');
        expect(fn).toHaveBeenCalledTimes(3);
        expect(sleepFn).toHaveBeenCalledTimes(2);
    });
});

describe('fetchRepo', () => {
    it('should call GitHub API with correct path', async () => {
        mockGet.mockResolvedValue({ data: { full_name: 'facebook/react' } });

        await githubApiClient.fetchRepo('facebook/react');

        expect(mockGet).toHaveBeenCalledWith('/repos/facebook/react');
    });
});

describe('fetchLatestRelease', () => {
    it('should call GitHub API with correct path', async () => {
        mockGet.mockResolvedValue({ data: { tag_name: 'v1.0.0' } });

        await githubApiClient.fetchLatestRelease('facebook/react');

        expect(mockGet).toHaveBeenCalledWith('/repos/facebook/react/releases/latest');
    });
});

describe('sleep', () => {
    it('should resolve after the given delay', async () => {
        githubApiClient.sleep.mockRestore();

        jest.useFakeTimers();
        const promise = githubApiClient.sleep(1000);
        jest.advanceTimersByTime(1000);
        await promise;
        jest.useRealTimers();
    });
});
