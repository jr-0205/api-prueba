const express = require('express');

const { hashPassword } = require('../lib/security');
const { validateRegistration } = require('../lib/validation');

const router = express.Router();

router.post('/', async (req, res, next) => {
  const validation = validateRegistration(req.body);
  if (!validation.valid) return res.status(400).json({ error: 'Datos inválidos.', details: validation.errors });
  if (Object.hasOwn(req.body, 'imagen')) {
    return res.status(400).json({ error:'La foto de perfil debe elegirse del catálogo de avatares.' });
  }

  const { nombre, correo, password } = validation.value;
  let passwordHash;
  try {
    passwordHash = await hashPassword(password);
  } catch (error) {
    return next(error);
  }

  req.db.get('SELECT id FROM usuarios WHERE LOWER(correo) = ?', [correo], (checkError, row) => {
    if (checkError) return next(checkError);
    if (row) return res.status(409).json({ error: 'El correo ya está registrado.' });

    req.db.get('SELECT id, nombre, url FROM avatares WHERE activo = 1 ORDER BY id LIMIT 1', [], (avatarError, avatar) => {
      if (avatarError) return next(avatarError);
      if (!avatar) return res.status(503).json({ error:'No hay avatares disponibles para crear la cuenta.' });
      const query = 'INSERT INTO usuarios (nombre, correo, contraseña, imagen, avatar_id, rol) VALUES (?, ?, ?, ?, ?, ?)';
      req.db.run(query, [nombre, correo, passwordHash, null, avatar.id, 'user'], function insertUser(error) {
        if (error) return next(error);
        return res.status(201).json({ id:this.lastID, nombre, correo, avatar_id:avatar.id, avatar_nombre:avatar.nombre, imagen:avatar.url, rol:'user' });
      });
    });
  });
});

module.exports = router;
