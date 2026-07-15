const {
    httpRequestsTotal,
    httpRequestErrorsTotal,
    httpRequestDurationSeconds,
} = require('@/metrics');

function normalizeRoute(req) {
    if (req.route && req.route.path) {
        return req.baseUrl + req.route.path;
    }
    const url = req.originalUrl || req.url;
    return url.split('?')[0];
}

function metricsMiddleware(req, res, next) {
    if (req.path === '/metrics' || req.path === '/health') {
        return next();
    }

    const start = process.hrtime.bigint();

    res.on('finish', () => {
        const durationNs = Number(process.hrtime.bigint() - start);
        const durationSec = durationNs / 1e9;

        const route = normalizeRoute(req);
        const { method } = req;
        const statusCode = res.statusCode.toString();

        const labels = { method, route, status_code: statusCode };

        httpRequestsTotal.inc(labels);
        httpRequestDurationSeconds.observe(labels, durationSec);

        if (res.statusCode >= 400) {
            httpRequestErrorsTotal.inc(labels);
        }
    });

    next();
}

module.exports = metricsMiddleware;
