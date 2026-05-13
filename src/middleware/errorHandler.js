const logger = require('@/utils/logger');

function errorHandler(err, _req, res, _next) {
    logger.error('Unhandled error', err);

    const status = err.statusCode || err.status || 500;
    const message = err.expose ? err.message : 'Internal server error';

    res.status(status).json({ error: message });
}

module.exports = errorHandler;