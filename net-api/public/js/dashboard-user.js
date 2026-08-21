const rawSession = sessionStorage.getItem('cometSession');
const session = rawSession ? JSON.parse(rawSession) : null;
if (!session?.token || !session?.user) {
  window.location.replace('login.html');
  throw new Error('Se requiere una sesión válida.');
}

let user = session.user;
let movies = [];
let favorites = [];
let progressItems = [];
let historyItems = [];
let avatars = [];
let featuredMovie = null;
let fallbackImage = '';

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, ...(options.headers || {}) } });
  if (response.status === 401) { sessionStorage.removeItem('cometSession'); window.location.replace('login.html'); throw new Error('Sesión vencida.'); }
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.details?.join(' ') || data.error || 'No fue posible completar la operación.');
  return data;
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[character]));
const isFavorite = (id) => favorites.some((movie) => movie.id === id);
function card(movie) {
  return `<article class="media-card" data-movie-id="${movie.id}" tabindex="0" aria-label="${escapeHtml(movie.titulo)}. Doble clic para reproducir el tráiler"><img src="${escapeHtml(movie.imagen_vertical || movie.imagen || fallbackImage)}" alt="Portada vertical de ${escapeHtml(movie.titulo)}"><div class="media-info"><h3>${escapeHtml(movie.titulo)}</h3><p>${escapeHtml(movie.genero || 'Selección')} · ${escapeHtml(movie.anio || '—')}</p><span class="media-hint">▶ Doble clic para ver tráiler</span><div class="card-actions"><button class="button secondary" data-favorite="${movie.id}">${isFavorite(movie.id) ? 'Quitar ♥' : 'Guardar ♡'}</button><button class="button secondary" data-progress="${movie.id}">Progreso</button></div></div></article>`;
}
function renderCatalog(list = movies) {
  document.querySelector('#movieGrid').innerHTML = list.length ? list.map(card).join('') : '<div class="empty">No encontramos películas con ese criterio.</div>';
  document.querySelector('#catalogCount').textContent = `${list.length} títulos`;
}
function renderFavorites() {
  document.querySelector('#favoriteGrid').innerHTML = favorites.length ? favorites.map(card).join('') : '<div class="empty">Todavía no guardas favoritos. Explora el catálogo y crea tu selección.</div>';
}
function renderActivity() {
  document.querySelector('#progressGrid').innerHTML = progressItems.length ? progressItems.map((movie) => `<article class="media-card" data-movie-id="${movie.id}" tabindex="0" aria-label="${escapeHtml(movie.titulo)}. Doble clic para reproducir el tráiler"><img src="${escapeHtml(movie.imagen_vertical || movie.imagen || fallbackImage)}" alt="Portada vertical de ${escapeHtml(movie.titulo)}"><div class="media-info"><h3>${escapeHtml(movie.titulo)}</h3><p>${escapeHtml(movie.genero || 'Selección')} · ${movie.progreso}%</p><span class="media-hint">▶ Doble clic para ver tráiler</span><div class="progress-track"><span style="width:${movie.progreso}%"></span></div><div class="card-actions"><button class="button secondary" data-progress="${movie.id}">Actualizar</button><button class="button danger" data-remove-progress="${movie.id}">Quitar</button></div></div></article>`).join('') : '<div class="empty">No tienes películas en progreso.</div>';
  document.querySelector('#historyGrid').innerHTML = historyItems.length ? historyItems.map((movie) => `<article class="media-card" data-movie-id="${movie.id}" tabindex="0" aria-label="${escapeHtml(movie.titulo)}. Doble clic para reproducir el tráiler"><img src="${escapeHtml(movie.imagen_vertical || movie.imagen || fallbackImage)}" alt="Portada vertical de ${escapeHtml(movie.titulo)}"><div class="media-info"><h3>${escapeHtml(movie.titulo)}</h3><p>Vista el ${escapeHtml(movie.fecha)}</p><span class="media-hint">▶ Doble clic para ver tráiler</span><div class="card-actions"><button class="button secondary" data-progress="${movie.id}">Ver de nuevo</button><button class="button danger" data-remove-history="${movie.historial_id}">Quitar</button></div></div></article>`).join('') : '<div class="empty">Tu historial está vacío.</div>';
}
function renderAvatarChoices() {
  const grid = document.querySelector('#avatarChoices');
  grid.innerHTML = avatars.map((avatar) => `
    <label class="avatar-choice">
      <input type="radio" name="avatarId" value="${avatar.id}" ${Number(user.avatar_id) === avatar.id ? 'checked' : ''}>
      <img src="${escapeHtml(avatar.url)}" alt="${escapeHtml(avatar.nombre)}">
      <span>${escapeHtml(avatar.nombre)}</span>
    </label>`).join('') || '<div class="empty">El administrador todavía no habilita avatares.</div>';
}
function renderUser() {
  const avatar = user.imagen || window.getCometSetting?.('avatar_fallback_url') || '';
  document.querySelector('#miniAvatar').src = avatar; document.querySelector('#miniName').textContent = user.nombre;
  document.querySelector('#profileAvatar').src = avatar;
  const form = document.querySelector('#profileForm'); form.elements.nombre.value = user.nombre; form.elements.correo.value = user.correo; renderAvatarChoices();
}
function setView(name) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'favorites') renderFavorites();
  if (name === 'activity') renderActivity();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function toggleFavorite(id) {
  const method = isFavorite(id) ? 'DELETE' : 'PUT';
  await api(`/api/favoritos/${user.id}/${id}`, { method });
  favorites = await api(`/api/favoritos/${user.id}`); renderCatalog(); renderFavorites();
  if (featuredMovie?.id === id) updateHeroButton();
}
function updateHeroButton() {
  const button = document.querySelector('#heroFavorite');
  button.disabled = !featuredMovie;
  if (featuredMovie) button.textContent = isFavorite(featuredMovie.id) ? 'Quitar de favoritos' : 'Agregar a favoritos';
}
function renderHero() {
  featuredMovie = movies.find((movie) => movie.imagen_horizontal) || movies[0];
  if (!featuredMovie) return;
  const hero = document.querySelector('#hero'); hero.dataset.movieId = featuredMovie.id; hero.insertAdjacentHTML('afterbegin', `<img class="hero-backdrop" src="${escapeHtml(featuredMovie.imagen_horizontal || featuredMovie.imagen_vertical || featuredMovie.imagen || fallbackImage)}" alt="">`);
  document.querySelector('#heroTitle').textContent = featuredMovie.titulo; document.querySelector('#heroCopy').textContent = featuredMovie.sinopsis || `${featuredMovie.genero || 'Película'} · ${featuredMovie.anio || 'Selección actual'}`; updateHeroButton();
}
function findMovie(movieId) {
  return movies.find((movie) => movie.id === movieId)
    || favorites.find((movie) => movie.id === movieId)
    || progressItems.find((movie) => movie.id === movieId)
    || historyItems.find((movie) => movie.id === movieId);
}
function closeTrailer() {
  const dialog = document.querySelector('#trailerDialog');
  document.querySelector('#trailerFrame').src = '';
  if (dialog.open) dialog.close();
}
function openTrailer(movieId) {
  const movie = findMovie(movieId);
  if (!movie) return;
  const dialog = document.querySelector('#trailerDialog');
  const frame = document.querySelector('#trailerFrame');
  const unavailable = document.querySelector('#trailerUnavailable');
  const embedUrl = window.CometYouTube?.youtubeEmbedUrl(movie.trailer);
  document.querySelector('#trailerTitle').textContent = movie.titulo;
  document.querySelector('#trailerMeta').textContent = [movie.genero, movie.anio, movie.duracion].filter(Boolean).join(' · ');
  document.querySelector('#trailerSynopsis').textContent = movie.sinopsis || 'Sinopsis no disponible.';
  frame.hidden = !embedUrl;
  unavailable.hidden = Boolean(embedUrl);
  frame.src = embedUrl || '';
  dialog.showModal();
}
async function loadActivity() {
  [progressItems, historyItems] = await Promise.all([api(`/api/progress/${user.id}`), api(`/api/history/${user.id}`)]);
  renderActivity();
}
function openProgress(movieId) {
  const movie = movies.find((item) => item.id === movieId) || progressItems.find((item) => item.id === movieId) || historyItems.find((item) => item.id === movieId);
  if (!movie) return;
  const dialog = document.querySelector('#progressDialog');
  const form = document.querySelector('#progressForm');
  const current = progressItems.find((item) => item.id === movieId)?.progreso || 25;
  form.elements.peliculaId.value = movieId; form.elements.progreso.value = current;
  document.querySelector('#progressTitle').textContent = movie.titulo;
  document.querySelector('#progressValue').textContent = `${current}%`;
  document.querySelector('#progressMessage').textContent = '';
  dialog.showModal();
}
document.addEventListener('click', async (event) => {
  const viewButton = event.target.closest('[data-view]'); if (viewButton) setView(viewButton.dataset.view);
  const favoriteButton = event.target.closest('[data-favorite]'); if (favoriteButton) toggleFavorite(Number(favoriteButton.dataset.favorite)).catch((error) => alert(error.message));
  const progressButton = event.target.closest('[data-progress]'); if (progressButton) openProgress(Number(progressButton.dataset.progress));
  const removeProgress = event.target.closest('[data-remove-progress]');
  if (removeProgress) { try { await api(`/api/progress/${user.id}/${removeProgress.dataset.removeProgress}`, { method:'DELETE' }); await loadActivity(); } catch (error) { alert(error.message); } }
  const removeHistory = event.target.closest('[data-remove-history]');
  if (removeHistory) { try { await api(`/api/history/${user.id}/${removeHistory.dataset.removeHistory}`, { method:'DELETE' }); await loadActivity(); } catch (error) { alert(error.message); } }
  if (event.target.closest('[data-scroll-catalog]')) document.querySelector('#catalog').scrollIntoView({ behavior: 'smooth' });
});
document.addEventListener('dblclick', (event) => {
  if (event.target.closest('button, a, input, select, textarea')) return;
  const movieCard = event.target.closest('[data-movie-id]');
  if (movieCard) openTrailer(Number(movieCard.dataset.movieId));
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.matches('.media-card[data-movie-id]')) openTrailer(Number(event.target.dataset.movieId));
});
document.querySelector('#heroTrailer').addEventListener('click', () => {
  if (featuredMovie) openTrailer(featuredMovie.id);
});
document.querySelector('#heroFavorite').addEventListener('click', () => {
  if (featuredMovie) toggleFavorite(featuredMovie.id).catch((error) => alert(error.message));
});
document.querySelector('#search').addEventListener('input', (event) => { const term = event.target.value.trim().toLowerCase(); renderCatalog(movies.filter((movie) => [movie.titulo,movie.genero,movie.anio].some((value) => String(value || '').toLowerCase().includes(term)))); });
document.querySelector('#avatarChoices').addEventListener('change', (event) => {
  const selected = avatars.find((avatar) => avatar.id === Number(event.target.value));
  if (selected) document.querySelector('#profileAvatar').src = selected.url;
});
document.querySelector('#profileForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; const message = document.querySelector('#profileMessage');
  message.textContent = ''; message.classList.remove('success');
  if (!form.reportValidity()) return;
  try { user = await api('/api/users/me', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); session.user = { ...session.user, ...user }; sessionStorage.setItem('cometSession', JSON.stringify(session)); renderUser(); message.textContent = 'Perfil actualizado correctamente.'; message.classList.add('success'); }
  catch (error) { message.textContent = error.message; message.classList.remove('success'); }
});
document.querySelector('#passwordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector('#passwordMessage');
  const data = Object.fromEntries(new FormData(form));
  message.textContent = ''; message.classList.remove('success');
  if (!form.reportValidity()) return;
  const errors = [];
  if (!/\p{L}/u.test(data.contraseñaNueva) || !/\d/.test(data.contraseñaNueva)) errors.push('Incluye al menos una letra y un número.');
  if (data.contraseñaNueva !== data.confirmacion) errors.push('La confirmación no coincide.');
  if (errors.length) { message.textContent = errors.join(' '); return; }
  try {
    const result = await api('/api/users/me/password', { method: 'PATCH', body: JSON.stringify(data) });
    form.reset(); message.textContent = result.message; message.classList.add('success');
  } catch (error) { message.textContent = error.message; }
});
document.querySelector('#progressForm').elements.progreso.addEventListener('input', (event) => { document.querySelector('#progressValue').textContent = `${event.target.value}%`; });
document.querySelector('[data-close-progress]').addEventListener('click', () => document.querySelector('#progressDialog').close());
document.querySelector('[data-close-trailer]').addEventListener('click', closeTrailer);
document.querySelector('#trailerDialog').addEventListener('close', () => { document.querySelector('#trailerFrame').src = ''; });
document.querySelector('#trailerDialog').addEventListener('click', (event) => { if (event.target === event.currentTarget) closeTrailer(); });
document.querySelector('#progressForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector('#progressMessage');
  try {
    await api(`/api/progress/${user.id}/${form.elements.peliculaId.value}`, { method:'PUT', body:JSON.stringify({ progreso:Number(form.elements.progreso.value) }) });
    await loadActivity();
    document.querySelector('#progressDialog').close();
  } catch (error) { message.textContent = error.message; }
});
document.querySelector('#clearHistory').addEventListener('click', async () => {
  if (!historyItems.length || !confirm('¿Limpiar todo tu historial?')) return;
  try { await api(`/api/history/${user.id}`, { method:'DELETE' }); await loadActivity(); }
  catch (error) { alert(error.message); }
});
document.querySelector('#logout').addEventListener('click', () => { sessionStorage.removeItem('cometSession'); window.location.replace('login.html'); });
Promise.all([window.cometSettingsReady || Promise.resolve({}), api('/api/users/me'), api('/api/movies'), api(`/api/favoritos/${user.id}`), api(`/api/progress/${user.id}`), api(`/api/history/${user.id}`), api('/api/avatars')]).then(([, profileData, movieData, favoriteData, progressData, historyData, avatarData]) => { fallbackImage = window.getCometSetting?.('movie_fallback_url') || ''; user = profileData; session.user = { ...session.user, ...user }; sessionStorage.setItem('cometSession', JSON.stringify(session)); movies = movieData; favorites = favoriteData; progressItems = progressData; historyItems = historyData; avatars = avatarData; renderUser(); renderHero(); renderCatalog(); renderActivity(); }).catch((error) => alert(error.message));
