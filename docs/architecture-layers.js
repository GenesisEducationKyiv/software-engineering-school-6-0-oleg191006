const LAYERS = {
    PRESENTATION: 'presentation',
    APPLICATION: 'application',
    INFRASTRUCTURE: 'infrastructure',
    SHARED: 'shared',
};

const LAYER_HIERARCHY = [
    LAYERS.PRESENTATION,
    LAYERS.APPLICATION,
    LAYERS.INFRASTRUCTURE,
    LAYERS.SHARED,
];

function getAllowedDependencies(layer) {
    const idx = LAYER_HIERARCHY.indexOf(layer);
    return LAYER_HIERARCHY.slice(idx);
}

const FILE_LAYER_MAP = {
    // PRESENTATION LAYER 
    'src/modules/subscription/subscriptionRoutes.js': LAYERS.PRESENTATION,
    'src/app.js': LAYERS.PRESENTATION,
    'src/middleware/apiKey.js': LAYERS.PRESENTATION,
    'src/middleware/metricsMiddleware.js': LAYERS.PRESENTATION,
    'src/middleware/errorHandler.js': LAYERS.PRESENTATION,

    // Notification service presentation
    'services/notification/src/routes/notificationRoutes.js': LAYERS.PRESENTATION,
    'services/notification/src/grpc/handlers/confirmationHandler.js': LAYERS.PRESENTATION,
    'services/notification/src/grpc/handlers/releaseHandler.js': LAYERS.PRESENTATION,
    'services/notification/src/consumers/notificationConsumer.js': LAYERS.PRESENTATION,
    'services/notification/src/grpc/server.js': LAYERS.PRESENTATION,

    // APPLICATION LAYER 
    'src/modules/subscription/subscriptionService.js': LAYERS.APPLICATION,
    'src/modules/subscription/subscriptionValidator.js': LAYERS.APPLICATION,
    'src/modules/github/githubService.js': LAYERS.APPLICATION,
    'src/modules/scanner/scannerService.js': LAYERS.APPLICATION,
    'src/infrastructure/saga/sagaOrchestrator.js': LAYERS.APPLICATION,
    'src/infrastructure/saga/subscribeSaga.js': LAYERS.APPLICATION,

    // Notification service application
    'services/notification/src/services/emailService.js': LAYERS.APPLICATION,

    // INFRASTRUCTURE LAYER
    'src/modules/subscription/subscriptionRepository.js': LAYERS.INFRASTRUCTURE,
    'src/modules/scanner/repoRepository.js': LAYERS.INFRASTRUCTURE,
    'src/modules/github/githubApiClient.js': LAYERS.INFRASTRUCTURE,
    'src/modules/notification/notificationClient.js': LAYERS.INFRASTRUCTURE,
    'src/infrastructure/messageBroker/eventPublisher.js': LAYERS.INFRASTRUCTURE,
    'src/infrastructure/saga/sagaLog.js': LAYERS.INFRASTRUCTURE,
    'src/infrastructure/scheduler.js': LAYERS.INFRASTRUCTURE,
    'src/cache/redisCache.js': LAYERS.INFRASTRUCTURE,
    'src/grpc/clients/notificationClient.js': LAYERS.INFRASTRUCTURE,
    'src/grpc/proto.js': LAYERS.INFRASTRUCTURE,

    // Notification service infrastructure
    'services/notification/src/providers/resendProvider.js': LAYERS.INFRASTRUCTURE,
    'services/notification/src/providers/smtpProvider.js': LAYERS.INFRASTRUCTURE,
    'services/notification/src/grpc/proto.js': LAYERS.INFRASTRUCTURE,

    // SHARED LAYER 
    'src/config/index.js': LAYERS.SHARED,
    'src/utils/logger.js': LAYERS.SHARED,
    'src/utils/validation.js': LAYERS.SHARED,
    'src/constants/messages.js': LAYERS.SHARED,
    'src/metrics/index.js': LAYERS.SHARED,
    'src/db/connection.js': LAYERS.SHARED,
    'src/infrastructure/messageBroker/eventTypes.js': LAYERS.SHARED,
    'shared/grpcProto.js': LAYERS.SHARED,
    'shared/redisConnection.js': LAYERS.SHARED,
    'shared/createLogger.js': LAYERS.SHARED,

    // Notification service shared
    'services/notification/src/config.js': LAYERS.SHARED,
    'services/notification/src/logger.js': LAYERS.SHARED,
    'services/notification/src/templates/emailTemplates.js': LAYERS.SHARED,
    'services/notification/src/consumers/eventTypes.js': LAYERS.SHARED,
    'services/notification/src/utils/errorDetails.js': LAYERS.SHARED,
};

function getLayerForFile(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    for (const [pattern, layer] of Object.entries(FILE_LAYER_MAP)) {
        if (normalized.endsWith(pattern) || normalized.includes(pattern)) {
            return layer;
        }
    }
    return null;
}

function isViolation(sourceLayer, targetLayer) {
    if (!sourceLayer || !targetLayer) {
        return false;
    }
    const allowed = getAllowedDependencies(sourceLayer);
    return !allowed.includes(targetLayer);
}

module.exports = {
    LAYERS,
    LAYER_HIERARCHY,
    FILE_LAYER_MAP,
    getAllowedDependencies,
    getLayerForFile,
    isViolation,
};
