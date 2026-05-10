const resendProvider = require('../infrastructure/email/providers/resendProvider');
const smtpProvider = require('../infrastructure/email/providers/smtpProvider');
const emailTemplates = require('@/infrastructure/email/templates');
const config = require('@/config');
const logger = require('@/utils/logger');


async function sendMail(mailOptions) {
    const sentViaResend = await resendProvider.send(mailOptions);
    if (!sentViaResend) {
        await smtpProvider.send(mailOptions);
    }
}

async function sendConfirmationEmail(email, repo, confirmToken, unsubscribeToken) {
    const confirmUrl = `${config.appUrl}/api/confirm/${confirmToken}`;

    const mailOptions = emailTemplates.confirmationEmail(email, repo, confirmUrl, unsubscribeToken);

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

    const mailOptions = emailTemplates.sendReleaseNotification(email, repo, release, unsubscribeUrl);

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
    getTransporter: smtpProvider.getTransporter,
    setTransporter: smtpProvider.setTransporter,
};
