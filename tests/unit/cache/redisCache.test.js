describe('redisCache', () => {
    const modulePath = '@/cache/redisCache';

    const loadModule = ({ url }, redisMock) => {
        jest.resetModules();
        jest.doMock('@/config', () => ({
            redis: {
                url,
                connectTimeoutMs: 5000,
            },
        }));

        jest.doMock('ioredis', () => jest.fn(() => redisMock));

        return require(modulePath);
    };

    it('should return undefined when redis is disabled', async () => {
        const redisCache = loadModule({ url: '' });

        await expect(redisCache.getJson('key')).resolves.toBeUndefined();
        await expect(redisCache.setJson('key', { a: 1 }, 10)).resolves.toBeUndefined();
    });

    it('should read and write JSON when redis is ready', async () => {
        const redisClient = {
            status: 'ready',
            get: jest.fn().mockResolvedValue('{"value":42}'),
            set: jest.fn().mockResolvedValue('OK'),
            connect: jest.fn(),
            disconnect: jest.fn(),
        };

        const redisCache = loadModule({ url: 'redis://localhost:6380' }, redisClient);

        await expect(redisCache.getJson('payload')).resolves.toEqual({ value: 42 });
        await expect(redisCache.setJson('payload', { value: 42 }, 30)).resolves.toBeUndefined();
        expect(redisClient.get).toHaveBeenCalledWith('payload');
        expect(redisClient.set).toHaveBeenCalledWith('payload', JSON.stringify({ value: 42 }), 'EX', 30);
    });

    it('should return undefined when JSON parse fails', async () => {
        const redisClient = {
            status: 'ready',
            get: jest.fn().mockResolvedValue('not-json'),
            set: jest.fn(),
            connect: jest.fn(),
            disconnect: jest.fn(),
        };

        const redisCache = loadModule({ url: 'redis://localhost:6380' }, redisClient);

        await expect(redisCache.getJson('bad')).resolves.toBeUndefined();
    });

    it('should not  throw when redis set fails', async () => {
        const redisClient = {
            status: 'ready',
            get: jest.fn(),
            set: jest.fn().mockRejectedValue(new Error('set failed')),
            connect: jest.fn(),
            disconnect: jest.fn(),
        };

        const redisCache = loadModule({ url: 'redis://localhost:6380' }, redisClient);

        await expect(redisCache.setJson('key', { value: 1 }, 10)).resolves.toBeUndefined();
    });
});
