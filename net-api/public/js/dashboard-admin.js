const stored = sessionStorage.getItem('cometSession');
const session = stored ? JSON.parse(stored) : null;
if (!session?.token || session.user?.rol !== 'admin') {
  window.location.replace('login.html');
  throw new Error('Se requiere una sesión administrativa.');
}

let movies = [];
let users = [];
let genres = [];
let visualSettings = [];
let avatars = [];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character]));

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type':'application/json', Authorization:`Bearer ${session.token}`, ...(options.headers || {}) },
  });
  if (response.status === 401) {
    sessionStorage.removeItem('cometSession');
    window.location.replace('login.html');
    throw new Error('Sesión vencida.');
  }
  if (response.status === 204) return null;
  const body = await response.json();
  if (!response.ok) throw new Error(body.details?.join(' ') || body.error || 'No fue posible completar la operación.');
  return body;
}

function setView(name) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
}

function renderMovies() {
  const fallback = window.getCometSetting?.('movie_fallback_url') || '';
  document.querySelector('#adminMovieGrid').innerHTML = movies.map((movie) => `
    <article class="media-card">
      <img src="${escapeHtml(movie.imagen_vertical || movie.imagen || fallback)}" alt="Portada vertical de ${escapeHtml(movie.titulo)}">
      <div class="media-info"><h3>${escapeHtml(movie.titulo)}</h3><p>${escapeHtml(movie.genero || 'Sin género')} · ${escapeHtml(movie.anio || '—')}</p>
      <div class="card-actions"><button class="button secondary" data-edit-movie="${movie.id}">Editar</button><button class="button danger" data-delete-movie="${movie.id}">Eliminar</button></div></div>
    </article>`).join('') || '<div class="empty">No hay películas.</div>';
  document.querySelector('#movieMetric').textContent = movies.length;
}

function renderSettings() {
  document.querySelector('#settingsGrid').innerHTML = visualSettings.map((setting) => `
    <article class="surface setting-card" data-setting-card="${escapeHtml(setting.key)}">
      <span class="setting-key">${escapeHtml(setting.key)}</span><h2>${escapeHtml(setting.label)}</h2><p class="muted">${escapeHtml(setting.description)}</p>
      <img class="setting-preview" src="${escapeHtml(setting.value)}" alt="Vista previa de ${escapeHtml(setting.label)}">
      <label class="field"><span>Enlace HTTP/HTTPS</span><input type="url" maxlength="1500" value="${escapeHtml(setting.value)}" data-setting-input="${escapeHtml(setting.key)}" required></label>
      <div class="form-actions"><button class="button" type="button" data-save-setting="${escapeHtml(setting.key)}">Guardar enlace</button><button class="button secondary" type="button" data-reset-setting="${escapeHtml(setting.key)}" ${setting.customized ? '' : 'disabled'}>Restaurar</button></div>
    </article>`).join('');
}

function renderAvatars() {
  document.querySelector('#adminAvatarGrid').innerHTML = avatars.map((avatar) => `
    <article class="surface avatar-admin-card">
      <img src="${escapeHtml(avatar.url)}" alt="Avatar ${escapeHtml(avatar.nombre)}">
      <div><div class="avatar-card-title"><h2>${escapeHtml(avatar.nombre)}</h2><span class="role-badge">${avatar.activo ? 'Activo' : 'Oculto'}</span></div><p class="muted">${avatar.usuarios} usuario${avatar.usuarios === 1 ? '' : 's'}</p>
      <div class="form-actions"><button class="button secondary" type="button" data-edit-avatar="${avatar.id}">Editar</button><button class="button danger" type="button" data-delete-avatar="${avatar.id}" ${avatar.usuarios > 0 ? 'disabled title="Está asignado a usuarios"' : ''}>Eliminar</button></div></div>
    </article>`).join('') || '<div class="empty">No hay avatares registrados.</div>';
}

function renderUsers() {
  document.querySelector('#userRows').innerHTML = users.map((user) => `
    <tr><td><div class="user-cell"><img class="avatar" src="${escapeHtml(user.imagen || window.getCometSetting?.('avatar_fallback_url') || '')}" alt=""><strong>${escapeHtml(user.nombre)}</strong></div></td><td>${escapeHtml(user.correo)}</td><td><span class="role-badge">${escapeHtml(user.rol)}</span></td>
    <td>${user.id === session.user.id ? '<span class="muted">Sesión actual</span>' : `<button class="button secondary" data-role-id="${user.id}" data-role="${user.rol === 'admin' ? 'user' : 'admin'}">Cambiar a ${user.rol === 'admin' ? 'user' : 'admin'}</button>`}</td></tr>`).join('');
  document.querySelector('#userMetric').textContent = users.length;
}

