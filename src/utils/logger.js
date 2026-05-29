const { createLogger, format, transports } = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');
const config = require('@/config');

const esTransportOpts = {
    level: 'info',
    indexPrefix: 'release-watcher-logs',
    clientOpts: {
        node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
        maxRetries: 5,
        requestTimeout: 10000,
        sniffOnStart: false,
    },
    bufferLimit: 100,
    flushInterval: 2000,
};

const logger = createLogger({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.json(),
    ),
    defaultMeta: { service: 'release-watcher' },
    transports: [
        new transports.Console({
            format:
                config.nodeEnv === 'production'
                    ? format.json()
                    : format.combine(format.colorize(), format.simple()),
        }),
    ],
});

if (process.env.ELASTICSEARCH_URL) {
    const esTransport = new ElasticsearchTransport(esTransportOpts);
    esTransport.on('error', (err) => {
        console.error('Elasticsearch transport error:', err.message);
    });
    logger.add(esTransport);
}

module.exports = logger;
