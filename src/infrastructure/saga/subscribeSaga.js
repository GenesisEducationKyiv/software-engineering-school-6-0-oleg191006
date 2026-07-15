function createSubscribeSaga({ subscriptionRepository, notificationClient, eventPublisher }) {
    return {
        name: 'SubscribeSaga',
        steps: [
            {
                name: 'createSubscription',

                async execute(context) {
                    const { email, repo, confirmToken, unsubscribeToken, lastSeenTag } = context;

                    const subscription = await subscriptionRepository.create({
                        email,
                        repo,
                        confirmToken,
                        unsubscribeToken,
                        lastSeenTag,
                    });

                    return { subscriptionId: subscription.id };
                },

                async compensate(context) {
                    const { subscriptionId } = context;
                    if (subscriptionId) {
                        await subscriptionRepository.remove(subscriptionId);
                    }
                },
            },
            {
                name: 'sendConfirmationEmail',

                async execute(context) {
                    const { email, repo, confirmToken, unsubscribeToken } = context;

                    await notificationClient.sendConfirmationEmail(
                        email, repo, confirmToken, unsubscribeToken,
                    );

                    return { emailSent: true };
                },

                async compensate(context) {
                    const { email, confirmToken } = context;
                    if (eventPublisher && eventPublisher.publishEmailCancellation) {
                        await eventPublisher.publishEmailCancellation({ email, confirmToken });
                    }
                },
            },
        ],
    };
}

module.exports = { createSubscribeSaga };
