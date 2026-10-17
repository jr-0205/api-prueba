const express = require('express');

const { movieImageColumns } = require('../lib/queries');
const { requireSelfOrAdmin } = require('../middleware/auth');
const { parsePositiveInteger } = require('../lib/validation');

const router = express.Router();
const selectFavorites = `
  SELECT p.id, p.titulo, p.anio, p.duracion,${movieImageColumns},
         p.sinopsis, p.trailer, g.nombre AS genero
  FROM peliculas p
  INNER JOIN favoritos f ON f.pelicula_id = p.id
  LEFT JOIN generos g ON p.genero_id = g.id
  WHERE f.usuario_id = ?
  ORDER BY p.titulo COLLATE NOCASE`;

function listFavorites(req, res, next, usuarioId) {
  req.db.all(selectFavorites, [usuarioId], (error, rows) => {
    if (error) return next(error);
    return res.json(rows);
  });
}

function relationIds(req, res, next, usuarioParam, movieParam, action) {
  const usuarioId = parsePositiveInteger(usuarioParam);
  const peliculaId = parsePositiveInteger(movieParam);
  if (!usuarioId || !peliculaId) {
    res.status(400).json({ error: 'IDs de usuario o película inválidos.' });
    return null;
  }
  req.db.get('SELECT id FROM usuarios WHERE id = ?', [usuarioId], (userError, user) => {
    if (userError) return next(userError);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    req.db.get('SELECT id FROM peliculas WHERE id = ?', [peliculaId], (movieError, movie) => {
      if (movieError) return next(movieError);
      if (!movie) return res.status(404).json({ error: 'Película no encontrada.' });
      return action(usuarioId, peliculaId);
    });
  });
  return true;
}

router.get('/:usuarioId', requireSelfOrAdmin('usuarioId'), (req, res, next) => {
  const usuarioId = parsePositiveInteger(req.params.usuarioId);
  if (!usuarioId) return res.status(400).json({ error: 'ID de usuario inválido.' });
  return listFavorites(req, res, next, usuarioId);
});

router.put('/:usuarioId/:peliculaId', requireSelfOrAdmin('usuarioId'), (req, res, next) => relationIds(
  req,
  res,
  next,
  req.params.usuarioId,
  req.params.peliculaId,
  (usuarioId, peliculaId) => {
    req.db.run('INSERT OR IGNORE INTO favoritos (usuario_id, pelicula_id) VALUES (?, ?)', [usuarioId, peliculaId], (error) => {
      if (error) return next(error);
      return listFavorites(req, res, next, usuarioId);
    });
  },
));

router.delete('/:usuarioId/:peliculaId', requireSelfOrAdmin('usuarioId'), (req, res, next) => relationIds(
  req,
  res,
  next,
  req.params.usuarioId,
  req.params.peliculaId,
  (usuarioId, peliculaId) => {
    req.db.run('DELETE FROM favoritos WHERE usuario_id = ? AND pelicula_id = ?', [usuarioId, peliculaId], function onDelete(error) {
      if (error) return next(error);
      if (this.changes === 0) return res.status(404).json({ error: 'La película no estaba en favoritos.' });
      return res.status(204).end();
    });
  },
));

// Compatibilidad con clientes anteriores: POST conserva la operación de alternar.
router.post('/:usuarioId', requireSelfOrAdmin('usuarioId'), (req, res, next) => relationIds(
  req,
  res,
  next,
  req.params.usuarioId,
  req.body.peliculaId,
  (usuarioId, peliculaId) => {
    req.db.get('SELECT id FROM favoritos WHERE usuario_id = ? AND pelicula_id = ?', [usuarioId, peliculaId], (checkError, row) => {
      if (checkError) return next(checkError);
      const query = row ? 'DELETE FROM favoritos WHERE id = ?' : 'INSERT INTO favoritos (usuario_id, pelicula_id) VALUES (?, ?)';
      const params = row ? [row.id] : [usuarioId, peliculaId];
      req.db.run(query, params, (writeError) => {
        if (writeError) return next(writeError);
        return listFavorites(req, res, next, usuarioId);
      });
    });
  },
));

module.exports = router;
