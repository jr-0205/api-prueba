const config = require('../config');
const { verifyToken } = require('../lib/security');
const { findActiveSession, touchSession } = require('../lib/sessions');

async function requireAuth(req, res, next) {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  const payload = scheme === 'Bearer' ? verifyToken(token, config.authSecret) : null;
  if (!payload?.jti) return res.status(401).json({ error: 'Autenticación requerida.' });
  try {
    const session = await findActiveSession(req.db, payload.jti);
    if (!session || String(session.usuario_id) !== String(payload.id)) {
      return res.status(401).json({ error: 'La sesión no está activa o fue cerrada.' });
    }
    req.db.get('SELECT id, rol FROM usuarios WHERE id = ?', [payload.id], (error, current) => {
      if (error) return next(error);
      if (!current) return res.status(401).json({ error: 'La cuenta asociada al token ya no existe.' });
      req.user = { ...payload, rol: current.rol || 'user' };
      req.sessionId = payload.jti;
      touchSession(req.db, payload.jti).catch(() => {});
      return next();
    });
  } catch (error) {
    return next(error);
  }
}

function requireSelfOrAdmin(paramName = 'id') {
  return (req, res, next) => {
    if (req.user.rol === 'admin' || String(req.user.id) === String(req.params[paramName])) return next();
    return res.status(403).json({ error: 'No tienes permiso para acceder a este recurso.' });
  };
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.rol === role) return next();
    return res.status(403).json({ error: `Se requiere el rol ${role}.` });
  };
}

module.exports = { requireAuth, requireRole, requireSelfOrAdmin };
