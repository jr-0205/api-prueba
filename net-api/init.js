// addRoleColumn.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.db', (err) => {
  if (err) return console.error(err.message);
  console.log('✅ DB conectada');
});

db.serialize(() => {
  // Verificar si la columna ya existe
  db.all("PRAGMA table_info(usuarios);", (err, cols) => {
    if (err) return console.error(err.message);

    const hasRol = cols.some(c => c.name === 'rol');
    if (!hasRol) {
      db.run("ALTER TABLE usuarios ADD COLUMN rol TEXT DEFAULT 'user';", (err) => {
        if (err) console.error('❌ Error al añadir columna rol:', err.message);
        else console.log("✅ Columna 'rol' añadida con valor por defecto 'user'.");
      });
    } else {
      console.log("🟢 La columna 'rol' ya existe, sin cambios.");
    }
  });
});

// La conexión queda abierta, no se llama a db.close()
