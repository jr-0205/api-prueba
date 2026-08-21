const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.db', (err) => {
  if (err) {
    console.error('No fue posible abrir SQLite:', err.message);
    process.exitCode = 1;
  }
});

db.serialize(() => {
  db.all("PRAGMA table_info(usuarios);", (err, cols) => {
    if (err) {
      console.error('No fue posible inspeccionar usuarios:', err.message);
      process.exitCode = 1;
      return db.close();
    }

    const hasRol = cols.some(c => c.name === 'rol');
    if (!hasRol) {
      db.run("ALTER TABLE usuarios ADD COLUMN rol TEXT DEFAULT 'user';", (err) => {
        if (err) {
          console.error('No fue posible añadir la columna rol:', err.message);
          process.exitCode = 1;
        } else console.log("Columna 'rol' añadida correctamente.");
        db.close();
      });
    } else {
      console.log("La columna 'rol' ya existe; no se requieren cambios.");
      db.close();
    }
  });
});
