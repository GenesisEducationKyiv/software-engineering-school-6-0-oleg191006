const config = require('@/config');
const { API_KEY_MESSAGES } = require('@/constants/messages');

function apiKeyAuth(req, res, next) {

    if (!config.apiKey) {
        return next();
    }

    const provided = req.headers['x-api-key'];

    if (!provided) {
        return res.status(401).json({ error: API_KEY_MESSAGES.MISSING_HEADER });
    }

    if (provided !== config.apiKey) {
        return res.status(403).json({ error: API_KEY_MESSAGES.INVALID_KEY });
    }

    return next();
}

module.exports = apiKeyAuth;
