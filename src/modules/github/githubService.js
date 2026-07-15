const githubClient = require('./githubApiClient');
const config = require('@/config');
const logger = require('@/utils/logger');
const redisCache = require('@/cache/redisCache');
const { GITHUB_MESSAGES } = require('@/constants/messages');


function normalizeRepo(repo) {
    return repo.trim().toLowerCase();
}

function repoExistsKey(repo) {
    return `github:repo-exists:${normalizeRepo(repo)}`;
}

function latestReleaseKey(repo) {
    return `github:latest-release:${normalizeRepo(repo)}`;
}

async function checkRepoExists(repo) {
    const cacheKey = repoExistsKey(repo);
    const cached = await redisCache.getJson(cacheKey);
    if (typeof cached === 'boolean') {
        return cached;
    }

    try {
        await githubClient.fetchRepo(repo);
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
        const { data } = await githubClient.fetchLatestRelease(repo);
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

module.exports = { checkRepoExists, getLatestRelease };
