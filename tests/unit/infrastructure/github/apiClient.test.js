const { withRateLimitRetry } = require('@/modules/github/githubApiClient');

describe('withRateLimitRetry', () => {
    it('should return result on success', async () => {
        const fn = jest.fn().mockResolvedValue('ok');

        const result = await withRateLimitRetry(fn);

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw non-429 errors immediately', async () => {
        const error = new Error('Server Error');
        error.response = { status: 500 };
        const fn = jest.fn().mockRejectedValue(error);

        await expect(withRateLimitRetry(fn)).rejects.toThrow('Server Error');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 and succeed', async () => {
        const rateLimitError = new Error('Rate Limited');
        rateLimitError.response = { status: 429, headers: { 'retry-after': '1' } };

        const fn = jest.fn()
            .mockRejectedValueOnce(rateLimitError)
            .mockResolvedValueOnce('ok');

        const sleepFn = jest.fn().mockResolvedValue();

        const result = await withRateLimitRetry(fn, { maxRetries: 3, sleepFn });

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
        expect(sleepFn).toHaveBeenCalledTimes(1);
    });

    it('should throw after exhausting retries on 429', async () => {
        const rateLimitError = new Error('Rate Limited');
        rateLimitError.response = { status: 429, headers: { 'retry-after': '1' } };

        const fn = jest.fn().mockRejectedValue(rateLimitError);
        const sleepFn = jest.fn().mockResolvedValue();

        await expect(
            withRateLimitRetry(fn, { maxRetries: 2, sleepFn }),
        ).rejects.toThrow('Rate Limited');

        expect(fn).toHaveBeenCalledTimes(3);
        expect(sleepFn).toHaveBeenCalledTimes(2);
    });
});
