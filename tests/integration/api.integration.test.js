process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5433';
process.env.DB_NAME = process.env.DB_NAME || 'notificator_test';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
process.env.API_KEY = process.env.API_KEY || '';
process.env.SCAN_CRON = process.env.SCAN_CRON || '0 0 1 1 *';

const request = require('supertest');
const { query, close } = require('@/db/connection');
const { runMigrations } = require('@/db/migrations');
const githubService = require('@/services/githubService');
const emailService = require('@/services/emailService');

jest.mock('@/services/githubService', () => ({
    checkRepoExists: jest.fn(),
    getLatestRelease: jest.fn(),
}));

jest.mock('@/services/emailService', () => ({
    sendConfirmationEmail: jest.fn(),
    sendReleaseNotification: jest.fn(),
}));

let app;

beforeAll(async () => {
    await runMigrations();
    app = require('@/app')();
});

afterEach(async () => {
    await query('TRUNCATE TABLE subscriptions, repositories RESTART IDENTITY CASCADE;');
    jest.clearAllMocks();
});

afterAll(async () => {
    await close();
});

describe('Integration API endpoints', () => {
    test('POST /api/subscribe creates subscription', async () => {
        githubService.checkRepoExists.mockResolvedValue(true);
        githubService.getLatestRelease.mockResolvedValue({ tag: 'v1.0.0' });
        emailService.sendConfirmationEmail.mockResolvedValue();

        const res = await request(app)
            .post('/api/subscribe')
            .send({ email: 'User@Example.com', repo: 'nodejs/node' });

        expect(res.status).toBe(200);

        const { rows } = await query('SELECT * FROM subscriptions WHERE email = $1', ['user@example.com']);
        expect(rows).toHaveLength(1);
        expect(rows[0].repo).toBe('nodejs/node');
        expect(rows[0].last_seen_tag).toBe('v1.0.0');
    });

    test('POST /api/subscribe returns 404 when repo not found', async () => {
        githubService.checkRepoExists.mockResolvedValue(false);

        const res = await request(app)
            .post('/api/subscribe')
            .send({ email: 'user@example.com', repo: 'missing/repo' });

        expect(res.status).toBe(404);
    });

    test('GET /api/confirm/:token confirms subscription', async () => {
        await query(
            `INSERT INTO subscriptions (email, repo, confirmed, confirm_token, unsubscribe_token)
             VALUES ($1, $2, $3, $4, $5)`,
            ['user@example.com', 'nodejs/node', false, 'confirm-token', 'unsubscribe-token'],
        );

        const res = await request(app).get('/api/confirm/confirm-token');

        expect(res.status).toBe(200);

        const { rows } = await query('SELECT confirmed FROM subscriptions WHERE confirm_token = $1', ['confirm-token']);
        expect(rows[0].confirmed).toBe(true);
    });

    test('GET /api/unsubscribe/:token removes confirmed subscription', async () => {
        await query(
            `INSERT INTO subscriptions (email, repo, confirmed, confirm_token, unsubscribe_token)
             VALUES ($1, $2, $3, $4, $5)`,
            ['user@example.com', 'nodejs/node', true, 'confirm-token', 'unsubscribe-token'],
        );

        const res = await request(app).get('/api/unsubscribe/unsubscribe-token');

        expect(res.status).toBe(200);

        const { rows } = await query('SELECT * FROM subscriptions');
        expect(rows).toHaveLength(0);
    });

    test('GET /api/subscriptions returns user subscriptions', async () => {
        await query(
            `INSERT INTO subscriptions (email, repo, confirmed, confirm_token, unsubscribe_token, last_seen_tag)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            ['user@example.com', 'nodejs/node', true, 'confirm-token', 'unsubscribe-token', 'v1.0.0'],
        );

        const res = await request(app)
            .get('/api/subscriptions')
            .query({ email: 'user@example.com' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].repo).toBe('nodejs/node');
        expect(res.body[0].last_seen_tag).toBe('v1.0.0');
    });

    test('GET /health returns ok', async () => {
        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    test('GET /metrics returns Prometheus payload', async () => {
        const res = await request(app).get('/metrics');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/plain');
        expect(res.text).toContain('release_watcher_process_resident_memory_bytes');
    });
});
