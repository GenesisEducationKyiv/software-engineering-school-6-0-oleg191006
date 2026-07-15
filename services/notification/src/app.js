const express = require('express');
const cors = require('cors');
const notificationRoutes = require('./routes/notificationRoutes');

function createApp() {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use('/api/notify', notificationRoutes);

    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            service: 'notification',
            timestamp: new Date().toISOString(),
        });
    });

    app.use((err, _req, res, _next) => {
        const status = err.statusCode || 500;
        res.status(status).json({ error: err.message || 'Internal server error' });
    });

    return app;
}

module.exports = createApp;
