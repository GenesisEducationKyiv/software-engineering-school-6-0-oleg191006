const EventTypes = Object.freeze({
    SEND_CONFIRMATION_EMAIL: 'send-confirmation-email',
    SEND_RELEASE_NOTIFICATION: 'send-release-notification',
});

const NOTIFICATION_QUEUE = 'notification-queue';

module.exports = { EventTypes, NOTIFICATION_QUEUE };
