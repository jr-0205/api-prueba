// routes/favoritos.js
const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./db/database.db");

// Obtener favoritos de un usuario
router.get("/:usuarioId", (req, res) => {
  const { usuarioId } = req.params;
  const query = `
    SELECT p.id, p.titulo, p.imagen, p.sinopsis, p.trailer, p.genero
    FROM peliculas p
    INNER JOIN favoritos f ON f.pelicula_id = p.id
    WHERE f.usuario_id = ?
  `;
  db.all(query, [usuarioId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Marcar o desmarcar favorito
router.post("/:usuarioId", (req, res) => {
  const { usuarioId } = req.params;
  const { peliculaId } = req.body;

  // Verificar si ya está en favoritos
  const checkQuery = "SELECT id FROM favoritos WHERE usuario_id = ? AND pelicula_id = ?";
  db.get(checkQuery, [usuarioId, peliculaId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    if (row) {
      // Ya está, lo eliminamos (desmarcar)
      const deleteQuery = "DELETE FROM favoritos WHERE id = ?";
      db.run(deleteQuery, [row.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        // Devolver lista actualizada
        db.all(`
          SELECT p.id, p.titulo, p.imagen, p.sinopsis, p.trailer, p.genero
          FROM peliculas p
          INNER JOIN favoritos f ON f.pelicula_id = p.id
          WHERE f.usuario_id = ?
        `, [usuarioId], (err, rows) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(rows);
        });
      });
    } else {
      // No está, lo agregamos (marcar)
      const insertQuery = "INSERT INTO favoritos (usuario_id, pelicula_id) VALUES (?, ?)";
      db.run(insertQuery, [usuarioId, peliculaId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        // Devolver lista actualizada
        db.all(`
          SELECT p.id, p.titulo, p.imagen, p.sinopsis, p.trailer, p.genero
          FROM peliculas p
          INNER JOIN favoritos f ON f.pelicula_id = p.id
          WHERE f.usuario_id = ?
        `, [usuarioId], (err, rows) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(rows);
        });
      });
    }
  });
});

module.exports = router;
