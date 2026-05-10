const axios = require('axios');
const config = require('@/config');
const logger = require('@/utils/logger');

let client = null;

function getClient() {
    if (!client) {
        const headers = {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'notificator-app',
        };

        if (config.github.token) {
            headers.Authorization = `Bearer ${config.github.token}`;
        }

        client = axios.create({
            baseURL: config.github.apiBase,
            timeout: 10000,
            headers,
        });
    }
    return client;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


async function withRateLimitRetry(fn, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (err.response?.status === 429) {
                const raw = parseInt(err.response.headers['retry-after'], 10);
                const retryAfter = Number.isFinite(raw) && raw > 0 ? raw : 60;
                logger.warn(`GitHub API rate limit hit. Retry-After: ${retryAfter}s (attempt ${attempt + 1}/${maxRetries + 1})`);

                if (attempt < maxRetries) {
                    await module.exports.sleep(retryAfter * 1000);
                    continue;
                }
            }
            throw err;
        }
    }
}

async function fetchRepo(repo) {
    return withRateLimitRetry(() => getClient().get(`/repos/${repo}`));
}

async function fetchLatestRelease(repo) {
    return withRateLimitRetry(() => getClient().get(`/repos/${repo}/releases/latest`));
}

module.exports = {
    getClient, sleep, withRateLimitRetry, fetchRepo, fetchLatestRelease,
};
