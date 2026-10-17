const express = require('express');

const config = require('../config');
const { get, run } = require('../lib/db');
const { createTokenId, hashPassword, signToken, verifyPassword } = require('../lib/security');
const { createSession } = require('../lib/sessions');
const { validateLogin } = require('../lib/validation');

const router = express.Router();

const LOGIN_QUERY = `SELECT u.id, u.nombre, u.correo, u.avatar_id,
  COALESCE(a.url, u.imagen) AS imagen, a.nombre AS avatar_nombre, u.rol, u.contraseña
  FROM usuarios u LEFT JOIN avatares a ON a.id = u.avatar_id
  WHERE LOWER(u.correo) = ?`;

router.post('/', async (req, res, next) => {
  const validation = validateLogin(req.body);
  if (!validation.valid) return res.status(400).json({ error: 'Datos de acceso inválidos.', details: validation.errors });
  const { correo, password } = validation.value;

  try {
    const usuario = await get(req.db, LOGIN_QUERY, [correo]);
    if (!usuario || !await verifyPassword(password, usuario.contraseña)) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    if (!usuario.contraseña.startsWith('scrypt:')) {
      const upgradedHash = await hashPassword(password);
      await run(req.db, 'UPDATE usuarios SET contraseña = ? WHERE id = ?', [upgradedHash, usuario.id]);
    }

    const ttlSeconds = config.sessionTtlSeconds;
    const jti = createTokenId();
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    await createSession(req.db, {
      userId: usuario.id,
      jti,
      expiresAt,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      maxSessions: config.maxSessionsPerUser,
    });

    delete usuario.contraseña;
    return res.json({
      message: 'Login exitoso',
      usuario,
      token: signToken({ id: usuario.id, rol: usuario.rol || 'user', jti }, config.authSecret, ttlSeconds),
      expira_en: new Date(expiresAt * 1000).toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
