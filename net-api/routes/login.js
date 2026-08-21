const express = require('express');

const config = require('../config');
const { hashPassword, signToken, verifyPassword } = require('../lib/security');
const { validateLogin } = require('../lib/validation');

const router = express.Router();

router.post('/', (req, res, next) => {
  const validation = validateLogin(req.body);
  if (!validation.valid) return res.status(400).json({ error: 'Datos de acceso inválidos.', details: validation.errors });
  const { correo, password } = validation.value;

  const query = `SELECT u.id, u.nombre, u.correo, u.avatar_id,
    COALESCE(a.url, u.imagen) AS imagen, a.nombre AS avatar_nombre, u.rol, u.contraseña
    FROM usuarios u LEFT JOIN avatares a ON a.id = u.avatar_id
    WHERE LOWER(u.correo) = ?`;
  req.db.get(query, [correo], async (error, usuario) => {
    if (error) return next(error);
    try {
      if (!usuario || !await verifyPassword(password, usuario.contraseña)) {
        return res.status(401).json({ error: 'Credenciales incorrectas.' });
      }

      if (!usuario.contraseña.startsWith('scrypt:')) {
        const upgradedHash = await hashPassword(password);
        req.db.run('UPDATE usuarios SET contraseña = ? WHERE id = ?', [upgradedHash, usuario.id]);
      }

      delete usuario.contraseña;
      return res.json({
        message: 'Login exitoso',
        usuario,
        token: signToken({ id: usuario.id, rol: usuario.rol || 'user' }, config.authSecret),
      });
    } catch (authError) {
      return next(authError);
    }
  });
});

module.exports = router;
