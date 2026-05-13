const axios = require('axios');
const nodemailer = require('nodemailer');
const config = require('@/config');
const logger = require('@/utils/logger');

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

function getErrorDetails(err) {
    if (err && err.response) {
        return {
            status: err.response.status,
            data: err.response.data,
        };
    }

    return {
        message: err && err.message ? err.message : String(err),
    };
}

async function sendWithResend(mailOptions) {
    if (!config.resend.apiKey) {
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
        logger.warn('Failed to send email via Resend API. Falling back to SMTP transport.', getErrorDetails(err));
        return false;
    }
}

async function sendMail(mailOptions) {
    const sentViaResend = await sendWithResend(mailOptions);
    if (!sentViaResend) {
        await getTransporter().sendMail(mailOptions);
    }
}

async function sendConfirmationEmail(email, repo, confirmToken, unsubscribeToken) {
    const confirmUrl = `${config.appUrl}/api/confirm/${confirmToken}`;

    const mailOptions = {
        from: config.smtp.from,
        to: email,
        subject: `Confirm your subscription to ${repo} releases`,
        html: `
      <h2>GitHub Release Notifications</h2>
      <p>You have requested to receive release notifications for <strong>${repo}</strong>.</p>
      <p>Please confirm your subscription by clicking the link below:</p>
      <p><a href="${confirmUrl}">${confirmUrl}</a></p>
    <p><strong>Unsubscribe token:</strong> ${unsubscribeToken}</p>
    <p>You can paste this token in the unsubscribe form in the app.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
    };

    try {
        await sendMail(mailOptions);
        logger.info(`Confirmation email sent to ${email} for repo ${repo}`);
    } catch (err) {
        logger.error(`Failed to send confirmation email to ${email}`, err);
        throw err;
    }
}

async function sendReleaseNotification(email, repo, release, unsubscribeToken) {
    const unsubscribeUrl = `${config.appUrl}/api/unsubscribe/${unsubscribeToken}`;

    const mailOptions = {
        from: config.smtp.from,
        to: email,
        subject: `New release for ${repo}: ${release.tag}`,
        html: `
      <h2>New Release: ${release.name}</h2>
      <p>Repository: <strong>${repo}</strong></p>
      <p>Tag: <strong>${release.tag}</strong></p>
      <p>Published: ${release.publishedAt || 'N/A'}</p>
      <p><a href="${release.url}">View release on GitHub</a></p>
      <hr />
      <p><small>
        <a href="${unsubscribeUrl}">Unsubscribe</a> from notifications for ${repo}.
      </small></p>
    `,
    };

    try {
        await sendMail(mailOptions);
        logger.info(`Release notification sent to ${email} for ${repo}@${release.tag}`);
    } catch (err) {
        logger.error(`Failed to send release notification to ${email}`, err);
        // Do not re-throw — scanner should continue with other subscriptions
    }
}

module.exports = {
    sendConfirmationEmail,
    sendReleaseNotification,
    getTransporter,
    setTransporter,
};
