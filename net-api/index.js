// index.js

const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexión única a SQLite
const dbPath = path.join(__dirname, 'db', 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error conectando a la DB:', err.message);
    } else {
        console.log('✅ DB conectada en', dbPath);
    }
});

// Middleware para inyectar db en todas las rutas
app.use((req, res, next) => {
    req.db = db;
    next();
});

// Rutas modularizadas
app.use('/api/movies', require('./routes/movies')); // Películas
app.use('/api/users', require('./routes/users'));   // Usuarios
app.use('/api/login', require('./routes/login'));   // Login
app.use('/api/register', require('./routes/register')); // Registro
app.use('/api/favoritos', require('./routes/favoritos')); // 👈 FAVORITOS

// Arrancar servidor
app.listen(PORT, () => {
    console.log(`🚀 API corriendo en http://localhost:${PORT}`);
});
