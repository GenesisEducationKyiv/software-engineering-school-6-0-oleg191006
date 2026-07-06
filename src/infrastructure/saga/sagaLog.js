const { query } = require('@/db/connection');

async function recordSagaEvent({ sagaId, sagaName, status, context, error }) {
    const sql = `
        INSERT INTO saga_executions (saga_id, saga_name, status, context, error)
        VALUES ($1, $2, $3, $4, $5)
    `;
    await query(sql, [
        sagaId,
        sagaName,
        status,
        context ? JSON.stringify(context) : null,
        error || null,
    ]);
}

async function recordStepEvent({ sagaId, stepName, status, error }) {
    const sql = `
        INSERT INTO saga_step_events (saga_id, step_name, status, error)
        VALUES ($1, $2, $3, $4)
    `;
    await query(sql, [sagaId, stepName, status, error || null]);
}

async function findBySagaId(sagaId) {
    const sagaResult = await query(
        'SELECT * FROM saga_executions WHERE saga_id = $1 ORDER BY created_at',
        [sagaId],
    );
    const stepsResult = await query(
        'SELECT * FROM saga_step_events WHERE saga_id = $1 ORDER BY created_at',
        [sagaId],
    );
    return {
        events: sagaResult.rows,
        stepEvents: stepsResult.rows,
    };
}

module.exports = { recordSagaEvent, recordStepEvent, findBySagaId };
