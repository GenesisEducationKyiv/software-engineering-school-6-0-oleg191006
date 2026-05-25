const client = require('prom-client');

let initialized = false;
let metricsInterval = null;

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
    getMetricsPayload,
    getMetricsContentType,
    stopMetrics,
};
