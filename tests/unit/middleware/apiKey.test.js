const apiKeyAuth = require('@/middleware/apiKey');
const config = require('@/config');

describe('apiKeyAuth middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = { headers: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should skip authentication when API_KEY is not configured', () => {
        const original = config.apiKey;
        config.apiKey = '';

        apiKeyAuth(req, res, next);

        expect(next).toHaveBeenCalled();
        config.apiKey = original;
    });

    it('should return 401 when X-API-Key header is missing', () => {
        const original = config.apiKey;
        config.apiKey = 'secret';

        apiKeyAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Missing X-API-Key header' });
        expect(next).not.toHaveBeenCalled();
        config.apiKey = original;
    });

    it('should return 403 when X-API-Key is invalid', () => {
        const original = config.apiKey;
        config.apiKey = 'secret';
        req.headers['x-api-key'] = 'wrong';

        apiKeyAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid API key' });
        expect(next).not.toHaveBeenCalled();
        config.apiKey = original;
    });

    it('should call next() when X-API-Key matches', () => {
        const original = config.apiKey;
        config.apiKey = 'secret';
        req.headers['x-api-key'] = 'secret';

        apiKeyAuth(req, res, next);

        expect(next).toHaveBeenCalled();
        config.apiKey = original;
    });
});
