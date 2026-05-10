const logger = require('@/utils/logger');
const githubService = require('./githubService');
const emailService = require('./emailService');
const subscriptionRepo = require('@/repositories/subscriptionRepository');
const repoRepo = require('@/repositories/repoRepository');



async function scanForNewReleases() {
    logger.info('Scanner: starting release check...');

    const repos = await subscriptionRepo.getDistinctConfirmedRepos();

    if (repos.length === 0) {
        logger.info('Scanner: no confirmed subscriptions to check');
        return;
    }

    for (const repo of repos) {
        try {
            await checkRepoForNewRelease(repo);
        } catch (err) {
            logger.error(`Scanner: error checking repo ${repo}`, err);
        }
    }

    logger.info('Scanner: release check completed');
}

async function checkRepoForNewRelease(repo) {
    const latestRelease = await githubService.getLatestRelease(repo);

    if (!latestRelease) {
        logger.debug(`Scanner: no releases found for ${repo}`);
        return;
    }

    const cached = await repoRepo.findByRepo(repo);
    const lastKnownTag = cached ? cached.last_seen_tag : null;

    if (latestRelease.tag === lastKnownTag) {
        logger.debug(`Scanner: ${repo} is up to date (${latestRelease.tag})`);
        return;
    }

    logger.info(`Scanner: new release detected for ${repo}: ${latestRelease.tag} (was: ${lastKnownTag})`);

    await repoRepo.upsert(repo, latestRelease.tag);

    const subscribers = await subscriptionRepo.findConfirmedByRepo(repo);

    for (const sub of subscribers) {
        if (sub.last_seen_tag === latestRelease.tag) {
            continue;
        }

        try {
            await emailService.sendReleaseNotification(
                sub.email,
                repo,
                latestRelease,
                sub.unsubscribe_token,
            );
            await subscriptionRepo.updateLastSeenTag(sub.id, latestRelease.tag);
            logger.info(`Scanner: notified ${sub.email} about ${repo}@${latestRelease.tag}`);
        } catch (err) {
            logger.error(`Scanner: failed to notify ${sub.email} for ${repo}`, err);
        }
    }
}



module.exports = { scanForNewReleases, checkRepoForNewRelease };
