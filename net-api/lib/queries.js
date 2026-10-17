const movieImageColumns = `
  COALESCE(NULLIF(p.imagen_vertical, ''), p.imagen) AS imagen_vertical,
  COALESCE(NULLIF(p.imagen_horizontal, ''), NULLIF(p.imagen_vertical, ''), p.imagen) AS imagen_horizontal,
  COALESCE(NULLIF(p.imagen_vertical, ''), p.imagen) AS imagen`;

const selectMovies = `
  SELECT p.id, p.titulo, p.anio, p.duracion, p.genero_id, g.nombre AS genero,${movieImageColumns},
         p.sinopsis, p.trailer
  FROM peliculas p
  LEFT JOIN generos g ON p.genero_id = g.id`;

module.exports = { movieImageColumns, selectMovies };
