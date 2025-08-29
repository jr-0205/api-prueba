// routes/users.js
const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./db/database.db");

// Obtener todos los usuarios (sin password)
router.get("/", (req, res) => {
  db.all("SELECT id, nombre, correo, imagen FROM usuarios", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Obtener usuario por ID
router.get("/:id", (req, res) => {
  const { id } = req.params;
  const query = "SELECT id, nombre, correo, imagen, rol FROM usuarios WHERE id = ?";
  db.get(query, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(row);
  });
});

// Actualizar datos de usuario por ID
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { nombre, correo, imagen } = req.body;

  if (!nombre || !correo) {
    return res.status(400).json({ error: "Nombre y correo son obligatorios" });
  }

  const query = "UPDATE usuarios SET nombre = ?, correo = ?, imagen = ? WHERE id = ?";
  db.run(
    query,
    [nombre, correo, imagen || 'https://via.placeholder.com/64x64?text=User', id],
    function(err) {
      if (err) return res.status(500).json({ error: "Error al actualizar usuario" });
      res.json({ id, nombre, correo, imagen: imagen || 'https://via.placeholder.com/64x64?text=User' });
    }
  );
});

module.exports = router;
