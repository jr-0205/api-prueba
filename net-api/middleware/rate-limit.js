function createRateLimit({ windowMs = 60_000, max = 30 } = {}) {
  const attempts = new Map();
  let lastSweep = Date.now();

  const sweep = (now) => {
    if (now - lastSweep < windowMs) return;
    for (const [key, entry] of attempts) {
      if (entry.resetAt <= now) attempts.delete(key);
    }
    lastSweep = now;
  };

  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    sweep(now);
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
