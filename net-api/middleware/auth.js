const config = require('../config');
const { verifyToken } = require('../lib/security');

function requireAuth(req, res, next) {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  const user = scheme === 'Bearer' ? verifyToken(token, config.authSecret) : null;
  if (!user) return res.status(401).json({ error: 'Autenticación requerida.' });
  req.db.get('SELECT id, rol FROM usuarios WHERE id = ?', [user.id], (error, current) => {
    if (error) return next(error);
    if (!current) return res.status(401).json({ error: 'La cuenta asociada al token ya no existe.' });
    req.user = { ...user, rol: current.rol || 'user' };
    return next();
  });
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
