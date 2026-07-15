const resendProvider = require('../providers/resendProvider');
const smtpProvider = require('../providers/smtpProvider');
const templates = require('../templates/emailTemplates');
const logger = require('../logger');

async function sendMail(mailOptions) {
    const sentViaResend = await resendProvider.send(mailOptions);
    if (!sentViaResend) {
        await smtpProvider.send(mailOptions);
    }
}

async function sendConfirmation({ to, repo, confirmUrl, unsubscribeToken }) {
    const mailOptions = templates.confirmationEmail({ to, repo, confirmUrl, unsubscribeToken });
    await sendMail(mailOptions);
    logger.info(`Confirmation email sent to ${to} for repo ${repo}`);
}

async function sendRelease({ to, repo, release, unsubscribeUrl }) {
    const mailOptions = templates.releaseNotification({ to, repo, release, unsubscribeUrl });
    await sendMail(mailOptions);
    logger.info(`Release notification sent to ${to} for ${repo}@${release.tag}`);
}

module.exports = {
    sendConfirmation,
    sendRelease,
    getTransporter: smtpProvider.getTransporter,
    setTransporter: smtpProvider.setTransporter,
};
