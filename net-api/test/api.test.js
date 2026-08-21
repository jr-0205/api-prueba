const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3').verbose();

const { createApp } = require('../app');
const { bootstrapDatabase } = require('../lib/bootstrap-db');
const { VISUAL_SETTINGS } = require('../lib/visual-settings');

function exec(db, sql) {
  return new Promise((resolve, reject) => db.exec(sql, (error) => error ? reject(error) : resolve()));
}

function all(db, sql) {
  return new Promise((resolve, reject) => db.all(sql, [], (error, rows) => error ? reject(error) : resolve(rows)));
}

async function withApi(run) {
  const db = new sqlite3.Database(':memory:');
  await exec(db, `
    CREATE TABLE usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, correo TEXT UNIQUE NOT NULL, contraseña TEXT NOT NULL, imagen TEXT, rol TEXT DEFAULT 'user');
    CREATE TABLE generos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL);
    CREATE TABLE peliculas (id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT NOT NULL, anio INTEGER, duracion TEXT, genero_id INTEGER, imagen TEXT, sinopsis TEXT, trailer TEXT);
    CREATE TABLE favoritos (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario_id INTEGER NOT NULL, pelicula_id INTEGER NOT NULL, UNIQUE(usuario_id, pelicula_id));
    CREATE TABLE historial (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario_id INTEGER NOT NULL, pelicula_id INTEGER NOT NULL, fecha TEXT DEFAULT (DATE('now')));
    CREATE TABLE seguir_viendo (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario_id INTEGER NOT NULL, pelicula_id INTEGER NOT NULL, progreso INTEGER NOT NULL DEFAULT 0, fecha_actualizacion TEXT DEFAULT (DATETIME('now')));
  `);
  await bootstrapDatabase(db);
  const server = createApp(db).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try { await run(baseUrl); }
  finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => db.close(resolve));
  }
}

