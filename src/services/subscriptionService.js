const { v4: uuidv4 } = require('uuid');
const subscriptionRepo = require('@/repositories/subscriptionRepository');
const githubService = require('./githubService');
const emailService = require('./emailService');
const config = require('@/config');
const { validateEmail, validateRepo, validateToken } = require('@/validators/subscription');
const logger = require('@/utils/logger');
const { createError, assertValid } = require('@/utils/validation');
const { SUBSCRIPTION_MESSAGES } = require('@/constants/messages');


async function subscribe(email, repo) {
    assertValid(validateEmail(email));
    assertValid(validateRepo(repo));

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRepo = repo.trim();

    const existing = await subscriptionRepo.findByEmailAndRepo(normalizedEmail, normalizedRepo);
    if (existing) {
        throw createError(SUBSCRIPTION_MESSAGES.ALREADY_SUBSCRIBED, 409);
    }

    const repoExists = await githubService.checkRepoExists(normalizedRepo);
    if (!repoExists) {
        throw createError(SUBSCRIPTION_MESSAGES.REPO_NOT_FOUND, 404);
    }

    const latestRelease = await githubService.getLatestRelease(normalizedRepo);
    const lastSeenTag = latestRelease ? latestRelease.tag : null;

    const confirmToken = uuidv4();
    const unsubscribeToken = uuidv4();

    const created = await subscriptionRepo.create({
        email: normalizedEmail,
        repo: normalizedRepo,
        confirmToken,
        unsubscribeToken,
        lastSeenTag,
    });

    try {
        await emailService.sendConfirmationEmail(normalizedEmail, normalizedRepo, confirmToken, unsubscribeToken);
    } catch {
        try {
            await subscriptionRepo.remove(created.id);
        } catch (rollbackErr) {
            logger.error('Failed to rollback subscription after email send error', rollbackErr);
        }

        const emailConfigured = Boolean(config.resend.apiKey || (config.smtp.user && config.smtp.pass));
        const message = emailConfigured
            ? SUBSCRIPTION_MESSAGES.EMAIL_SEND_FAILED
            : SUBSCRIPTION_MESSAGES.EMAIL_NOT_CONFIGURED;

        throw createError(message, 503);
    }

    return { message: SUBSCRIPTION_MESSAGES.SUBSCRIBE_SUCCESS };
}

async function confirmSubscription(token) {
    assertValid(validateToken(token));

    const subscription = await subscriptionRepo.findByConfirmToken(token);
    if (!subscription) {
        throw createError(SUBSCRIPTION_MESSAGES.TOKEN_NOT_FOUND, 404);
    }

    if (subscription.confirmed) {
        return { message: SUBSCRIPTION_MESSAGES.ALREADY_CONFIRMED };
    }

    await subscriptionRepo.confirm(subscription.id);
    return { message: SUBSCRIPTION_MESSAGES.CONFIRM_SUCCESS };
}

async function unsubscribe(token) {
    assertValid(validateToken(token));

    const subscription = await subscriptionRepo.findByUnsubscribeToken(token);
    if (!subscription) {
        throw createError(SUBSCRIPTION_MESSAGES.TOKEN_NOT_FOUND, 404);
    }

    if (!subscription.confirmed) {
        throw createError(SUBSCRIPTION_MESSAGES.NOT_CONFIRMED, 409);
    }

    await subscriptionRepo.remove(subscription.id);
    return { message: SUBSCRIPTION_MESSAGES.UNSUBSCRIBE_SUCCESS };
}

async function getSubscriptions(email) {
    assertValid(validateEmail(email));

    const normalizedEmail = email.trim().toLowerCase();
    const subs = await subscriptionRepo.findAllByEmail(normalizedEmail);

    return subs.map(({
        email: subscriptionEmail, repo, confirmed, lastSeenTag,
    }) => ({
        email: subscriptionEmail,
        repo,
        confirmed,
        lastSeenTag,
    }));
}

module.exports = {
    subscribe,
    confirmSubscription,
    unsubscribe,
    getSubscriptions,
};
