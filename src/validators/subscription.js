const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REPO_REGEX = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
const { VALIDATION_MESSAGES } = require('@/constants/messages');


function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: VALIDATION_MESSAGES.EMAIL_REQUIRED };
    }
    if (!EMAIL_REGEX.test(email.trim())) {
        return { valid: false, error: VALIDATION_MESSAGES.EMAIL_INVALID };
    }
    return { valid: true };
}

function validateRepo(repo) {
    if (!repo || typeof repo !== 'string') {
        return { valid: false, error: VALIDATION_MESSAGES.REPO_REQUIRED };
    }
    if (!REPO_REGEX.test(repo.trim())) {
        return { valid: false, error: VALIDATION_MESSAGES.REPO_INVALID };
    }
    return { valid: true };
}

function validateToken(token) {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
        return { valid: false, error: VALIDATION_MESSAGES.TOKEN_REQUIRED };
    }
    return { valid: true };
}

module.exports = { validateEmail, validateRepo, validateToken };