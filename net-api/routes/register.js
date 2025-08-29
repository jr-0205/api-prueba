// routes/register.js
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.db');

// Registro de usuario
router.post('/', (req, res) => {
    const { nombre, correo, contraseña, imagen, rol } = req.body;

    if (!nombre || !correo || !contraseña) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    // Verificar si ya existe el correo
    const checkQuery = `SELECT id FROM usuarios WHERE correo = ?`;
    db.get(checkQuery, [correo], (err, row) => {
        if (err) return res.status(500).json({ error: 'Error en la base de datos' });
        if (row) return res.status(409).json({ error: 'El correo ya está registrado' });

        // Insertar nuevo usuario
        const insertQuery = `
            INSERT INTO usuarios (nombre, correo, contraseña, imagen, rol)
            VALUES (?, ?, ?, ?, ?)
        `;
        db.run(
            insertQuery,
            [nombre, correo, contraseña, imagen || 'https://via.placeholder.com/64x64?text=User', rol || 'user'],
            function (err) {
                if (err) return res.status(500).json({ error: 'Error al registrar usuario' });

                res.json({
                    id: this.lastID,
                    nombre,
                    correo,
                    imagen: imagen || 'https://via.placeholder.com/64x64?text=User',
                    rol: rol || 'user'
                });
            }
        );
    });
});

module.exports = router;
