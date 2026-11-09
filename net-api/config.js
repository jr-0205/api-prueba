const fs = require('node:fs');
const path = require('node:path');

// Carga `net-api/.env` sin dependencias. Solo rellena variables que aún no están
// definidas, así que las variables del sistema (dashboard de Render, shell) mandan.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (key in process.env) continue;
    process.env[key] = rawValue.trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
  }
}

loadEnvFile(path.join(__dirname, '.env'));

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
  // Las credenciales de prueba se anuncian en el login y son el modo previsto de
  // recorrer la demo. Se apagan con ENABLE_DEMO_USERS=false.
  enableDemoUsers: process.env.ENABLE_DEMO_USERS?.toLowerCase() !== 'false',
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
