const { createLogger, format, transports } = require('winston');
const config = require('@/config');

const logger = createLogger({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        config.nodeEnv === 'production'
            ? format.json()
            : format.combine(format.colorize(), format.simple()),
    ),
    transports: [new transports.Console()],
});

module.exports = logger;
