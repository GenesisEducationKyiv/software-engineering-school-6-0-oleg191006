require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { query, close } = require('@/db/connection');
const { stopMetrics } = require('@/metrics');
const { runMigrations } = require('@/db/migrations');

jest.mock('axios');
jest.mock('nodemailer');

const mockAxiosInstance = { get: jest.fn() };
const mockSendMail = jest.fn().mockResolvedValue({});

let app;

beforeAll(async () => {
    axios.create.mockReturnValue(mockAxiosInstance);
    nodemailer.createTransport.mockReturnValue({ sendMail: mockSendMail });

    await runMigrations();
    app = require('@/app')();
});

afterEach(async () => {
    await query('TRUNCATE TABLE subscriptions, repositories RESTART IDENTITY CASCADE;');
    jest.clearAllMocks();
});

afterAll(async () => {
    stopMetrics();
    await close();
});

describe('Integration API endpoints', () => {
    test('POST /api/subscribe creates subscription', async () => {
        mockAxiosInstance.get
            .mockResolvedValueOnce({ data: {} })
            .mockResolvedValueOnce({
                data: {
                    tag_name: 'v1.0.0',
                    name: 'v1.0.0',
                    html_url: 'https://github.com/nodejs/node/releases/tag/v1.0.0',
                    published_at: '2024-01-01',
                },
            });

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
        mockAxiosInstance.get.mockRejectedValueOnce({ response: { status: 404 } });

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
