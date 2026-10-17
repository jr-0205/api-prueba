const config = require('../config');
const { all, run } = require('./db');
const { hashPassword } = require('./security');
const { VISUAL_SETTINGS } = require('./visual-settings');

async function bootstrapDatabase(db) {
  await run(db, 'PRAGMA foreign_keys = ON');
  await run(db, `CREATE TABLE IF NOT EXISTS avatares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL COLLATE NOCASE UNIQUE,
    url TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
    creado_en TEXT DEFAULT (DATETIME('now'))
  )`);
  await run(db, `CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    correo TEXT UNIQUE NOT NULL,
    contraseña TEXT NOT NULL,
    imagen TEXT,
    avatar_id INTEGER,
    rol TEXT DEFAULT 'user',
    FOREIGN KEY (avatar_id) REFERENCES avatares(id)
  )`);
  const userColumns = await all(db, 'PRAGMA table_info(usuarios)');
  if (!userColumns.some((column) => column.name === 'rol')) {
    await run(db, "ALTER TABLE usuarios ADD COLUMN rol TEXT DEFAULT 'user'");
  }
  if (!userColumns.some((column) => column.name === 'avatar_id')) {
    await run(db, 'ALTER TABLE usuarios ADD COLUMN avatar_id INTEGER REFERENCES avatares(id)');
  }
  await run(db, `CREATE TABLE IF NOT EXISTS generos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE
  )`);
  await run(db, `CREATE TABLE IF NOT EXISTS peliculas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    anio INTEGER,
    duracion TEXT,
    genero_id INTEGER,
    imagen TEXT,
    imagen_vertical TEXT,
    imagen_horizontal TEXT,
    sinopsis TEXT,
    trailer TEXT,
    FOREIGN KEY (genero_id) REFERENCES generos(id)
  )`);
  const movieColumns = await all(db, 'PRAGMA table_info(peliculas)');
  if (!movieColumns.some((column) => column.name === 'imagen_vertical')) {
    await run(db, 'ALTER TABLE peliculas ADD COLUMN imagen_vertical TEXT');
  }
  if (!movieColumns.some((column) => column.name === 'imagen_horizontal')) {
    await run(db, 'ALTER TABLE peliculas ADD COLUMN imagen_horizontal TEXT');
  }
  await run(db, `UPDATE peliculas
    SET imagen_vertical = COALESCE(NULLIF(imagen_vertical, ''), imagen),
        imagen_horizontal = COALESCE(NULLIF(imagen_horizontal, ''), imagen)
    WHERE imagen IS NOT NULL AND TRIM(imagen) <> ''`);
  await run(db, `CREATE TABLE IF NOT EXISTS favoritos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    pelicula_id INTEGER NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (pelicula_id) REFERENCES peliculas(id),
    UNIQUE(usuario_id, pelicula_id)
  )`);
  await run(db, `CREATE TABLE IF NOT EXISTS historial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    pelicula_id INTEGER NOT NULL,
    fecha TEXT DEFAULT (DATE('now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (pelicula_id) REFERENCES peliculas(id)
  )`);
  await run(db, `CREATE TABLE IF NOT EXISTS seguir_viendo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    pelicula_id INTEGER NOT NULL,
    progreso INTEGER NOT NULL DEFAULT 0,
    fecha_actualizacion TEXT DEFAULT (DATETIME('now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (pelicula_id) REFERENCES peliculas(id)
  )`);
  await run(db, `CREATE TABLE IF NOT EXISTS configuracion_visual (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    actualizado_en TEXT DEFAULT (DATETIME('now'))
  )`);
  await run(db, 'CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios(correo)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_usuarios_avatar_id ON usuarios(avatar_id)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_favoritos_usuario_id ON favoritos(usuario_id)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_peliculas_genero_id ON peliculas(genero_id)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_historial_usuario_fecha ON historial(usuario_id, fecha DESC)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_seguir_viendo_usuario ON seguir_viendo(usuario_id, fecha_actualizacion DESC)');

  for (const [key, setting] of Object.entries(VISUAL_SETTINGS)) {
    await run(
      db,
      'INSERT OR IGNORE INTO configuracion_visual (clave, valor) VALUES (?, ?)',
      [key, setting.defaultValue],
    );
  }

  const defaultAvatars = [
    ['Nova', 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Nova'],
    ['Orion', 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Orion'],
    ['Lyra', 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Lyra'],
    ['Cosmo', 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Cosmo'],
    ['Vega', 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Vega'],
    ['Atlas', 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Atlas'],
  ];
  for (const avatar of defaultAvatars) {
    await run(db, 'INSERT OR IGNORE INTO avatares (nombre, url, activo) VALUES (?, ?, 1)', avatar);
  }
  const avatars = await all(db, 'SELECT id FROM avatares WHERE activo = 1 ORDER BY id');

  if (config.enableDemoUsers) {
    for (const [index, user] of config.demoUsers.entries()) {
      const passwordHash = await hashPassword(user.password);
      const avatarId = avatars[index % avatars.length]?.id || null;
      await run(
        db,
        `INSERT INTO usuarios (nombre, correo, contraseña, imagen, avatar_id, rol)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(correo) DO UPDATE SET nombre = excluded.nombre,
           contraseña = excluded.contraseña, avatar_id = excluded.avatar_id, rol = excluded.rol`,
        [user.nombre, user.correo, passwordHash, null, avatarId, user.rol],
      );
    }
  }

  await run(db, 'PRAGMA optimize');
}

module.exports = { bootstrapDatabase };
