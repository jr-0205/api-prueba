const path = require('node:path');

function parsePort(value) {
  const port = Number(value || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un entero entre 1 y 65535.');
  }
  return port;
}

function parseMaxSessions(value) {
  const max = Number(value || 3);
  if (!Number.isInteger(max) || max < 1 || max > 100) {
    throw new Error('MAX_SESSIONS_PER_USER debe ser un entero entre 1 y 100.');
  }
  return max;
}

const isProduction = process.env.NODE_ENV === 'production';
const authSecret = process.env.AUTH_SECRET || 'solo-desarrollo-cambia-esta-clave-beta';

if (isProduction && authSecret.length < 32) {
  throw new Error('AUTH_SECRET debe contener al menos 32 caracteres en producción.');
}

module.exports = Object.freeze({
  port: parsePort(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  authSecret,
  databasePath: path.resolve(__dirname, process.env.DATABASE_PATH || 'db/database.db'),
  isProduction,
  sessionTtlSeconds: 60 * 60,
  maxSessionsPerUser: parseMaxSessions(process.env.MAX_SESSIONS_PER_USER),
  enableDemoUsers: !isProduction && process.env.ENABLE_DEMO_USERS !== 'false',
  demoUsers: [
    {
      nombre: 'Alex Morgan',
      correo: process.env.DEMO_ADMIN_EMAIL || 'admin@comet.demo',
      password: process.env.DEMO_ADMIN_PASSWORD || 'Admin2026!',
      rol: 'admin',
    },
    {
      nombre: 'Sofía Reyes',
      correo: process.env.DEMO_USER_EMAIL || 'viewer@comet.demo',
      password: process.env.DEMO_USER_PASSWORD || 'Viewer2026!',
      rol: 'user',
    },
  ],
});

