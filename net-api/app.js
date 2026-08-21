const compression = require('compression');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const path = require('node:path');

const config = require('./config');
const { version } = require('./package.json');
const { requireAuth } = require('./middleware/auth');
const { createRateLimit } = require('./middleware/rate-limit');

function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        "img-src": ["'self'", "data:", "https:"],
        "media-src": ["'self'", "https:"],
        "frame-src": ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
      },
    },
  }));
  app.use(compression());
  app.use(cors({ origin: config.corsOrigin.split(',').map((item) => item.trim()) }));
  app.use(express.json({ limit: '64kb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use((req, _res, next) => { req.db = db; next(); });

  app.get('/api/health', (_req, res) => res.json({
    success: true,
    service: 'Comet Movies API',
    version,
  }));
  app.use('/api/settings', require('./routes/settings'));
  app.use('/api/avatars', requireAuth, require('./routes/avatars'));
  app.use('/api/genres', require('./routes/genres'));
  app.use('/api/movies', require('./routes/movies'));
  app.use('/api/login', createRateLimit({ max: 10 }), require('./routes/login'));
  app.use('/api/register', createRateLimit({ max: 5 }), require('./routes/register'));
  app.use('/api/users', requireAuth, require('./routes/users'));
  app.use('/api/favoritos', requireAuth, require('./routes/favoritos'));
  app.use('/api/history', requireAuth, require('./routes/history'));
  app.use('/api/progress', requireAuth, require('./routes/progress'));

  app.use((req, res) => res.status(404).json({ error: `Ruta ${req.method} ${req.originalUrl} no encontrada.` }));
  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  });
  return app;
}

module.exports = { createApp };
