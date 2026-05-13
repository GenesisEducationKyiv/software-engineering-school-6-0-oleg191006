const { query } = require('@/db/connection');

async function findByRepo(repo) {
    const sql = 'SELECT * FROM repositories WHERE repo = $1';
    const { rows } = await query(sql, [repo]);
    return rows[0] || null;
}

async function upsert(repo, lastSeenTag) {
    const sql = `
    INSERT INTO repositories (repo, last_seen_tag, last_checked_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (repo) DO UPDATE
      SET last_seen_tag = $2, last_checked_at = NOW()
    RETURNING *;
  `;
    const { rows } = await query(sql, [repo, lastSeenTag]);
    return rows[0];
}

module.exports = { findByRepo, upsert };