async function login(baseUrl, correo, contraseña) {
  const response = await fetch(`${baseUrl}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo, contraseña }) });
  return { response, body: await response.json() };
}

function authorized(token, method = 'GET', body) {
  return {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

test('el arranque construye todos los módulos sobre una base vacía', async () => {
  const db = new sqlite3.Database(':memory:');
  try {
    await bootstrapDatabase(db);
    const rows = await all(db, "SELECT name FROM sqlite_master WHERE type = 'table'");
    const tables = rows.map((row) => row.name);
    for (const required of ['usuarios', 'avatares', 'generos', 'peliculas', 'favoritos', 'historial', 'seguir_viendo', 'configuracion_visual']) {
      assert.ok(tables.includes(required), `Falta la tabla ${required}`);
    }
    const movieColumns = (await all(db, 'PRAGMA table_info(peliculas)')).map((column) => column.name);
    assert.ok(movieColumns.includes('imagen_vertical'));
    assert.ok(movieColumns.includes('imagen_horizontal'));
    const userColumns = (await all(db, 'PRAGMA table_info(usuarios)')).map((column) => column.name);
    assert.ok(userColumns.includes('avatar_id'));
  } finally {
    await new Promise((resolve) => db.close(resolve));
  }
});

test('la migración conserva la imagen anterior en ambos formatos', async () => {
  const db = new sqlite3.Database(':memory:');
  try {
    const legacyImage = 'https://example.test/assets/legacy-cover.jpg';
    await exec(db, `
      CREATE TABLE peliculas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        anio INTEGER,
        duracion TEXT,
        genero_id INTEGER,
        imagen TEXT,
        sinopsis TEXT,
        trailer TEXT
      );
      INSERT INTO peliculas (titulo, anio, imagen) VALUES ('Película heredada', 2025, '${legacyImage}');
    `);
    await bootstrapDatabase(db);
    const [movie] = await all(db, 'SELECT imagen, imagen_vertical, imagen_horizontal FROM peliculas');
    assert.deepEqual(movie, { imagen:legacyImage, imagen_vertical:legacyImage, imagen_horizontal:legacyImage });
  } finally {
    await new Promise((resolve) => db.close(resolve));
  }
});

test('las películas separan la portada vertical de la imagen horizontal', async () => {
  await withApi(async (baseUrl) => {
    const admin = await login(baseUrl, 'admin@comet.demo', 'Admin2026!');
    const vertical = 'https://example.test/assets/movie-poster.jpg';
    const horizontal = 'https://example.test/assets/movie-backdrop.jpg';
    const response = await fetch(`${baseUrl}/api/movies`, authorized(admin.body.token, 'POST', {
      titulo:'Dos formatos',
      anio:2026,
      imagenVertical:vertical,
      imagenHorizontal:horizontal,
    }));
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.imagen_vertical, vertical);
    assert.equal(created.imagen_horizontal, horizontal);
    assert.equal(created.imagen, vertical);

    const movie = await (await fetch(`${baseUrl}/api/movies/${created.id}`)).json();
    assert.equal(movie.imagen_vertical, vertical);
    assert.equal(movie.imagen_horizontal, horizontal);
    assert.equal(movie.imagen, vertical);

    const unsafeVertical = await fetch(`${baseUrl}/api/movies`, authorized(admin.body.token, 'POST', { titulo:'URL insegura', anio:2026, imagenVertical:'javascript:alert(1)' }));
    assert.equal(unsafeVertical.status, 400);
    const unsafeHorizontal = await fetch(`${baseUrl}/api/movies`, authorized(admin.body.token, 'POST', { titulo:'URL insegura', anio:2026, imagenHorizontal:'ftp://example.test/backdrop.jpg' }));
    assert.equal(unsafeHorizontal.status, 400);
  });
});

test('credenciales demo respetan sus roles y permisos', async () => {
  await withApi(async (baseUrl) => {
    const admin = await login(baseUrl, 'admin@comet.demo', 'Admin2026!');
    const viewer = await login(baseUrl, 'viewer@comet.demo', 'Viewer2026!');
    assert.equal(admin.body.usuario.rol, 'admin');
    assert.equal(viewer.body.usuario.rol, 'user');

    const createMovie = await fetch(`${baseUrl}/api/movies`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.body.token}` }, body: JSON.stringify({ titulo: 'Demo', anio: 2026 }) });
    assert.equal(createMovie.status, 201);
    const denied = await fetch(`${baseUrl}/api/movies`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewer.body.token}` }, body: JSON.stringify({ titulo: 'No permitido', anio: 2026 }) });
    assert.equal(denied.status, 403);
  });
});

test('los cambios de rol se aplican inmediatamente a tokens existentes', async () => {
  await withApi(async (baseUrl) => {
    const admin = await login(baseUrl, 'admin@comet.demo', 'Admin2026!');
    const register = await fetch(`${baseUrl}/api/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nombre:'Ada Beta', correo:'ada@example.test', contraseña:'Segura2026!' }) });
    const user = await register.json();
    const access = await login(baseUrl, 'ada@example.test', 'Segura2026!');

    assert.equal((await fetch(`${baseUrl}/api/users/${user.id}/role`, authorized(admin.body.token, 'PATCH', { rol:'admin' }))).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/movies`, authorized(access.body.token, 'POST', { titulo:'Permitida', anio:2026 }))).status, 201);
    assert.equal((await fetch(`${baseUrl}/api/users/${user.id}/role`, authorized(admin.body.token, 'PATCH', { rol:'user' }))).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/movies`, authorized(access.body.token, 'POST', { titulo:'Denegada', anio:2026 }))).status, 403);
  });
});

