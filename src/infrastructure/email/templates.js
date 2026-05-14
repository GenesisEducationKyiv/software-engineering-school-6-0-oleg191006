const config = require('@/config');

function confirmationEmail(email, repo, confirmUrl, unsubscribeToken) {
    return {
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
}

function sendReleaseNotification(email, repo, release, unsubscribeToken) {
    const unsubscribeUrl = `${config.appUrl}/api/unsubscribe/${unsubscribeToken}`;

    return {
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
}

module.exports = {
    confirmationEmail,
    sendReleaseNotification,
};
