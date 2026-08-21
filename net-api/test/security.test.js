const test = require('node:test');
const assert = require('node:assert/strict');

const { hashPassword, verifyPassword, signToken, verifyToken } = require('../lib/security');
const { validateRegistration } = require('../lib/validation');

test('protege y verifica una contraseña', async () => {
  const hash = await hashPassword('una-clave-segura');
  assert.notEqual(hash, 'una-clave-segura');
  assert.equal(await verifyPassword('una-clave-segura', hash), true);
  assert.equal(await verifyPassword('incorrecta', hash), false);
});

test('firma y verifica un token con expiración', () => {
  const token = signToken({ id: 7, rol: 'user' }, 'secreto-de-prueba');
  assert.equal(verifyToken(token, 'secreto-de-prueba').id, 7);
  assert.equal(verifyToken(token, 'otro-secreto'), null);
});

test('rechaza registros incompletos o débiles', () => {
  assert.equal(validateRegistration({ nombre: 'A', correo: 'mal', contraseña: '123' }).valid, false);
  assert.equal(validateRegistration({ nombre: 'Ada', correo: 'ADA@example.com', contraseña: '12345678' }).valid, false);
  assert.equal(validateRegistration({ nombre: 'Ada', correo: 'ADA@example.com', contraseña: 'Segura2026!' }).valid, true);
});