test('registro, edición propia y favoritos usan el usuario autenticado', async () => {
  await withApi(async (baseUrl) => {
    const register = await fetch(`${baseUrl}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: 'Ada Beta', correo: 'ada@example.test', contraseña: 'Segura2026!' }) });
    assert.equal(register.status, 201);
    const access = await login(baseUrl, 'ada@example.test', 'Segura2026!');
    const id = access.body.usuario.id;
    const avatars = await (await fetch(`${baseUrl}/api/avatars`, authorized(access.body.token))).json();
    const selected = avatars[1];
    const update = await fetch(`${baseUrl}/api/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access.body.token}` }, body: JSON.stringify({ nombre:'Ada Actualizada', correo:'ada@example.test', avatarId:selected.id }) });
    assert.equal(update.status, 200);
    const updated = await update.json();
    assert.equal(updated.nombre, 'Ada Actualizada');
    assert.equal(updated.avatar_id, selected.id);
    assert.equal(updated.imagen, selected.url);
  });
});

test('la edición de perfil rechaza correo duplicado, correo inválido y enlaces de imagen', async () => {
  await withApi(async (baseUrl) => {
    await fetch(`${baseUrl}/api/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nombre:'Ada Beta', correo:'ada@example.test', contraseña:'Segura2026!' }) });
    await fetch(`${baseUrl}/api/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nombre:'Grace Beta', correo:'grace@example.test', contraseña:'Segura2026!' }) });
    const access = await login(baseUrl, 'ada@example.test', 'Segura2026!');

    const invalidEmail = await fetch(`${baseUrl}/api/users/me`, authorized(access.body.token, 'PATCH', { correo:'correo-invalido' }));
    assert.equal(invalidEmail.status, 400);
    const duplicateEmail = await fetch(`${baseUrl}/api/users/me`, authorized(access.body.token, 'PATCH', { correo:'GRACE@example.test' }));
    assert.equal(duplicateEmail.status, 409);
    const unsafeImage = await fetch(`${baseUrl}/api/users/me`, authorized(access.body.token, 'PATCH', { imagen:'javascript:alert(1)' }));
    assert.equal(unsafeImage.status, 400);
    const unknownAvatar = await fetch(`${baseUrl}/api/users/me`, authorized(access.body.token, 'PATCH', { avatarId:9999 }));
    assert.equal(unknownAvatar.status, 400);

    const partialUpdate = await fetch(`${baseUrl}/api/users/me`, authorized(access.body.token, 'PATCH', { nombre:'  Ada   Actualizada  ' }));
    assert.equal(partialUpdate.status, 200);
    const updated = await partialUpdate.json();
    assert.equal(updated.id, access.body.usuario.id);
    assert.equal(updated.nombre, 'Ada Actualizada');
    assert.equal(updated.correo, 'ada@example.test');
    assert.ok(updated.avatar_id);
    assert.match(updated.imagen, /^https:\/\//);
  });
});

test('el administrador controla los avatares y el usuario sólo puede elegirlos', async () => {
  await withApi(async (baseUrl) => {
    const admin = await login(baseUrl, 'admin@comet.demo', 'Admin2026!');
    const viewer = await login(baseUrl, 'viewer@comet.demo', 'Viewer2026!');
    const avatarData = { nombre:'Cometa QA', url:'https://example.test/avatars/cometa.png', activo:true };

    assert.equal((await fetch(`${baseUrl}/api/avatars`, authorized(viewer.body.token, 'POST', avatarData))).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nombre:'Con enlace', correo:'link@example.test', contraseña:'Segura2026!', imagen:'https://example.test/me.png' }) })).status, 400);

    const create = await fetch(`${baseUrl}/api/avatars`, authorized(admin.body.token, 'POST', avatarData));
    assert.equal(create.status, 201);
    const avatar = await create.json();
    assert.equal((await fetch(`${baseUrl}/api/avatars/${avatar.id}`, authorized(admin.body.token, 'PUT', { ...avatarData, activo:false }))).status, 200);
    assert.equal((await (await fetch(`${baseUrl}/api/avatars`, authorized(viewer.body.token))).json()).some((item) => item.id === avatar.id), false);
    assert.equal((await fetch(`${baseUrl}/api/users/me`, authorized(viewer.body.token, 'PATCH', { avatarId:avatar.id }))).status, 400);

    assert.equal((await fetch(`${baseUrl}/api/avatars/${avatar.id}`, authorized(admin.body.token, 'PUT', avatarData))).status, 200);
    const selection = await fetch(`${baseUrl}/api/users/me`, authorized(viewer.body.token, 'PATCH', { avatarId:avatar.id }));
    assert.equal(selection.status, 200);
    assert.equal((await selection.json()).imagen, avatarData.url);
    assert.equal((await fetch(`${baseUrl}/api/avatars/${avatar.id}`, authorized(admin.body.token, 'DELETE'))).status, 409);
  });
});

test('el cambio de contraseña verifica la actual, fortaleza, confirmación y reutilización', async () => {
  await withApi(async (baseUrl) => {
    await fetch(`${baseUrl}/api/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nombre:'Ada Beta', correo:'ada@example.test', contraseña:'Segura2026!' }) });
    const access = await login(baseUrl, 'ada@example.test', 'Segura2026!');
    const endpoint = `${baseUrl}/api/users/me/password`;

    assert.equal((await fetch(endpoint, authorized(access.body.token, 'PATCH', { contraseñaActual:'Incorrecta2026!', contraseñaNueva:'Nueva2027!', confirmacion:'Nueva2027!' }))).status, 401);
    assert.equal((await fetch(endpoint, authorized(access.body.token, 'PATCH', { contraseñaActual:'Segura2026!', contraseñaNueva:'sin-numeros', confirmacion:'sin-numeros' }))).status, 400);
    assert.equal((await fetch(endpoint, authorized(access.body.token, 'PATCH', { contraseñaActual:'Segura2026!', contraseñaNueva:'Segura2026!', confirmacion:'Segura2026!' }))).status, 409);
    assert.equal((await fetch(endpoint, authorized(access.body.token, 'PATCH', { contraseñaActual:'Segura2026!', contraseñaNueva:'Nueva2027!', confirmacion:'Nueva2027!' }))).status, 200);
    assert.equal((await login(baseUrl, 'ada@example.test', 'Segura2026!')).response.status, 401);
    assert.equal((await login(baseUrl, 'ada@example.test', 'Nueva2027!')).response.status, 200);
  });
});

