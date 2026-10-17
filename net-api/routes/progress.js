const express = require('express');

const { movieImageColumns } = require('../lib/queries');
const { requireSelfOrAdmin } = require('../middleware/auth');
const { parsePositiveInteger } = require('../lib/validation');

const router = express.Router();
const selectProgress = `
  SELECT s.progreso, s.fecha_actualizacion, p.id, p.titulo, p.anio, p.duracion,${movieImageColumns},
         p.sinopsis, p.trailer, g.nombre AS genero
  FROM seguir_viendo s
  INNER JOIN peliculas p ON p.id = s.pelicula_id
  LEFT JOIN generos g ON g.id = p.genero_id
  WHERE s.usuario_id = ?
    AND s.id = (SELECT MAX(s2.id) FROM seguir_viendo s2 WHERE s2.usuario_id = s.usuario_id AND s2.pelicula_id = s.pelicula_id)
  ORDER BY s.fecha_actualizacion DESC`;

function listProgress(req, res, next, userId) {
  req.db.all(selectProgress, [userId], (error, rows) => {
    if (error) return next(error);
    return res.json(rows);
  });
}

router.get('/:usuarioId', requireSelfOrAdmin('usuarioId'), (req, res, next) => {
  const userId = parsePositiveInteger(req.params.usuarioId);
  if (!userId) return res.status(400).json({ error: 'ID de usuario inválido.' });
  return listProgress(req, res, next, userId);
});

router.put('/:usuarioId/:peliculaId', requireSelfOrAdmin('usuarioId'), (req, res, next) => {
  const userId = parsePositiveInteger(req.params.usuarioId);
  const movieId = parsePositiveInteger(req.params.peliculaId);
  const progress = Number(req.body.progreso);
  if (!userId || !movieId || !Number.isInteger(progress) || progress < 0 || progress > 100) {
    return res.status(400).json({ error: 'Usuario, película o progreso inválido; usa un entero entre 0 y 100.' });
  }
  req.db.get('SELECT id FROM peliculas WHERE id = ?', [movieId], (movieError, movie) => {
    if (movieError) return next(movieError);
    if (!movie) return res.status(404).json({ error: 'Película no encontrada.' });
    if (progress === 0 || progress === 100) {
      return req.db.run('DELETE FROM seguir_viendo WHERE usuario_id = ? AND pelicula_id = ?', [userId, movieId], (deleteError) => {
        if (deleteError) return next(deleteError);
        if (progress === 0) return res.json({ completed: false, progreso: 0 });
        req.db.get("SELECT id FROM historial WHERE usuario_id = ? AND pelicula_id = ? AND fecha = DATE('now')", [userId, movieId], (historyError, existing) => {
          if (historyError) return next(historyError);
          if (existing) return res.json({ completed: true, progreso: 100 });
          req.db.run('INSERT INTO historial (usuario_id, pelicula_id) VALUES (?, ?)', [userId, movieId], (insertError) => {
            if (insertError) return next(insertError);
            return res.json({ completed: true, progreso: 100 });
          });
        });
      });
    }

    return req.db.get('SELECT id FROM seguir_viendo WHERE usuario_id = ? AND pelicula_id = ?', [userId, movieId], (readError, existing) => {
      if (readError) return next(readError);
      const query = existing
        ? "UPDATE seguir_viendo SET progreso = ?, fecha_actualizacion = DATETIME('now') WHERE id = ?"
        : 'INSERT INTO seguir_viendo (progreso, usuario_id, pelicula_id) VALUES (?, ?, ?)';
      const params = existing ? [progress, existing.id] : [progress, userId, movieId];
      req.db.run(query, params, (writeError) => {
        if (writeError) return next(writeError);
        return res.json({ completed: false, progreso: progress });
      });
    });
  });
});

router.delete('/:usuarioId/:peliculaId', requireSelfOrAdmin('usuarioId'), (req, res, next) => {
  const userId = parsePositiveInteger(req.params.usuarioId);
  const movieId = parsePositiveInteger(req.params.peliculaId);
  if (!userId || !movieId) return res.status(400).json({ error: 'IDs inválidos.' });
  req.db.run('DELETE FROM seguir_viendo WHERE usuario_id = ? AND pelicula_id = ?', [userId, movieId], function onDelete(error) {
    if (error) return next(error);
    if (this.changes === 0) return res.status(404).json({ error: 'La película no estaba en seguimiento.' });
    return res.status(204).end();
  });
});

module.exports = router;
