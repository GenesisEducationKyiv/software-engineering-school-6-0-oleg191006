const request = require('supertest');
const createApp = require('@/app');
const subscriptionRepo = require('@/repositories/subscriptionRepository');
const githubService = require('@/services/githubService');
const emailService = require('@/services/emailService');
const config = require('@/config');

jest.mock('@/repositories/subscriptionRepository');
jest.mock('@/services/githubService');
jest.mock('@/services/emailService');

let app;
let originalApiKey;

beforeAll(() => {
    originalApiKey = config.apiKey;
    config.apiKey = '';
    app = createApp();
});

afterAll(() => {
    config.apiKey = originalApiKey;
});

afterEach(() => {
    jest.clearAllMocks();
});

describe('POST /api/subscribe', () => {
    it('should return 200 on successful subscription', async () => {
        subscriptionRepo.findByEmailAndRepo.mockResolvedValue(null);
        githubService.checkRepoExists.mockResolvedValue(true);
        githubService.getLatestRelease.mockResolvedValue({ tag: 'v1.0.0' });
        subscriptionRepo.create.mockResolvedValue({ id: 1 });
        emailService.sendConfirmationEmail.mockResolvedValue();

        const res = await request(app)
            .post('/api/subscribe')
            .send({ email: 'test@example.com', repo: 'golang/go' });

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('Confirmation email sent');
    });

    it('should return 400 for invalid repo format', async () => {
        const res = await request(app)
            .post('/api/subscribe')
            .send({ email: 'test@example.com', repo: 'invalid' });

        expect(res.status).toBe(400);
    });

    it('should return 400 for missing email', async () => {
        const res = await request(app)
            .post('/api/subscribe')
            .send({ repo: 'golang/go' });

        expect(res.status).toBe(400);
    });

    it('should return 404 when repo not found on GitHub', async () => {
        subscriptionRepo.findByEmailAndRepo.mockResolvedValue(null);
        githubService.checkRepoExists.mockResolvedValue(false);

        const res = await request(app)
            .post('/api/subscribe')
            .send({ email: 'test@example.com', repo: 'nonexistent/repo' });

        expect(res.status).toBe(404);
    });

    it('should return 409 when already subscribed', async () => {
        subscriptionRepo.findByEmailAndRepo.mockResolvedValue({ id: 1 });

        const res = await request(app)
            .post('/api/subscribe')
            .send({ email: 'test@example.com', repo: 'golang/go' });

        expect(res.status).toBe(409);
    });

    it('should accept application/x-www-form-urlencoded', async () => {
        subscriptionRepo.findByEmailAndRepo.mockResolvedValue(null);
        githubService.checkRepoExists.mockResolvedValue(true);
        githubService.getLatestRelease.mockResolvedValue(null);
        subscriptionRepo.create.mockResolvedValue({ id: 1 });
        emailService.sendConfirmationEmail.mockResolvedValue();

        const res = await request(app)
            .post('/api/subscribe')
            .type('form')
            .send('email=test@example.com&repo=golang/go');

        expect(res.status).toBe(200);
    });
});

describe('GET /api/confirm/:token', () => {
    it('should return 200 on successful confirmation', async () => {
        subscriptionRepo.findByConfirmToken.mockResolvedValue({ id: 1, confirmed: false });
        subscriptionRepo.confirm.mockResolvedValue({ id: 1, confirmed: true });

        const res = await request(app).get('/api/confirm/valid-token');

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('confirmed');
    });

    it('should return 404 for unknown token', async () => {
        subscriptionRepo.findByConfirmToken.mockResolvedValue(null);

        const res = await request(app).get('/api/confirm/unknown-token');

        expect(res.status).toBe(404);
    });
});

describe('GET /api/unsubscribe/:token', () => {
    it('should return 200 on successful unsubscribe', async () => {
        subscriptionRepo.findByUnsubscribeToken.mockResolvedValue({ id: 1, confirmed: true });
        subscriptionRepo.remove.mockResolvedValue();

        const res = await request(app).get('/api/unsubscribe/valid-token');

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('Unsubscribed');
    });

    it('should return 404 for unknown token', async () => {
        subscriptionRepo.findByUnsubscribeToken.mockResolvedValue(null);

        const res = await request(app).get('/api/unsubscribe/unknown-token');

        expect(res.status).toBe(404);
    });

    it('should return 409 when subscription is not confirmed yet', async () => {
        subscriptionRepo.findByUnsubscribeToken.mockResolvedValue({ id: 2, confirmed: false });

        const res = await request(app).get('/api/unsubscribe/pending-token');

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('not confirmed');
    });
});

describe('GET /api/subscriptions', () => {
    it('should return 200 with array of subscriptions', async () => {
        subscriptionRepo.findAllByEmail.mockResolvedValue([
            { email: 'user@example.com', repo: 'golang/go', confirmed: true, last_seen_tag: 'v1.21.0' },
        ]);

        const res = await request(app)
            .get('/api/subscriptions')
            .query({ email: 'user@example.com' });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].repo).toBe('golang/go');
    });

    it('should return 400 for missing email', async () => {
        const res = await request(app).get('/api/subscriptions');

        expect(res.status).toBe(400);
    });

    it('should return 400 for invalid email', async () => {
        const res = await request(app)
            .get('/api/subscriptions')
            .query({ email: 'invalid' });

        expect(res.status).toBe(400);
    });
});

describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});

describe('GET /metrics', () => {
    it('should return 200 with Prometheus metrics payload', async () => {
        const res = await request(app).get('/metrics');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/plain');
        expect(res.text).toContain('release_watcher_process_resident_memory_bytes');
    });
});

describe('API Key Authentication', () => {
    let protectedApp;

    beforeAll(() => {
        config.apiKey = 'test-secret-key';
        protectedApp = createApp();
    });

    afterAll(() => {
        config.apiKey = '';
    });

    it('should return 401 when X-API-Key header is missing', async () => {
        const res = await request(protectedApp)
            .get('/api/subscriptions')
            .query({ email: 'user@example.com' });

        expect(res.status).toBe(401);
    });

    it('should return 403 when X-API-Key is wrong', async () => {
        const res = await request(protectedApp)
            .get('/api/subscriptions')
            .set('X-API-Key', 'wrong-key')
            .query({ email: 'user@example.com' });

        expect(res.status).toBe(403);
    });

    it('should allow access with correct X-API-Key', async () => {
        subscriptionRepo.findAllByEmail.mockResolvedValue([]);

        const res = await request(protectedApp)
            .get('/api/subscriptions')
            .set('X-API-Key', 'test-secret-key')
            .query({ email: 'user@example.com' });

        expect(res.status).toBe(200);
    });

    it('should NOT require API key for /health endpoint', async () => {
        const res = await request(protectedApp).get('/health');

        expect(res.status).toBe(200);
    });

    it('should NOT require API key for /metrics endpoint', async () => {
        const res = await request(protectedApp).get('/metrics');

        expect(res.status).toBe(200);
    });
});
