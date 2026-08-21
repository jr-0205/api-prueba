const express = require('express');

const { requireAuth, requireRole } = require('../middleware/auth');
const { parsePositiveInteger } = require('../lib/validation');

const router = express.Router();
const selectGenres = `
  SELECT g.id, g.nombre, COUNT(p.id) AS peliculas
  FROM generos g
  LEFT JOIN peliculas p ON p.genero_id = g.id`;

function genreName(value) {
  const nombre = String(value || '').trim().replace(/\s+/g, ' ');
  return nombre.length >= 2 && nombre.length <= 60 && !/[\u0000-\u001f\u007f]/.test(nombre) ? nombre : null;
}

router.get('/', (req, res, next) => {
  req.db.all(`${selectGenres} GROUP BY g.id, g.nombre ORDER BY g.nombre COLLATE NOCASE`, [], (error, rows) => {
    if (error) return next(error);
    return res.json(rows);
  });
});

router.get('/:id', (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de género inválido.' });
  req.db.get(`${selectGenres} WHERE g.id = ? GROUP BY g.id, g.nombre`, [id], (error, row) => {
    if (error) return next(error);
    if (!row) return res.status(404).json({ error: 'Género no encontrado.' });
    return res.json(row);
  });
});

router.post('/', requireAuth, requireRole('admin'), (req, res, next) => {
  const nombre = genreName(req.body.nombre);
  if (!nombre) return res.status(400).json({ error: 'El género debe contener entre 2 y 60 caracteres válidos.' });
  req.db.get('SELECT id FROM generos WHERE nombre = ? COLLATE NOCASE', [nombre], (readError, duplicate) => {
    if (readError) return next(readError);
    if (duplicate) return res.status(409).json({ error: 'Ese género ya existe.' });
    req.db.run('INSERT INTO generos (nombre) VALUES (?)', [nombre], function onInsert(error) {
      if (error) return next(error);
      return res.status(201).json({ id: this.lastID, nombre, peliculas: 0 });
    });
  });
});

router.put('/:id', requireAuth, requireRole('admin'), (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  const nombre = genreName(req.body.nombre);
  if (!id || !nombre) return res.status(400).json({ error: 'ID o nombre de género inválido.' });
  req.db.get('SELECT id FROM generos WHERE nombre = ? COLLATE NOCASE AND id <> ?', [nombre, id], (readError, duplicate) => {
    if (readError) return next(readError);
    if (duplicate) return res.status(409).json({ error: 'Ese género ya existe.' });
    req.db.run('UPDATE generos SET nombre = ? WHERE id = ?', [nombre, id], function onUpdate(error) {
      if (error) return next(error);
      if (this.changes === 0) return res.status(404).json({ error: 'Género no encontrado.' });
      return res.json({ id, nombre });
    });
  });
});

router.delete('/:id', requireAuth, requireRole('admin'), (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de género inválido.' });
  req.db.get('SELECT COUNT(*) AS total FROM peliculas WHERE genero_id = ?', [id], (readError, usage) => {
    if (readError) return next(readError);
    if (usage.total > 0) return res.status(409).json({ error: 'No puedes eliminar un género que todavía tiene películas.' });
    req.db.run('DELETE FROM generos WHERE id = ?', [id], function onDelete(error) {
      if (error) return next(error);
      if (this.changes === 0) return res.status(404).json({ error: 'Género no encontrado.' });
      return res.status(204).end();
    });
  });
});

module.exports = router;
