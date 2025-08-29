const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rutas modularizadas
app.use('/api/movies', require('./routes/movies'));
app.use('/api/users', require('./routes/users'));

app.listen(PORT, () => {
    console.log(`API tipo Netflix corriendo en http://localhost:${PORT}`);
});
