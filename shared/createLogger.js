const {createLogger, format , transports} = require('winston');

function buildLogger({service,nodeEnv='development'}) {
    const isProduction = nodeEnv === 'production';

    return createLogger({
        level: isProduction ? 'info' : 'debug',
        format: format.combine(
            format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
            format.errors({stack: true}),
            format.json()),
        defaultMeta: {service},
        transports:[
            new transports.Console({
                format: isProduction?
                    format.json():
                    format.combine(format.colorize(), format.simple()),
            }),
        ],
    });
}

module.exports = {buildLogger};