const express = require('express');

const { movieImageColumns } = require('../lib/queries');
const { requireSelfOrAdmin } = require('../middleware/auth');
const { parsePositiveInteger } = require('../lib/validation');

const router = express.Router();
const selectHistory = `
  SELECT h.id AS historial_id, h.fecha, p.id, p.titulo, p.anio, p.duracion,${movieImageColumns},
         p.sinopsis, p.trailer, g.nombre AS genero
  FROM historial h
  INNER JOIN peliculas p ON p.id = h.pelicula_id
  LEFT JOIN generos g ON g.id = p.genero_id
  WHERE h.usuario_id = ?
  ORDER BY h.fecha DESC, h.id DESC`;

function listHistory(req, res, next, userId) {
  req.db.all(selectHistory, [userId], (error, rows) => {
    if (error) return next(error);
    return res.json(rows);
  });
}

router.get('/:usuarioId', requireSelfOrAdmin('usuarioId'), (req, res, next) => {
  const userId = parsePositiveInteger(req.params.usuarioId);
  if (!userId) return res.status(400).json({ error: 'ID de usuario inválido.' });
  return listHistory(req, res, next, userId);
});

router.post('/:usuarioId', requireSelfOrAdmin('usuarioId'), (req, res, next) => {
  const userId = parsePositiveInteger(req.params.usuarioId);
  const movieId = parsePositiveInteger(req.body.peliculaId);
  if (!userId || !movieId) return res.status(400).json({ error: 'IDs de usuario o película inválidos.' });
  req.db.get('SELECT id FROM peliculas WHERE id = ?', [movieId], (movieError, movie) => {
    if (movieError) return next(movieError);
    if (!movie) return res.status(404).json({ error: 'Película no encontrada.' });
    req.db.get("SELECT id FROM historial WHERE usuario_id = ? AND pelicula_id = ? AND fecha = DATE('now')", [userId, movieId], (readError, existing) => {
      if (readError) return next(readError);
      if (existing) return listHistory(req, res, next, userId);
      req.db.run('INSERT INTO historial (usuario_id, pelicula_id) VALUES (?, ?)', [userId, movieId], (writeError) => {
        if (writeError) return next(writeError);
        return listHistory(req, res, next, userId);
      });
    });
  });
});

router.delete('/:usuarioId/:historyId', requireSelfOrAdmin('usuarioId'), (req, res, next) => {
  const userId = parsePositiveInteger(req.params.usuarioId);
  const historyId = parsePositiveInteger(req.params.historyId);
  if (!userId || !historyId) return res.status(400).json({ error: 'IDs inválidos.' });
  req.db.run('DELETE FROM historial WHERE id = ? AND usuario_id = ?', [historyId, userId], function onDelete(error) {
    if (error) return next(error);
    if (this.changes === 0) return res.status(404).json({ error: 'Entrada de historial no encontrada.' });
    return res.status(204).end();
  });
});

router.delete('/:usuarioId', requireSelfOrAdmin('usuarioId'), (req, res, next) => {
  const userId = parsePositiveInteger(req.params.usuarioId);
  if (!userId) return res.status(400).json({ error: 'ID de usuario inválido.' });
  req.db.run('DELETE FROM historial WHERE usuario_id = ?', [userId], (error) => {
    if (error) return next(error);
    return res.status(204).end();
  });
});

module.exports = router;
