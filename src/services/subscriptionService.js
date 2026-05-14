const { v4: uuidv4 } = require('uuid');
const subscriptionRepo = require('@/repositories/subscriptionRepository');
const githubService = require('./githubService');
const emailService = require('./emailService');
const config = require('@/config');
const { validateEmail, validateRepo, validateToken } = require('@/validators/subscription');
const logger = require('@/utils/logger');
const { createError, assertValid } = require('@/utils/validation');
const { SUBSCRIPTION_MESSAGES } = require('@/constants/messages');

function createSubscriptionService(deps = {}) {
    const subscriptionRepository = deps.subscriptionRepo || subscriptionRepo;
    const github = deps.githubService || githubService;
    const email = deps.emailService || emailService;
    const generateToken = deps.generateToken || uuidv4;

    async function subscribe(emailAddr, repoName) {
        assertValid(validateEmail(emailAddr));
        assertValid(validateRepo(repoName));

        const normalizedEmail = emailAddr.trim().toLowerCase();
        const normalizedRepo = repoName.trim();

        const existing = await subscriptionRepository.findByEmailAndRepo(normalizedEmail, normalizedRepo);
        if (existing) {
            throw createError(SUBSCRIPTION_MESSAGES.ALREADY_SUBSCRIBED, 409);
        }

        const repoExists = await github.checkRepoExists(normalizedRepo);
        if (!repoExists) {
            throw createError(SUBSCRIPTION_MESSAGES.REPO_NOT_FOUND, 404);
        }

        const latestRelease = await github.getLatestRelease(normalizedRepo);
        const lastSeenTag = latestRelease ? latestRelease.tag : null;

        const confirmToken = generateToken();
        const unsubscribeToken = generateToken();

        const created = await subscriptionRepository.create({
            email: normalizedEmail,
            repo: normalizedRepo,
            confirmToken,
            unsubscribeToken,
            lastSeenTag,
        });

        try {
            await email.sendConfirmationEmail(normalizedEmail, normalizedRepo, confirmToken, unsubscribeToken);
        } catch {
            try {
                await subscriptionRepository.remove(created.id);
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

        const subscription = await subscriptionRepository.findByConfirmToken(token);
        if (!subscription) {
            throw createError(SUBSCRIPTION_MESSAGES.TOKEN_NOT_FOUND, 404);
        }

        if (subscription.confirmed) {
            return { message: SUBSCRIPTION_MESSAGES.ALREADY_CONFIRMED };
        }

        await subscriptionRepository.confirm(subscription.id);
        return { message: SUBSCRIPTION_MESSAGES.CONFIRM_SUCCESS };
    }

    async function unsubscribe(token) {
        assertValid(validateToken(token));

        const subscription = await subscriptionRepository.findByUnsubscribeToken(token);
        if (!subscription) {
            throw createError(SUBSCRIPTION_MESSAGES.TOKEN_NOT_FOUND, 404);
        }

        if (!subscription.confirmed) {
            throw createError(SUBSCRIPTION_MESSAGES.NOT_CONFIRMED, 409);
        }

        await subscriptionRepository.remove(subscription.id);
        return { message: SUBSCRIPTION_MESSAGES.UNSUBSCRIBE_SUCCESS };
    }

    async function getSubscriptions(emailAddr) {
        assertValid(validateEmail(emailAddr));

        const normalizedEmail = emailAddr.trim().toLowerCase();
        const subs = await subscriptionRepository.findAllByEmail(normalizedEmail);

        return subs.map(({
            email: subscriptionEmail, repo: subRepo, confirmed, last_seen_tag,
        }) => ({
            email: subscriptionEmail,
            repo: subRepo,
            confirmed,
            last_seen_tag,
        }));
    }

    return {
        subscribe,
        confirmSubscription,
        unsubscribe,
        getSubscriptions,
    };
}

const defaultInstance = createSubscriptionService();

module.exports = {
    ...defaultInstance,
    createSubscriptionService,
};
