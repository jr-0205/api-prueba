const { get, run } = require('./db');

function toSqlDate(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

async function createSession(db, { userId, jti, expiresAt, userAgent, ip, maxSessions }) {
  await run(db, "DELETE FROM sesiones WHERE expira_en IS NOT NULL AND expira_en < DATETIME('now')");
  await run(
    db,
    'INSERT INTO sesiones (usuario_id, jti, expira_en, user_agent, ip) VALUES (?, ?, ?, ?, ?)',
    [userId, jti, toSqlDate(expiresAt), userAgent || null, ip || null],
  );
  if (Number.isInteger(maxSessions) && maxSessions >= 1) {
    await run(
      db,
      `DELETE FROM sesiones WHERE usuario_id = ? AND id NOT IN (
        SELECT id FROM sesiones WHERE usuario_id = ? ORDER BY creado_en DESC, id DESC LIMIT ?
      )`,
      [userId, userId, maxSessions],
    );
  }
}

function findActiveSession(db, jti) {
  if (!jti) return Promise.resolve(null);
  return get(
    db,
    "SELECT id, usuario_id FROM sesiones WHERE jti = ? AND (expira_en IS NULL OR expira_en >= DATETIME('now'))",
    [jti],
  );
}

async function touchSession(db, jti) {
  await run(
    db,
    "UPDATE sesiones SET ultimo_uso = DATETIME('now') WHERE jti = ? AND ultimo_uso < DATETIME('now', '-60 seconds')",
    [jti],
  );
}

function revokeSession(db, jti) {
  return run(db, 'DELETE FROM sesiones WHERE jti = ?', [jti]);
}

function revokeAllForUser(db, userId) {
  return run(db, 'DELETE FROM sesiones WHERE usuario_id = ?', [userId]);
}

module.exports = { createSession, findActiveSession, revokeAllForUser, revokeSession, touchSession };
