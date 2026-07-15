const { query } = require('@/db/connection');

async function create({ email, repo, confirmToken, unsubscribeToken, lastSeenTag }) {
    const sql = `
    INSERT INTO subscriptions (email, repo, confirm_token, unsubscribe_token, last_seen_tag)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
    const { rows } = await query(sql, [email, repo, confirmToken, unsubscribeToken, lastSeenTag || null]);
    return rows[0];
}

async function findByEmailAndRepo(email, repo) {
    const sql = 'SELECT * FROM subscriptions WHERE email = $1 AND repo = $2';
    const { rows } = await query(sql, [email, repo]);
    return rows[0] || null;
}

async function findByConfirmToken(token) {
    const sql = 'SELECT * FROM subscriptions WHERE confirm_token = $1';
    const { rows } = await query(sql, [token]);
    return rows[0] || null;
}

async function findByUnsubscribeToken(token) {
    const sql = 'SELECT * FROM subscriptions WHERE unsubscribe_token = $1';
    const { rows } = await query(sql, [token]);
    return rows[0] || null;
}

async function findAllByEmail(email) {
    const sql = 'SELECT * FROM subscriptions WHERE email = $1 ORDER BY created_at DESC';
    const { rows } = await query(sql, [email]);
    return rows;
}

async function findAllConfirmed() {
    const sql = 'SELECT * FROM subscriptions WHERE confirmed = TRUE ORDER BY repo';
    const { rows } = await query(sql);
    return rows;
}

async function confirm(id) {
    const sql = `
    UPDATE subscriptions SET confirmed = TRUE, updated_at = NOW()
    WHERE id = $1 RETURNING *;
  `;
    const { rows } = await query(sql, [id]);
    return rows[0];
}

async function remove(id) {
    const sql = 'DELETE FROM subscriptions WHERE id = $1';
    await query(sql, [id]);
}

async function updateLastSeenTag(id, tag) {
    const sql = `
    UPDATE subscriptions SET last_seen_tag = $1, updated_at = NOW()
    WHERE id = $2;
  `;
    await query(sql, [tag, id]);
}

async function getDistinctConfirmedRepos() {
    const sql = 'SELECT DISTINCT repo FROM subscriptions WHERE confirmed = TRUE';
    const { rows } = await query(sql);
    return rows.map((r) => r.repo);
}

async function findConfirmedByRepo(repo) {
    const sql = 'SELECT * FROM subscriptions WHERE repo = $1 AND confirmed = TRUE';
    const { rows } = await query(sql, [repo]);
    return rows;
}

module.exports = {
    create,
    findByEmailAndRepo,
    findByConfirmToken,
    findByUnsubscribeToken,
    findAllByEmail,
    findAllConfirmed,
    confirm,
    remove,
    updateLastSeenTag,
    getDistinctConfirmedRepos,
    findConfirmedByRepo,
};
