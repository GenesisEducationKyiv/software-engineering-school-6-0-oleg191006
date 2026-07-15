const client = require('prom-client');

let initialized = false;
let metricsInterval = null;

const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
});

const httpRequestErrorsTotal = new client.Counter({
    name: 'http_request_errors_total',
    help: 'Total number of HTTP request errors (4xx and 5xx)',
    labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDurationSeconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

function initMetrics() {
    if (initialized) {
        return;
    }

    metricsInterval = client.collectDefaultMetrics({
        prefix: 'release_watcher_',
    });

    if (metricsInterval && typeof metricsInterval.unref === 'function') {
        metricsInterval.unref();
    }

    initialized = true;
}

function stopMetrics() {
    if (metricsInterval) {
        clearInterval(metricsInterval);
        metricsInterval = null;
    }
    initialized = false;
}

async function getMetricsPayload() {
    initMetrics();
    return client.register.metrics();
}

function getMetricsContentType() {
    return client.register.contentType;
}

module.exports = {
    initMetrics,
    getMetricsPayload,
    getMetricsContentType,
    stopMetrics,
    httpRequestsTotal,
    httpRequestErrorsTotal,
    httpRequestDurationSeconds,

};
