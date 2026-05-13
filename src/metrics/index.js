const client = require('prom-client');

let initialized = false;

function initMetrics() {
    if (initialized) {
        return;
    }

    client.collectDefaultMetrics({
        prefix: 'release_watcher_',
    });

    initialized = true;
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
};
