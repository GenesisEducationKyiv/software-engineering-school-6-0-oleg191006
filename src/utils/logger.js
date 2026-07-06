const { ElasticsearchTransport } = require('winston-elasticsearch');
const config = require('@/config');
const {buildLogger} = require('../../shared/createLogger');

const logger = buildLogger({service: 'release-watcher', nodeEnv: config.nodeEnv});

if(process.env.ELASTICSEARCH_URL) {
    const esTransportOpts = new ElasticsearchTransport( {
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
    });
    esTransportOpts.on('error', (err) => {
        logger.error('Elasticsearch transport error', { error: err.message });
    });
    logger.add(esTransportOpts);
}

module.exports = logger;
