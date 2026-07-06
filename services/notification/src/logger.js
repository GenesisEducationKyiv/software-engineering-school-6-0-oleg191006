const config = require('./config');
const { buildLogger } = require('../../../shared/createLogger');

module.exports = buildLogger({ service: 'notification-service', nodeEnv: config.nodeEnv });