test('el módulo de géneros completa altas, cambios, conflictos y bajas', async () => {
  await withApi(async (baseUrl) => {
    const admin = await login(baseUrl, 'admin@comet.demo', 'Admin2026!');
    const genreResponse = await fetch(`${baseUrl}/api/genres`, authorized(admin.body.token, 'POST', { nombre:'Drama' }));
    assert.equal(genreResponse.status, 201);
    const genre = await genreResponse.json();
    assert.equal((await fetch(`${baseUrl}/api/genres`, authorized(admin.body.token, 'POST', { nombre:'drama' }))).status, 409);
    assert.equal((await fetch(`${baseUrl}/api/movies`, authorized(admin.body.token, 'POST', { titulo:'Género inexistente', anio:2026, generoId:999 }))).status, 400);

    const movieResponse = await fetch(`${baseUrl}/api/movies`, authorized(admin.body.token, 'POST', { titulo:'Película Drama', anio:2026, generoId:genre.id }));
    assert.equal(movieResponse.status, 201);
    const movie = await movieResponse.json();
    assert.equal((await fetch(`${baseUrl}/api/genres/${genre.id}`, authorized(admin.body.token, 'DELETE'))).status, 409);
    assert.equal((await fetch(`${baseUrl}/api/genres/${genre.id}`, authorized(admin.body.token, 'PUT', { nombre:'Drama histórico' }))).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/movies/${movie.id}`, authorized(admin.body.token, 'DELETE'))).status, 204);
    assert.equal((await fetch(`${baseUrl}/api/genres/${genre.id}`, authorized(admin.body.token, 'DELETE'))).status, 204);
  });
});

test('favoritos ofrece altas idempotentes, bajas explícitas y control de propietario', async () => {
  await withApi(async (baseUrl) => {
    const admin = await login(baseUrl, 'admin@comet.demo', 'Admin2026!');
    const movieResponse = await fetch(`${baseUrl}/api/movies`, authorized(admin.body.token, 'POST', { titulo:'Favorita', anio:2026 }));
    const movie = await movieResponse.json();
    const adaResponse = await fetch(`${baseUrl}/api/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nombre:'Ada Beta', correo:'ada@example.test', contraseña:'Segura2026!' }) });
    const bobResponse = await fetch(`${baseUrl}/api/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nombre:'Bob Beta', correo:'bob@example.test', contraseña:'Segura2026!' }) });
    const ada = await adaResponse.json();
    const bob = await bobResponse.json();
    const access = await login(baseUrl, 'ada@example.test', 'Segura2026!');
    const endpoint = `${baseUrl}/api/favoritos/${ada.id}/${movie.id}`;

    const firstAdd = await fetch(endpoint, authorized(access.body.token, 'PUT'));
    assert.equal(firstAdd.status, 200);
    assert.equal((await firstAdd.json()).length, 1);
    const secondAdd = await fetch(endpoint, authorized(access.body.token, 'PUT'));
    assert.equal((await secondAdd.json()).length, 1);
    assert.equal((await fetch(`${baseUrl}/api/favoritos/${bob.id}/${movie.id}`, authorized(access.body.token, 'PUT'))).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/favoritos/${ada.id}/9999`, authorized(access.body.token, 'PUT'))).status, 404);
    assert.equal((await fetch(endpoint, authorized(access.body.token, 'DELETE'))).status, 204);
    assert.equal((await fetch(endpoint, authorized(access.body.token, 'DELETE'))).status, 404);
  });
});

