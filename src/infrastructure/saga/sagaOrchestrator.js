const { v4: uuidv4 } = require('uuid');
const logger = require('@/utils/logger');

const DEFAULT_STEP_TIMEOUT = 30000;

function withTimeout(promise,ms, stepName){
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Step "${stepName}" timed out after ${ms} ms`)), ms)),
    ]);
}

const StepStatus = Object.freeze({
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    COMPENSATING: 'compensating',
    COMPENSATED: 'compensated',
    COMPENSATION_FAILED: 'compensation_failed',
});

const SagaStatus = Object.freeze({
    STARTED: 'started',
    COMPLETED: 'completed',
    COMPENSATING: 'compensating',
    COMPENSATED: 'compensated',
    COMPENSATION_FAILED: 'compensation_failed',
});

async function executeSaga(sagaDefinition, initialContext = {}, { sagaLog } = {}) {
    const sagaId = uuidv4();
    const { name, steps } = sagaDefinition;
    const context = { ...initialContext, sagaId };
    const stepResults = [];
    const completedSteps = [];

    const log = (event, meta) => sagaLog
        ? sagaLog.recordSagaEvent({ sagaId, sagaName: name, ...event, ...meta }).catch((err) => {
            logger.warn(`Failed to log saga event for saga [${name}] with ID [${sagaId}]: ${err.message}`, { sagaId, sagaName: name, ...event, ...meta });
        })
        : Promise.resolve();
    const logStep = (event) => sagaLog
        ? sagaLog.recordStepEvent({ sagaId, ...event }).catch((err) => {
            logger.warn(`Failed to log step event for saga [${name}] with ID [${sagaId}]: ${err.message}`, { sagaId, sagaName: name, ...event });
        })
        : Promise.resolve();

    logger.info(`Saga [${name}] started`, { sagaId });
    await log({ status: SagaStatus.STARTED }, { context });

    for (const step of steps) {
        const stepResult = { name: step.name, status: StepStatus.RUNNING };
        stepResults.push(stepResult);

        logger.info(`Saga [${name}] executing step: ${step.name}`, { sagaId });
        await logStep({ stepName: step.name, status: StepStatus.RUNNING });

        try {
            const result = await withTimeout(step.execute(context), step.timeout || DEFAULT_STEP_TIMEOUT, step.name);
            if (result && typeof result === 'object') {Object.assign(context, result);}

            stepResult.status = StepStatus.COMPLETED;
            completedSteps.push(step);
            await logStep({ stepName: step.name, status: StepStatus.COMPLETED });
        } catch (error) {
            stepResult.status = StepStatus.FAILED;
            stepResult.error = error.message;
            logger.error(`Saga [${name}] step failed: ${step.name}`, { sagaId, error: error.message });
            await logStep({ stepName: step.name, status: StepStatus.FAILED, error: error.message });

            await compensate(name, sagaId, completedSteps, context, stepResults, log, logStep);

            const finalStatus = stepResults.some((s) => s.status === StepStatus.COMPENSATION_FAILED)
                ? SagaStatus.COMPENSATION_FAILED
                : SagaStatus.COMPENSATED;

            await log({ status: finalStatus });
            return { sagaId, status: finalStatus, failedStep: step.name, error: error.message, context, stepResults };
        }
    }

    logger.info(`Saga [${name}] completed successfully`, { sagaId });
    await log({ status: SagaStatus.COMPLETED });
    return { sagaId, status: SagaStatus.COMPLETED, context, stepResults };
}

async function compensate(sagaName, sagaId, completedSteps, context, stepResults, log, logStep) {
    logger.warn(`Saga [${sagaName}] starting compensation`, { sagaId, stepsToCompensate: completedSteps.length });
    await log({ status: SagaStatus.COMPENSATING });

    for (const step of [...completedSteps].reverse()) {
        if (!step.compensate) {continue;}

        const stepResult = stepResults.find((s) => s.name === step.name);
        await logStep({ stepName: step.name, status: StepStatus.COMPENSATING });

        try {
            await step.compensate(context);
            if (stepResult) {stepResult.status = StepStatus.COMPENSATED;}
            await logStep({ stepName: step.name, status: StepStatus.COMPENSATED });
        } catch (err) {
            if (stepResult) {stepResult.status = StepStatus.COMPENSATION_FAILED;}
            logger.error(`Saga [${sagaName}] compensation failed: ${step.name}`, { sagaId, error: err.message });
            await logStep({ stepName: step.name, status: StepStatus.COMPENSATION_FAILED, error: err.message });
        }
    }
}

module.exports = { executeSaga, SagaStatus, StepStatus };
