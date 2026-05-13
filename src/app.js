const path = require('path');
const express = require('express');
const cors = require('cors');
const apiKeyAuth = require('@/middleware/apiKey');
const errorHandler = require('@/middleware/errorHandler');
const subscriptionRoutes = require('@/routes/subscription');
const { getMetricsPayload, getMetricsContentType } = require('@/metrics');

function createApp() {
    const app = express();

    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(express.static(path.join(__dirname, '..', 'public')));

    app.use('/api', apiKeyAuth);

    app.use('/api', subscriptionRoutes);

    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.get('/metrics', async (_req, res, next) => {
        try {
            const payload = await getMetricsPayload();
            res.set('Content-Type', getMetricsContentType());
            res.send(payload);
        } catch (err) {
            next(err);
        }
    });

    app.use(errorHandler);

    return app;
}

module.exports = createApp;