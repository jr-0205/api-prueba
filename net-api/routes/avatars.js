const express = require('express');

const { requireRole } = require('../middleware/auth');
const { normalizeHttpUrl, normalizeName, parsePositiveInteger } = require('../lib/validation');

const router = express.Router();
const selectAvatars = `
  SELECT a.id, a.nombre, a.url, a.activo, COUNT(u.id) AS usuarios
  FROM avatares a
  LEFT JOIN usuarios u ON u.avatar_id = a.id`;

function avatarInput(body = {}) {
  const nombre = normalizeName(body.nombre);
  const url = normalizeHttpUrl(body.url, 1000, 'La imagen del avatar');
  const activo = body.activo === undefined ? 1 : (body.activo === true || body.activo === 1 || body.activo === '1' ? 1 : 0);
  const errors = [];
  if (nombre.length < 2 || nombre.length > 60) errors.push('El nombre debe contener entre 2 y 60 caracteres.');
  if (!url.valid || !url.value) errors.push(url.error || 'La imagen del avatar es obligatoria.');
  return { valid: errors.length === 0, errors, value: { nombre, url:url.value, activo } };
}

function isConstraintError(error) {
  return String(error?.code || '').startsWith('SQLITE_CONSTRAINT') || error?.errno === 19;
}

router.get('/', (req, res, next) => {
  const where = req.user.rol === 'admin' ? '' : ' WHERE a.activo = 1';
  req.db.all(`${selectAvatars}${where} GROUP BY a.id ORDER BY a.nombre COLLATE NOCASE`, [], (error, rows) => {
    if (error) return next(error);
    return res.json(rows.map((avatar) => ({ ...avatar, activo:Boolean(avatar.activo) })));
  });
});

router.post('/', requireRole('admin'), (req, res, next) => {
  const input = avatarInput(req.body);
  if (!input.valid) return res.status(400).json({ error:'Avatar inválido.', details:input.errors });
  const { nombre, url, activo } = input.value;
  req.db.run('INSERT INTO avatares (nombre, url, activo) VALUES (?, ?, ?)', [nombre, url, activo], function insertAvatar(error) {
    if (error && isConstraintError(error)) return res.status(409).json({ error:'Ya existe un avatar con ese nombre.' });
    if (error) return next(error);
    return res.status(201).json({ id:this.lastID, nombre, url, activo:Boolean(activo), usuarios:0 });
  });
});

router.put('/:id', requireRole('admin'), (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  const input = avatarInput(req.body);
  if (!id || !input.valid) return res.status(400).json({ error:'ID o avatar inválido.', details:input.errors });
  const { nombre, url, activo } = input.value;
  req.db.run('UPDATE avatares SET nombre = ?, url = ?, activo = ? WHERE id = ?', [nombre, url, activo, id], function updateAvatar(error) {
    if (error && isConstraintError(error)) return res.status(409).json({ error:'Ya existe un avatar con ese nombre.' });
    if (error) return next(error);
    if (!this.changes) return res.status(404).json({ error:'Avatar no encontrado.' });
    return res.json({ id, nombre, url, activo:Boolean(activo) });
  });
});

router.delete('/:id', requireRole('admin'), (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ error:'ID inválido.' });
  req.db.get('SELECT COUNT(*) AS total FROM usuarios WHERE avatar_id = ?', [id], (readError, usage) => {
    if (readError) return next(readError);
    if (usage.total > 0) return res.status(409).json({ error:'No puedes eliminar un avatar asignado a usuarios; desactívalo primero.' });
    req.db.run('DELETE FROM avatares WHERE id = ?', [id], function deleteAvatar(error) {
      if (error) return next(error);
      if (!this.changes) return res.status(404).json({ error:'Avatar no encontrado.' });
      return res.status(204).end();
    });
  });
});

module.exports = router;
