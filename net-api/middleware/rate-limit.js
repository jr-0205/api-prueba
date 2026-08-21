function createRateLimit({ windowMs = 60_000, max = 30 } = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const current = attempts.get(key);
    if (!current || current.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta nuevamente más tarde.' });
    }
    next();
  };
}

module.exports = { createRateLimit };
