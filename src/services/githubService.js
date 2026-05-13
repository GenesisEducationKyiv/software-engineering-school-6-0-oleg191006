const axios = require('axios');
const config = require('@/config');
const logger = require('@/utils/logger');
const redisCache = require('@/cache/redisCache');
const { GITHUB_MESSAGES } = require('@/constants/messages');

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

function normalizeRepo(repo) {
    return repo.trim().toLowerCase();
}

function repoExistsKey(repo) {
    return `github:repo-exists:${normalizeRepo(repo)}`;
}

function latestReleaseKey(repo) {
    return `github:latest-release:${normalizeRepo(repo)}`;
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

async function checkRepoExists(repo) {
    const cacheKey = repoExistsKey(repo);
    const cached = await redisCache.getJson(cacheKey);
    if (typeof cached === 'boolean') {
        return cached;
    }

    try {
        await withRateLimitRetry(() => getClient().get(`/repos/${repo}`));
        await redisCache.setJson(cacheKey, true, config.github.cacheTtlSeconds);
        return true;
    } catch (err) {
        if (err.response?.status === 404) {
            await redisCache.setJson(cacheKey, false, config.github.cacheTtlSeconds);
            return false;
        }
        if (err.response?.status === 429) {
            logger.error('GitHub rate limit exceeded after retries');
            const error = new Error(GITHUB_MESSAGES.RATE_LIMIT_EXCEEDED);
            error.statusCode = 503;
            error.expose = true;
            throw error;
        }
        logger.error('GitHub API error while checking repo', err.message);
        throw err;
    }
}

async function getLatestRelease(repo) {
    const cacheKey = latestReleaseKey(repo);
    const cached = await redisCache.getJson(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    try {
        const { data } = await withRateLimitRetry(() => getClient().get(`/repos/${repo}/releases/latest`));
        const release = {
            tag: data.tag_name,
            name: data.name || data.tag_name,
            url: data.html_url,
            publishedAt: data.published_at,
        };

        await redisCache.setJson(cacheKey, release, config.github.cacheTtlSeconds);
        return release;
    } catch (err) {
        if (err.response?.status === 404) {
            await redisCache.setJson(cacheKey, null, config.github.cacheTtlSeconds);
            return null;
        }
        if (err.response?.status === 429) {
            logger.error('GitHub rate limit exceeded after retries for releases');
            return null;
        }
        logger.error(`Error fetching latest release for ${repo}`, err.message);
        return null;
    }
}

module.exports = { checkRepoExists, getLatestRelease, getClient, withRateLimitRetry, sleep };
