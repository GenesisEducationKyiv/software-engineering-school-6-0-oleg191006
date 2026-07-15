const nodemailer = require('nodemailer');
const config = require('../config');

let transporter;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.secure,
            requireTLS: config.smtp.requireTLS,
            connectionTimeout: config.smtp.connectionTimeoutMs,
            greetingTimeout: config.smtp.greetingTimeoutMs,
            socketTimeout: config.smtp.socketTimeoutMs,
            tls: {
                rejectUnauthorized: config.smtp.rejectUnauthorized,
            },
            auth: {
                user: config.smtp.user,
                pass: config.smtp.pass,
            },
        });
    }
    return transporter;
}

function setTransporter(t) {
    transporter = t;
}

async function send(mailOptions) {
    await getTransporter().sendMail(mailOptions);
}

module.exports = { send, getTransporter, setTransporter };
