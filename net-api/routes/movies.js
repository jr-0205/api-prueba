const express = require('express');

const { normalizeHttpUrl, parsePositiveInteger } = require('../lib/validation');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const selectMovie = `
  SELECT p.id, p.titulo, p.anio, p.duracion, p.genero_id, g.nombre AS genero,
         COALESCE(NULLIF(p.imagen_vertical, ''), p.imagen) AS imagen_vertical,
         COALESCE(NULLIF(p.imagen_horizontal, ''), NULLIF(p.imagen_vertical, ''), p.imagen) AS imagen_horizontal,
         COALESCE(NULLIF(p.imagen_vertical, ''), p.imagen) AS imagen,
         p.sinopsis, p.trailer
  FROM peliculas p
  LEFT JOIN generos g ON p.genero_id = g.id`;

function run(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

router.get('/', (req, res, next) => {
  req.db.all(selectMovie, [], (error, rows) => {
    if (error) return next(error);
    return res.json(rows);
  });
});

router.get('/:id', (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido.' });
  req.db.get(`${selectMovie} WHERE p.id = ?`, [id], (error, row) => {
    if (error) return next(error);
    if (!row) return res.status(404).json({ error: 'Película no encontrada.' });
    return res.json(row);
  });
});

function movieInput(body = {}) {
  const titulo = String(body.titulo || '').trim();
  const anio = Number(body.anio);
  const duracion = String(body.duracion || '').trim();
  const hasGenre = body.generoId !== undefined && body.generoId !== null && body.generoId !== '';
  const generoId = hasGenre ? parsePositiveInteger(body.generoId) : null;
  const legacyImage = body.imagen;
  const verticalImage = normalizeHttpUrl(body.imagenVertical ?? body.imagen_vertical ?? legacyImage, 1000, 'La imagen vertical');
  const horizontalImage = normalizeHttpUrl(body.imagenHorizontal ?? body.imagen_horizontal ?? legacyImage, 1000, 'La imagen horizontal');
  const sinopsis = String(body.sinopsis || '').trim();
  const trailerUrl = normalizeHttpUrl(body.trailer, 1000, 'El tráiler');
  const errors = [];
  if (titulo.length < 1 || titulo.length > 160) errors.push('El título debe contener entre 1 y 160 caracteres.');
  if (!Number.isInteger(anio) || anio < 1888 || anio > new Date().getFullYear() + 5) errors.push('El año no es válido.');
  if (duracion.length > 40) errors.push('La duración no puede superar 40 caracteres.');
  if (hasGenre && !generoId) errors.push('El género debe ser un identificador positivo.');
  if (!verticalImage.valid) errors.push(verticalImage.error);
  if (!horizontalImage.valid) errors.push(horizontalImage.error);
  if (!trailerUrl.valid) errors.push(trailerUrl.error);
  if (sinopsis.length > 2000) errors.push('La sinopsis no puede superar 2000 caracteres.');
  return {
    valid: errors.length === 0,
    errors,
    value: {
      titulo,
      anio,
      duracion,
      generoId,
      imagenVertical: verticalImage.value,
      imagenHorizontal: horizontalImage.value,
      sinopsis,
      trailer: trailerUrl.value,
    },
  };
}

function withExistingGenre(req, res, next, movie, write) {
  if (!movie.generoId) return write();
  return req.db.get('SELECT id FROM generos WHERE id = ?', [movie.generoId], (error, row) => {
    if (error) return next(error);
    if (!row) return res.status(400).json({ error: 'El género seleccionado no existe.' });
    return write();
  });
}

function movieResponse(id, movie) {
  return {
    id,
    ...movie,
    imagen: movie.imagenVertical,
    imagen_vertical: movie.imagenVertical,
    imagen_horizontal: movie.imagenHorizontal,
  };
}

router.post('/', requireAuth, requireRole('admin'), (req, res, next) => {
  const input = movieInput(req.body);
  if (!input.valid) return res.status(400).json({ error: 'Película inválida.', details: input.errors });
  const movie = input.value;
  return withExistingGenre(req, res, next, movie, () => {
    const query = `INSERT INTO peliculas
      (titulo, anio, duracion, genero_id, imagen, imagen_vertical, imagen_horizontal, sinopsis, trailer)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    req.db.run(query, [movie.titulo, movie.anio, movie.duracion, movie.generoId, movie.imagenVertical, movie.imagenVertical, movie.imagenHorizontal, movie.sinopsis, movie.trailer], function insertMovie(error) {
      if (error) return next(error);
      return res.status(201).json(movieResponse(this.lastID, movie));
    });
  });
});

router.put('/:id', requireAuth, requireRole('admin'), (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  const input = movieInput(req.body);
  if (!id || !input.valid) return res.status(400).json({ error: 'ID o película inválida.', details: input.errors });
  const movie = input.value;
  return withExistingGenre(req, res, next, movie, () => {
    const query = `UPDATE peliculas SET titulo = ?, anio = ?, duracion = ?, genero_id = ?, imagen = ?,
      imagen_vertical = ?, imagen_horizontal = ?, sinopsis = ?, trailer = ?
      WHERE id = ?`;
    req.db.run(query, [movie.titulo, movie.anio, movie.duracion, movie.generoId, movie.imagenVertical, movie.imagenVertical, movie.imagenHorizontal, movie.sinopsis, movie.trailer, id], function updateMovie(error) {
      if (error) return next(error);
      if (this.changes === 0) return res.status(404).json({ error: 'Película no encontrada.' });
      return res.json(movieResponse(id, movie));
    });
  });
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido.' });
  try {
    await run(req.db, 'BEGIN IMMEDIATE');
    await run(req.db, 'DELETE FROM favoritos WHERE pelicula_id = ?', [id]);
    await run(req.db, 'DELETE FROM seguir_viendo WHERE pelicula_id = ?', [id]);
    await run(req.db, 'DELETE FROM historial WHERE pelicula_id = ?', [id]);
    const result = await run(req.db, 'DELETE FROM peliculas WHERE id = ?', [id]);
    if (result.changes === 0) {
      await run(req.db, 'ROLLBACK');
      return res.status(404).json({ error: 'Película no encontrada.' });
    }
    await run(req.db, 'COMMIT');
    return res.status(204).end();
  } catch (error) {
    try { await run(req.db, 'ROLLBACK'); } catch { /* La transacción ya no estaba activa. */ }
    return next(error);
  }
});

module.exports = router;
