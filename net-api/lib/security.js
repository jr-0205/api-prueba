const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedValue) {
  if (!storedValue || !storedValue.startsWith('scrypt:')) {
    return storedValue === password;
  }

  const [, salt, storedHash] = storedValue.split(':');
  if (!salt || !storedHash) return false;
  const derivedKey = await scrypt(password, salt, 64);
  const expected = Buffer.from(storedHash, 'hex');
  return expected.length === derivedKey.length && crypto.timingSafeEqual(expected, derivedKey);
}

function createTokenId() {
  return crypto.randomBytes(24).toString('base64url');
}

function signToken(payload, secret, ttlSeconds = 60 * 60) {
  const data = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyToken(token, secret) {
  const [data, signature] = String(token || '').split('.');
  if (!data || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const givenBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (givenBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(givenBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

module.exports = { createTokenId, hashPassword, verifyPassword, signToken, verifyToken };

