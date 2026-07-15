const VALIDATION_MESSAGES = {
    EMAIL_REQUIRED: 'Email is required',
    EMAIL_INVALID: 'Invalid email format',
    REPO_REQUIRED: 'Repository is required',
    REPO_INVALID: 'Invalid repository format. Expected owner/repo (e.g. facebook/react)',
    TOKEN_REQUIRED: 'Token is required',
};

const API_KEY_MESSAGES = {
    MISSING_HEADER: 'Missing X-API-Key header',
    INVALID_KEY: 'Invalid API key',
};

const SUBSCRIPTION_MESSAGES = {
    ALREADY_SUBSCRIBED: 'Email already subscribed to this repository',
    REPO_NOT_FOUND: 'Repository not found on GitHub',
    EMAIL_SEND_FAILED: 'Failed to send confirmation email. Please try again later.',
    EMAIL_NOT_CONFIGURED: 'Email service is not configured on server. Please configure SMTP or Resend settings.',
    TOKEN_NOT_FOUND: 'Token not found',
    NOT_CONFIRMED: 'Subscription is not confirmed yet',
    SUBSCRIBE_SUCCESS: 'Subscription successful. Confirmation email sent.',
    ALREADY_CONFIRMED: 'Subscription already confirmed',
    CONFIRM_SUCCESS: 'Subscription confirmed successfully',
    UNSUBSCRIBE_SUCCESS: 'Unsubscribed successfully',
};

const GITHUB_MESSAGES = {
    RATE_LIMIT_EXCEEDED: 'GitHub API rate limit exceeded. Please try again later.',
};

module.exports = {
    VALIDATION_MESSAGES,
    API_KEY_MESSAGES,
    SUBSCRIPTION_MESSAGES,
    GITHUB_MESSAGES,
};