function renderGenreOptions() {
  const select = document.querySelector('#movieForm').elements.generoId;
  const current = select.value;
  select.innerHTML = '<option value="">Sin género</option>' + genres.map((genre) => `<option value="${genre.id}">${escapeHtml(genre.nombre)}</option>`).join('');
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function renderGenres() {
  document.querySelector('#genreRows').innerHTML = genres.map((genre) => `
    <tr><td><strong>${escapeHtml(genre.nombre)}</strong></td><td>${genre.peliculas}</td><td><div class="form-actions"><button class="button secondary" data-edit-genre="${genre.id}">Editar</button><button class="button danger" data-delete-genre="${genre.id}" ${genre.peliculas > 0 ? 'disabled title="Tiene películas asociadas"' : ''}>Eliminar</button></div></td></tr>`).join('') || '<tr><td colspan="3" class="muted">No hay géneros registrados.</td></tr>';
  document.querySelector('#genreMetric').textContent = genres.length;
  renderGenreOptions();
}

function fillMovie(movie) {
  if (!movie) return;
  const form = document.querySelector('#movieForm');
  const values = {
    id:movie.id,
    titulo:movie.titulo,
    anio:movie.anio,
    duracion:movie.duracion,
    generoId:movie.genero_id || '',
    imagenVertical:movie.imagen_vertical || movie.imagen,
    imagenHorizontal:movie.imagen_horizontal || movie.imagen_vertical || movie.imagen,
    sinopsis:movie.sinopsis,
    trailer:movie.trailer,
  };
  for (const [key, value] of Object.entries(values)) if (form.elements[key]) form.elements[key].value = value || '';
  document.querySelector('#movieFormTitle').textContent = 'Editar película';
  form.scrollIntoView({ behavior:'smooth' });
}

function resetMovie() {
  const form = document.querySelector('#movieForm');
  form.reset(); form.elements.id.value = '';
  document.querySelector('#movieFormTitle').textContent = 'Nueva película';
}

function fillGenre(genre) {
  if (!genre) return;
  const form = document.querySelector('#genreForm');
  form.elements.id.value = genre.id;
  form.elements.nombre.value = genre.nombre;
  document.querySelector('#genreFormTitle').textContent = 'Editar género';
  form.scrollIntoView({ behavior:'smooth' });
}

function resetGenre() {
  const form = document.querySelector('#genreForm');
  form.reset(); form.elements.id.value = '';
  document.querySelector('#genreFormTitle').textContent = 'Nuevo género';
}

function fillAvatar(avatar) {
  if (!avatar) return;
  const form = document.querySelector('#avatarForm');
  form.elements.id.value = avatar.id;
  form.elements.nombre.value = avatar.nombre;
  form.elements.url.value = avatar.url;
  form.elements.activo.checked = avatar.activo;
  document.querySelector('#avatarFormTitle').textContent = 'Editar avatar';
  form.scrollIntoView({ behavior:'smooth' });
}

function resetAvatar() {
  const form = document.querySelector('#avatarForm');
  form.reset(); form.elements.id.value = ''; form.elements.activo.checked = true;
  document.querySelector('#avatarFormTitle').textContent = 'Nuevo avatar';
}

document.addEventListener('click', async (event) => {
  const view = event.target.closest('[data-view]');
  if (view) setView(view.dataset.view);

  const editMovie = event.target.closest('[data-edit-movie]');
  if (editMovie) fillMovie(movies.find((movie) => movie.id === Number(editMovie.dataset.editMovie)));
  const deleteMovie = event.target.closest('[data-delete-movie]');
  if (deleteMovie && confirm('¿Eliminar esta película y retirarla de todos los favoritos?')) {
    try { await api(`/api/movies/${deleteMovie.dataset.deleteMovie}`, { method:'DELETE' }); movies = await api('/api/movies'); genres = await api('/api/genres'); renderMovies(); renderGenres(); }
    catch (error) { alert(error.message); }
  }

  const editGenre = event.target.closest('[data-edit-genre]');
  if (editGenre) fillGenre(genres.find((genre) => genre.id === Number(editGenre.dataset.editGenre)));
  const deleteGenre = event.target.closest('[data-delete-genre]');
  if (deleteGenre && !deleteGenre.disabled && confirm('¿Eliminar este género?')) {
    try { await api(`/api/genres/${deleteGenre.dataset.deleteGenre}`, { method:'DELETE' }); genres = await api('/api/genres'); renderGenres(); }
    catch (error) { alert(error.message); }
  }

  const editAvatar = event.target.closest('[data-edit-avatar]');
  if (editAvatar) fillAvatar(avatars.find((avatar) => avatar.id === Number(editAvatar.dataset.editAvatar)));
  const deleteAvatar = event.target.closest('[data-delete-avatar]');
  if (deleteAvatar && !deleteAvatar.disabled && confirm('¿Eliminar este avatar del catálogo?')) {
    try { await api(`/api/avatars/${deleteAvatar.dataset.deleteAvatar}`, { method:'DELETE' }); avatars = await api('/api/avatars'); renderAvatars(); }
    catch (error) { alert(error.message); }
  }

  const role = event.target.closest('[data-role-id]');
  if (role) {
    try { await api(`/api/users/${role.dataset.roleId}/role`, { method:'PATCH', body:JSON.stringify({ rol:role.dataset.role }) }); users = await api('/api/users'); renderUsers(); }
    catch (error) { alert(error.message); }
  }

  const saveSetting = event.target.closest('[data-save-setting]');
  if (saveSetting) {
    const key = saveSetting.dataset.saveSetting;
    const input = document.querySelector(`[data-setting-input="${key}"]`);
    const message = document.querySelector('#settingsMessage');
    message.textContent = ''; message.classList.remove('success');
    if (!input.reportValidity()) return;
    try {
      const result = await api(`/api/settings/${key}`, { method:'PUT', body:JSON.stringify({ value:input.value.trim() }) });
      window.applyCometSettings?.({ [key]:result.value });
      visualSettings = await api('/api/settings/admin'); renderSettings();
      message.textContent = 'Enlace visual actualizado.'; message.classList.add('success');
    } catch (error) { message.textContent = error.message; }
  }

  const resetSetting = event.target.closest('[data-reset-setting]');
  if (resetSetting && !resetSetting.disabled) {
    const key = resetSetting.dataset.resetSetting;
    const message = document.querySelector('#settingsMessage');
    try {
      const result = await api(`/api/settings/${key}`, { method:'DELETE' });
      window.applyCometSettings?.({ [key]:result.value });
      visualSettings = await api('/api/settings/admin'); renderSettings();
      message.textContent = 'Se restauró el enlace predeterminado.'; message.classList.add('success');
    } catch (error) { message.textContent = error.message; message.classList.remove('success'); }
  }
});

document.addEventListener('input', (event) => {
  const input = event.target.closest('[data-setting-input]');
  if (!input) return;
  const preview = input.closest('[data-setting-card]')?.querySelector('.setting-preview');
  if (preview && /^https?:\/\//i.test(input.value.trim())) preview.src = input.value.trim();
});

document.querySelector('#movieForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector('#movieMessage');
  message.textContent = ''; message.classList.remove('success');
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form));
  const id = data.id; delete data.id;
  data.anio = Number(data.anio); data.generoId = data.generoId ? Number(data.generoId) : null;
  try { await api(id ? `/api/movies/${id}` : '/api/movies', { method:id ? 'PUT' : 'POST', body:JSON.stringify(data) }); movies = await api('/api/movies'); genres = await api('/api/genres'); renderMovies(); renderGenres(); resetMovie(); message.textContent = 'Catálogo actualizado.'; message.classList.add('success'); }
  catch (error) { message.textContent = error.message; }
});

