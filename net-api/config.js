const path = require('node:path');

function parsePort(value) {
  const port = Number(value || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un entero entre 1 y 65535.');
  }
  return port;
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

