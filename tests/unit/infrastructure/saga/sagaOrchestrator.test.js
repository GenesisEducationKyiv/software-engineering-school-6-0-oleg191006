jest.mock('@/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));

const { executeSaga, SagaStatus, StepStatus } = require('@/infrastructure/saga/sagaOrchestrator');

describe('sagaOrchestrator - executeSaga', () => {
    let mockSagaLog;

    beforeEach(() => {
        mockSagaLog = {
            recordSagaEvent: jest.fn().mockResolvedValue(),
            recordStepEvent: jest.fn().mockResolvedValue(),
        };
    });

    describe('successful execution', () => {
        it('should execute all steps in order and return COMPLETED', async () => {
            const executionOrder = [];
            const saga = {
                name: 'TestSaga',
                steps: [
                    {
                        name: 'step1',
                        async execute() {
                            executionOrder.push('step1');
                            return { step1Result: 'done' };
                        },
                        async compensate() { executionOrder.push('compensate1'); },
                    },
                    {
                        name: 'step2',
                        async execute(ctx) {
                            executionOrder.push('step2');
                            expect(ctx.step1Result).toBe('done');
                            return { step2Result: 'also done' };
                        },
                        async compensate() { executionOrder.push('compensate2'); },
                    },
                ],
            };

            const result = await executeSaga(saga, { initial: 'data' }, { sagaLog: mockSagaLog });

            expect(result.status).toBe(SagaStatus.COMPLETED);
            expect(result.context.step1Result).toBe('done');
            expect(result.context.step2Result).toBe('also done');
            expect(result.context.initial).toBe('data');
            expect(executionOrder).toEqual(['step1', 'step2']);
            expect(result.stepResults).toHaveLength(2);
            expect(result.stepResults[0].status).toBe(StepStatus.COMPLETED);
            expect(result.stepResults[1].status).toBe(StepStatus.COMPLETED);
        });

        it('should pass context between steps', async () => {
            const saga = {
                name: 'ContextSaga',
                steps: [
                    {
                        name: 'createRecord',
                        async execute() { return { recordId: 42 }; },
                    },
                    {
                        name: 'useRecord',
                        async execute(ctx) {
                            expect(ctx.recordId).toBe(42);
                            return { processed: true };
                        },
                    },
                ],
            };

            const result = await executeSaga(saga);
            expect(result.status).toBe(SagaStatus.COMPLETED);
            expect(result.context.recordId).toBe(42);
            expect(result.context.processed).toBe(true);
        });
    });

    describe('compensation on failure', () => {
        it('should compensate completed steps in reverse order when a step fails', async () => {
            const executionOrder = [];
            const saga = {
                name: 'FailSaga',
                steps: [
                    {
                        name: 'step1',
                        async execute() {
                            executionOrder.push('exec1');
                            return { id: 1 };
                        },
                        async compensate() { executionOrder.push('comp1'); },
                    },
                    {
                        name: 'step2',
                        async execute() {
                            executionOrder.push('exec2');
                            return { id: 2 };
                        },
                        async compensate() { executionOrder.push('comp2'); },
                    },
                    {
                        name: 'step3',
                        async execute() {
                            throw new Error('Step 3 failed');
                        },
                        async compensate() { executionOrder.push('comp3'); },
                    },
                ],
            };

            const result = await executeSaga(saga, {}, { sagaLog: mockSagaLog });

            expect(result.status).toBe(SagaStatus.COMPENSATED);
            expect(result.failedStep).toBe('step3');
            expect(result.error).toBe('Step 3 failed');
            expect(executionOrder).toEqual(['exec1', 'exec2', 'comp2', 'comp1']);
        });

        it('should skip steps without compensate function', async () => {
            const executionOrder = [];
            const saga = {
                name: 'PartialCompSaga',
                steps: [
                    {
                        name: 'step1',
                        async execute() {
                            executionOrder.push('exec1');
                            return {};
                        },
                    },
                    {
                        name: 'step2',
                        async execute() {
                            executionOrder.push('exec2');
                            return {};
                        },
                        async compensate() { executionOrder.push('comp2'); },
                    },
                    {
                        name: 'step3',
                        async execute() { throw new Error('fail'); },
                    },
                ],
            };

            const result = await executeSaga(saga);

            expect(result.status).toBe(SagaStatus.COMPENSATED);
            expect(executionOrder).toEqual(['exec1', 'exec2', 'comp2']);
        });

        it('should return COMPENSATION_FAILED if a compensation throws', async () => {
            const saga = {
                name: 'CompFailSaga',
                steps: [
                    {
                        name: 'step1',
                        async execute() { return {}; },
                        async compensate() { throw new Error('Compensation broke'); },
                    },
                    {
                        name: 'step2',
                        async execute() { throw new Error('Step failed'); },
                    },
                ],
            };

            const result = await executeSaga(saga);

            expect(result.status).toBe(SagaStatus.COMPENSATION_FAILED);
            expect(result.stepResults[0].status).toBe(StepStatus.COMPENSATION_FAILED);
        });
    });

    describe('saga log integration', () => {
        it('should record saga and step events to the log', async () => {
            const saga = {
                name: 'LoggedSaga',
                steps: [
                    {
                        name: 'onlyStep',
                        async execute() { return { done: true }; },
                    },
                ],
            };

            await executeSaga(saga, {}, { sagaLog: mockSagaLog });

            expect(mockSagaLog.recordSagaEvent).toHaveBeenCalledWith(
                expect.objectContaining({ sagaName: 'LoggedSaga', status: SagaStatus.STARTED }),
            );
            expect(mockSagaLog.recordSagaEvent).toHaveBeenCalledWith(
                expect.objectContaining({ sagaName: 'LoggedSaga', status: SagaStatus.COMPLETED }),
            );
            expect(mockSagaLog.recordStepEvent).toHaveBeenCalledWith(
                expect.objectContaining({ stepName: 'onlyStep', status: StepStatus.RUNNING }),
            );
            expect(mockSagaLog.recordStepEvent).toHaveBeenCalledWith(
                expect.objectContaining({ stepName: 'onlyStep', status: StepStatus.COMPLETED }),
            );
        });

        it('should work without saga log (no-op)', async () => {
            const saga = {
                name: 'NoLogSaga',
                steps: [{ name: 's1', async execute() { return {}; } }],
            };

            const result = await executeSaga(saga);
            expect(result.status).toBe(SagaStatus.COMPLETED);
        });
    });

    describe('context isolation', () => {
        it('should include sagaId in context', async () => {
            let capturedCtx;
            const saga = {
                name: 'CtxSaga',
                steps: [{
                    name: 's1',
                    async execute(ctx) {
                        capturedCtx = ctx;
                        return {};
                    },
                }],
            };

            await executeSaga(saga, { foo: 'bar' });
            expect(capturedCtx.sagaId).toBeDefined();
            expect(capturedCtx.foo).toBe('bar');
        });

        it('should not mutate initial context object', async () => {
            const initial = { x: 1 };
            const saga = {
                name: 'MutSaga',
                steps: [{ name: 's1', async execute() { return { y: 2 }; } }],
            };

            await executeSaga(saga, initial);
            expect(initial.y).toBeUndefined();
            expect(initial.sagaId).toBeUndefined();
        });
    });
});
