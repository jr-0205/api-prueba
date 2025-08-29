// routes/login.js
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Aseguramos la ruta absoluta a la base de datos
const dbPath = path.join(__dirname, '..', 'db', 'database.db');
const db = new sqlite3.Database(dbPath);

router.post('/', (req, res) => {
    const { correo, contraseña } = req.body;

    if (!correo || !contraseña) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    const query = `SELECT id, nombre, correo, imagen, rol 
                   FROM usuarios 
                   WHERE correo = ? AND contraseña = ?`;

    db.get(query, [correo, contraseña], (err, usuario) => {
        if (err) {
            console.error('Error en la consulta:', err.message);
            return res.status(500).json({ error: 'Error en el servidor' });
        }

        if (!usuario) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        res.json({
            message: 'Login exitoso',
            usuario
        });
    });
});

module.exports = router;