document.querySelector('#genreForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector('#genreMessage');
  message.textContent = ''; message.classList.remove('success');
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form));
  const id = data.id; delete data.id;
  try { await api(id ? `/api/genres/${id}` : '/api/genres', { method:id ? 'PUT' : 'POST', body:JSON.stringify(data) }); genres = await api('/api/genres'); movies = await api('/api/movies'); renderGenres(); renderMovies(); resetGenre(); message.textContent = 'Géneros actualizados.'; message.classList.add('success'); }
  catch (error) { message.textContent = error.message; }
});

document.querySelector('#avatarForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector('#avatarMessage');
  message.textContent = ''; message.classList.remove('success');
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form));
  const id = data.id; delete data.id; data.activo = form.elements.activo.checked;
  try {
    await api(id ? `/api/avatars/${id}` : '/api/avatars', { method:id ? 'PUT' : 'POST', body:JSON.stringify(data) });
    avatars = await api('/api/avatars'); users = await api('/api/users'); renderAvatars(); renderUsers(); resetAvatar();
    message.textContent = 'Catálogo de avatares actualizado.'; message.classList.add('success');
  } catch (error) { message.textContent = error.message; }
});

document.querySelector('#cancelMovie').addEventListener('click', resetMovie);
document.querySelector('#cancelGenre').addEventListener('click', resetGenre);
document.querySelector('#cancelAvatar').addEventListener('click', resetAvatar);
document.querySelector('#logout').addEventListener('click', () => { fetch('/api/logout', { method: 'POST', headers: { Authorization: `Bearer ${session.token}` }, keepalive: true }).catch(() => {}).finally(() => { sessionStorage.removeItem('cometSession'); window.location.replace('login.html'); }); });
document.querySelector('#adminName').textContent = session.user.nombre;
document.querySelector('#adminAvatar').src = session.user.imagen || window.getCometSetting?.('avatar_fallback_url') || '';

Promise.all([window.cometSettingsReady || Promise.resolve({}), api('/api/movies'), api('/api/users'), api('/api/genres'), api('/api/settings/admin'), api('/api/avatars')])
  .then(([, movieData, userData, genreData, settingData, avatarData]) => { movies = movieData; users = userData; genres = genreData; visualSettings = settingData; avatars = avatarData; renderMovies(); renderUsers(); renderGenres(); renderSettings(); renderAvatars(); })
  .catch((error) => alert(error.message));
