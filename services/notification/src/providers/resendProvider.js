const axios = require('axios');
const config = require('../config');
const logger = require('../logger');
const errorDetails = require('../utils/errorDetails');

function isAvailable() {
    return Boolean(config.resend.apiKey);
}

async function send(mailOptions) {
    if (!isAvailable()) {
        return false;
    }

    try {
        await axios.post(
            'https://api.resend.com/emails',
            {
                from: config.resend.from,
                to: [mailOptions.to],
                subject: mailOptions.subject,
                html: mailOptions.html,
            },
            {
                headers: {
                    Authorization: `Bearer ${config.resend.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: config.resend.timeoutMs,
            },
        );

        return true;
    } catch (err) {
        logger.warn('Failed to send email via Resend API. Falling back to SMTP.', errorDetails(err)); 
        return false;
    }
}

module.exports = { send, isAvailable };
