const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '../db/database.db'));

// Obtener todos los usuarios
router.get('/', (req, res) => {
    db.all('SELECT id, nombre, correo, imagen FROM usuarios', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Obtener un usuario por ID
router.get('/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM usuarios WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(row);
    });
});

// Obtener el usuario con sesión activa
router.get('/activo', (req, res) => {
    db.get('SELECT * FROM usuarios WHERE sesion_activa = 1 LIMIT 1', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'No hay sesión activa' });
        res.json(row);
    });
});

module.exports = router;