test('seguir viendo valida progreso y mueve una película terminada al historial', async () => {
  await withApi(async (baseUrl) => {
    const admin = await login(baseUrl, 'admin@comet.demo', 'Admin2026!');
    const movieResponse = await fetch(`${baseUrl}/api/movies`, authorized(admin.body.token, 'POST', { titulo:'En progreso', anio:2026 }));
    const movie = await movieResponse.json();
    const register = await fetch(`${baseUrl}/api/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nombre:'Ada Beta', correo:'ada@example.test', contraseña:'Segura2026!' }) });
    const user = await register.json();
    const access = await login(baseUrl, 'ada@example.test', 'Segura2026!');
    const progressUrl = `${baseUrl}/api/progress/${user.id}/${movie.id}`;

    assert.equal((await fetch(progressUrl, authorized(access.body.token, 'PUT', { progreso:101 }))).status, 400);
    const started = await fetch(progressUrl, authorized(access.body.token, 'PUT', { progreso:45 }));
    assert.equal(started.status, 200);
    const progressList = await fetch(`${baseUrl}/api/progress/${user.id}`, authorized(access.body.token));
    assert.equal((await progressList.json())[0].progreso, 45);
    assert.equal((await fetch(`${baseUrl}/api/progress/${admin.body.usuario.id}`, authorized(access.body.token))).status, 403);

    const completed = await fetch(progressUrl, authorized(access.body.token, 'PUT', { progreso:100 }));
    assert.deepEqual(await completed.json(), { completed:true, progreso:100 });
    assert.equal((await (await fetch(`${baseUrl}/api/progress/${user.id}`, authorized(access.body.token))).json()).length, 0);
    const history = await fetch(`${baseUrl}/api/history/${user.id}`, authorized(access.body.token));
    const entries = await history.json();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].titulo, 'En progreso');
    assert.equal((await fetch(`${baseUrl}/api/history/${user.id}/${entries[0].historial_id}`, authorized(access.body.token, 'DELETE'))).status, 204);
  });
});

test('la configuración visual permite al administrador cambiar y restaurar enlaces', async () => {
  await withApi(async (baseUrl) => {
    const admin = await login(baseUrl, 'admin@comet.demo', 'Admin2026!');
    const viewer = await login(baseUrl, 'viewer@comet.demo', 'Viewer2026!');
    const customUrl = 'https://example.test/assets/login-background.jpg';

    const initial = await (await fetch(`${baseUrl}/api/settings`)).json();
    assert.equal(initial.auth_background_url, VISUAL_SETTINGS.auth_background_url.defaultValue);
    assert.equal((await fetch(`${baseUrl}/api/settings/auth_background_url`, authorized(viewer.body.token, 'PUT', { value:customUrl }))).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/settings/auth_background_url`, authorized(admin.body.token, 'PUT', { value:'javascript:alert(1)' }))).status, 400);
    const update = await fetch(`${baseUrl}/api/settings/auth_background_url`, authorized(admin.body.token, 'PUT', { value:customUrl }));
    assert.equal(update.status, 200);
    assert.equal((await (await fetch(`${baseUrl}/api/settings`)).json()).auth_background_url, customUrl);

    const adminList = await fetch(`${baseUrl}/api/settings/admin`, authorized(admin.body.token));
    assert.equal((await adminList.json()).find((item) => item.key === 'auth_background_url').customized, true);
    assert.equal((await fetch(`${baseUrl}/api/settings/auth_background_url`, authorized(admin.body.token, 'DELETE'))).status, 200);
    assert.equal((await (await fetch(`${baseUrl}/api/settings`)).json()).auth_background_url, VISUAL_SETTINGS.auth_background_url.defaultValue);
  });
});
