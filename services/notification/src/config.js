require('dotenv').config();

const config = {
    port: parseInt(process.env.PORT, 10) || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',

    redis: {
        url: process.env.REDIS_URL || '',
    },

    smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        requireTLS: true,
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED === 'true',
        connectionTimeoutMs: parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10) || 10000,
        greetingTimeoutMs: parseInt(process.env.SMTP_GREETING_TIMEOUT_MS, 10) || 10000,
        socketTimeoutMs: parseInt(process.env.SMTP_SOCKET_TIMEOUT_MS, 10) || 15000,
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.EMAIL_FROM || 'GitHub Notificator <noreply@notificator.app>',
    },

    resend: {
        apiKey: process.env.RESEND_API_KEY || '',
        from: process.env.RESEND_FROM || process.env.EMAIL_FROM || 'GitHub Notificator <noreply@notificator.app>',
        timeoutMs: parseInt(process.env.RESEND_TIMEOUT_MS, 10) || 10000,
    },
};

module.exports = config;
