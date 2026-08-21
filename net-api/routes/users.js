const express = require('express');

const { requireRole, requireSelfOrAdmin } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rate-limit');
const { hashPassword, verifyPassword } = require('../lib/security');
const { parsePositiveInteger, validatePassword, validateProfileUpdate } = require('../lib/validation');

const router = express.Router();
const SAFE_USER_SELECT = `
  SELECT u.id, u.nombre, u.correo, u.avatar_id,
         COALESCE(a.url, u.imagen) AS imagen,
         a.nombre AS avatar_nombre, u.rol
  FROM usuarios u
  LEFT JOIN avatares a ON a.id = u.avatar_id`;

function isConstraintError(error) {
  return String(error?.code || '').startsWith('SQLITE_CONSTRAINT') || error?.errno === 19;
}

function sendUser(req, res, next, id) {
  req.db.get(`${SAFE_USER_SELECT} WHERE u.id = ?`, [id], (error, row) => {
    if (error) return next(error);
    if (!row) return res.status(404).json({ error: 'Usuario no encontrado.' });
    return res.json(row);
  });
}

function updateProfile(req, res, next, id) {
  req.db.get(`${SAFE_USER_SELECT} WHERE u.id = ?`, [id], (readError, current) => {
    if (readError) return next(readError);
    if (!current) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const validation = validateProfileUpdate(req.body, current);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Información de perfil inválida.', details: validation.errors });
    }
    const { nombre, correo, avatarId } = validation.value;
    const writeProfile = () => {
      req.db.get('SELECT id FROM usuarios WHERE LOWER(correo) = ? AND id <> ?', [correo, id], (duplicateError, duplicate) => {
        if (duplicateError) return next(duplicateError);
        if (duplicate) return res.status(409).json({ error: 'El correo ya pertenece a otra cuenta.' });

        req.db.run('UPDATE usuarios SET nombre = ?, correo = ?, avatar_id = ? WHERE id = ?', [nombre, correo, avatarId, id], function onUpdate(error) {
          if (error && isConstraintError(error)) return res.status(409).json({ error: 'El correo ya pertenece a otra cuenta.' });
          if (error) return next(error);
          if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
          return sendUser(req, res, next, id);
        });
      });
    };
    if (!Object.hasOwn(req.body, 'avatarId')) return writeProfile();
    return req.db.get('SELECT id FROM avatares WHERE id = ? AND activo = 1', [avatarId], (avatarError, avatar) => {
      if (avatarError) return next(avatarError);
      if (!avatar) return res.status(400).json({ error:'El avatar seleccionado no existe o no está disponible.' });
      return writeProfile();
    });
  });
}

router.get('/me', (req, res, next) => sendUser(req, res, next, req.user.id));
router.put('/me', (req, res, next) => updateProfile(req, res, next, req.user.id));
router.patch('/me', (req, res, next) => updateProfile(req, res, next, req.user.id));

router.patch('/me/password', createRateLimit({ windowMs: 15 * 60_000, max: 5 }), (req, res, next) => {
  const currentPassword = String(req.body.contraseñaActual || '');
  const newPassword = String(req.body.contraseñaNueva || '');
  const confirmation = String(req.body.confirmacion || '');
  const passwordValidation = validatePassword(newPassword);
  const errors = [...passwordValidation.errors];
  if (!currentPassword || currentPassword.length > 128) errors.unshift('La contraseña actual es obligatoria.');
  if (newPassword !== confirmation) errors.push('La confirmación no coincide con la nueva contraseña.');
  if (errors.length) return res.status(400).json({ error: 'Cambio de contraseña inválido.', details: errors });

  req.db.get('SELECT contraseña FROM usuarios WHERE id = ?', [req.user.id], async (readError, row) => {
    if (readError) return next(readError);
    if (!row) return res.status(404).json({ error: 'Usuario no encontrado.' });
    try {
      if (!await verifyPassword(currentPassword, row.contraseña)) {
        return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
      }
      if (await verifyPassword(newPassword, row.contraseña)) {
        return res.status(409).json({ error: 'La nueva contraseña debe ser diferente a la actual.' });
      }
      const passwordHash = await hashPassword(newPassword);
      req.db.run('UPDATE usuarios SET contraseña = ? WHERE id = ?', [passwordHash, req.user.id], function onPasswordUpdate(error) {
        if (error) return next(error);
        if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
        return res.json({ message: 'Contraseña actualizada correctamente.' });
      });
    } catch (error) {
      return next(error);
    }
  });
});

router.get('/', requireRole('admin'), (req, res, next) => {
  req.db.all(`${SAFE_USER_SELECT} ORDER BY u.nombre COLLATE NOCASE`, [], (error, rows) => {
    if (error) return next(error);
    return res.json(rows);
  });
});

router.get('/:id', requireSelfOrAdmin(), (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido.' });
  return sendUser(req, res, next, id);
});

router.put('/:id', requireSelfOrAdmin(), (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido.' });
  return updateProfile(req, res, next, id);
});

router.patch('/:id', requireSelfOrAdmin(), (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido.' });
  return updateProfile(req, res, next, id);
});

router.patch('/:id/role', requireRole('admin'), (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  const rol = String(req.body.rol || '').trim().toLowerCase();
  if (!id || !['admin', 'user'].includes(rol)) {
    return res.status(400).json({ error: 'ID o rol inválido.' });
  }
  if (id === req.user.id) return res.status(409).json({ error: 'No puedes modificar tu propio rol.' });
  req.db.run('UPDATE usuarios SET rol = ? WHERE id = ?', [rol, id], function updateRole(error) {
    if (error) return next(error);
    if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
    return res.json({ id, rol });
  });
});

module.exports = router;
