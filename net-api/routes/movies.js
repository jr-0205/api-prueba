const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '../db/database.db'));

// Obtener todas las películas
router.get('/', (req, res) => {
    const sql = `
        SELECT p.id, p.titulo, p.anio, p.duracion, g.nombre AS genero, p.imagen, p.sinopsis, p.trailer
        FROM peliculas p
        LEFT JOIN generos g ON p.genero_id = g.id
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Obtener película por ID
router.get('/:id', (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT p.id, p.titulo, p.anio, p.duracion, g.nombre AS genero, p.imagen, p.sinopsis, p.trailer
        FROM peliculas p
        LEFT JOIN generos g ON p.genero_id = g.id
        WHERE p.id = ?
    `;
    db.get(sql, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || {});
    });
});

module.exports = router;
