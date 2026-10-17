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
let detailMovieId = null;

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
const progressOf = (id) => progressItems.find((movie) => movie.id === id) || null;
const historyOf = (id) => historyItems.find((movie) => movie.id === id) || null;
const posterSource = (movie) => movie.imagen_vertical || movie.imagen || fallbackImage;

function card(movie, options = {}) {
  const progress = progressOf(movie.id);
  const favorite = isFavorite(movie.id);
  return `<article class="media-card" data-movie-id="${movie.id}" tabindex="0" role="button" aria-label="Ver detalles de ${escapeHtml(movie.titulo)}">
    <span class="poster">
      <img src="${escapeHtml(posterSource(movie))}" alt="Póster de ${escapeHtml(movie.titulo)}" loading="lazy">
      ${favorite ? '<span class="badge badge-fav" aria-hidden="true">♥</span>' : ''}
      ${options.seen ? '<span class="badge badge-seen">Vista</span>' : ''}
      ${progress ? `<span class="poster-progress" aria-hidden="true"><i style="width:${progress.progreso}%"></i></span>` : ''}
    </span>
    <div class="media-info"><h3>${escapeHtml(movie.titulo)}</h3><p>${escapeHtml(movie.genero || 'Selección')} · ${escapeHtml(movie.anio || '—')}</p></div>
  </article>`;
}
function renderCatalog(list = movies) {
  document.querySelector('#movieGrid').innerHTML = list.length ? list.map((movie) => card(movie)).join('') : '<div class="empty">No encontramos películas con ese criterio.</div>';
  document.querySelector('#catalogCount').textContent = `${list.length} títulos`;
}
function renderFavorites() {
  document.querySelector('#favoriteGrid').innerHTML = favorites.length ? favorites.map((movie) => card(movie)).join('') : '<div class="empty">Todavía no guardas favoritos. Explora el catálogo y crea tu selección.</div>';
}
function renderActivity() {
  document.querySelector('#progressGrid').innerHTML = progressItems.length ? progressItems.map((movie) => card(movie)).join('') : '<div class="empty">No tienes películas en progreso.</div>';
  document.querySelector('#historyGrid').innerHTML = historyItems.length ? historyItems.map((movie) => card(movie, { seen: true })).join('') : '<div class="empty">Tu historial está vacío.</div>';
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
  if (detailDialogOpen()) refreshDetail();
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

const detailDialogOpen = () => document.querySelector('#detailDialog').open;
function refreshDetail() { if (detailDialogOpen() && detailMovieId !== null) openDetail(detailMovieId, { focus: false }); }
function openDetail(movieId, { focus = true } = {}) {
  const movie = findMovie(movieId);
  if (!movie) return;
  detailMovieId = movieId;
  const progress = progressOf(movieId);
  const history = historyOf(movieId);
  const dialog = document.querySelector('#detailDialog');

  document.querySelector('#detailBackdrop').src = movie.imagen_horizontal || posterSource(movie);
  document.querySelector('#detailBackdrop').alt = '';
  document.querySelector('#detailPoster').src = posterSource(movie);
  document.querySelector('#detailPoster').alt = `Póster de ${movie.titulo}`;
  document.querySelector('#detailTitle').textContent = movie.titulo;
  document.querySelector('#detailMeta').textContent = [movie.genero, movie.anio, movie.duracion].filter(Boolean).join(' · ') || 'Selección Comet';
  document.querySelector('#detailSynopsis').textContent = movie.sinopsis || 'Sinopsis no disponible todavía.';

  const status = document.querySelector('#detailStatus');
  if (progress) {
    status.hidden = false;
    status.innerHTML = `<span class="status-label">Sigues viendo</span><span class="progress-track"><i style="width:${progress.progreso}%"></i></span><span class="status-value">${progress.progreso}%</span>`;
  } else if (history) {
    status.hidden = false;
    status.innerHTML = `<span class="status-label">Vista</span><span class="status-value">${escapeHtml(history.fecha || '')}</span>`;
  } else {
    status.hidden = true; status.innerHTML = '';
  }

  const favoriteButton = document.querySelector('#detailFavorite');
  favoriteButton.textContent = isFavorite(movieId) ? '♥ Quitar de favoritos' : '♡ Agregar a favoritos';
  favoriteButton.setAttribute('aria-pressed', String(isFavorite(movieId)));
  document.querySelector('#detailPlay').textContent = progress ? '▶ Continuar viendo' : '▶ Reproducir';

  const removeButton = document.querySelector('#detailRemove');
  removeButton.hidden = true;
  removeButton.removeAttribute('data-remove-progress');
  removeButton.removeAttribute('data-remove-history');
  if (history) { removeButton.hidden = false; removeButton.textContent = 'Quitar del historial'; removeButton.dataset.removeHistory = history.historial_id; }
  else if (progress) { removeButton.hidden = false; removeButton.textContent = 'Quitar de seguir viendo'; removeButton.dataset.removeProgress = movie.id; }

  if (!dialog.open) dialog.showModal();
  if (focus) dialog.querySelector('#detailPlay').focus();
}
function closeDetail() {
  const dialog = document.querySelector('#detailDialog');
  if (dialog.open) dialog.close();
}

function enterFullscreen(element) {
  if (!element?.requestFullscreen) return;
  element.requestFullscreen().catch(() => {});
}
function openPlayer(movieId, immersive = false) {
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
  if (!dialog.open) dialog.showModal();
  if (immersive) enterFullscreen(dialog);
  else dialog.querySelector('[data-close-trailer]').focus();
}
function closePlayer() {
  const dialog = document.querySelector('#trailerDialog');
  document.querySelector('#trailerFrame').src = '';
  if (document.fullscreenElement) document.exitFullscreen?.();
  if (dialog.open) dialog.close();
}
async function loadActivity() {
  [progressItems, historyItems] = await Promise.all([api(`/api/progress/${user.id}`), api(`/api/history/${user.id}`)]);
  renderActivity();
}
function openProgress(movieId) {
  const movie = findMovie(movieId);
  if (!movie) return;
  const dialog = document.querySelector('#progressDialog');
  const form = document.querySelector('#progressForm');
  const current = progressOf(movieId)?.progreso ?? 25;
  form.elements.peliculaId.value = movieId; form.elements.progreso.value = current;
  document.querySelector('#progressTitle').textContent = movie.titulo;
  document.querySelector('#progressValue').textContent = `${current}%`;
  document.querySelector('#progressMessage').textContent = '';
  dialog.showModal();
}

document.addEventListener('click', async (event) => {
  const viewButton = event.target.closest('[data-view]'); if (viewButton) { setView(viewButton.dataset.view); return; }
  if (event.target.closest('[data-scroll-catalog]')) { document.querySelector('#catalog').scrollIntoView({ behavior: 'smooth' }); return; }
  if (event.target.closest('[data-close-detail]')) { closeDetail(); return; }
  const removeProgress = event.target.closest('[data-remove-progress]');
  if (removeProgress) { try { await api(`/api/progress/${user.id}/${removeProgress.dataset.removeProgress}`, { method:'DELETE' }); await loadActivity(); refreshDetail(); } catch (error) { alert(error.message); } return; }
  const removeHistory = event.target.closest('[data-remove-history]');
  if (removeHistory) { try { await api(`/api/history/${user.id}/${removeHistory.dataset.removeHistory}`, { method:'DELETE' }); await loadActivity(); refreshDetail(); } catch (error) { alert(error.message); } return; }
  const cardElement = event.target.closest('.media-card[data-movie-id]');
  if (cardElement) openDetail(Number(cardElement.dataset.movieId));
});
document.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.media-card[data-movie-id]')) { event.preventDefault(); openDetail(Number(event.target.dataset.movieId)); }
});
document.addEventListener('fullscreenchange', () => {
  const button = document.querySelector('#playerFullscreen');
  const active = Boolean(document.fullscreenElement);
  button.setAttribute('aria-pressed', String(active));
  button.setAttribute('aria-label', active ? 'Salir de pantalla completa' : 'Pantalla completa');
  button.title = active ? 'Salir de pantalla completa' : 'Pantalla completa';
});
document.querySelector('#heroTrailer').addEventListener('click', () => { if (featuredMovie) openPlayer(featuredMovie.id, true); });
document.querySelector('#heroDetails').addEventListener('click', () => { if (featuredMovie) openDetail(featuredMovie.id); });
document.querySelector('#heroFavorite').addEventListener('click', () => { if (featuredMovie) toggleFavorite(featuredMovie.id).catch((error) => alert(error.message)); });
document.querySelector('#detailPlay').addEventListener('click', () => openPlayer(detailMovieId, true));
document.querySelector('#detailFavorite').addEventListener('click', () => { toggleFavorite(detailMovieId).catch((error) => alert(error.message)); });
document.querySelector('#detailProgress').addEventListener('click', () => openProgress(detailMovieId));
document.querySelector('#playerFullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else enterFullscreen(document.querySelector('#trailerDialog'));
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
document.querySelector('[data-close-trailer]').addEventListener('click', closePlayer);
document.querySelector('#trailerDialog').addEventListener('close', () => { document.querySelector('#trailerFrame').src = ''; });
document.querySelector('#trailerDialog').addEventListener('click', (event) => { if (event.target === event.currentTarget) closePlayer(); });
document.querySelector('#detailDialog').addEventListener('close', () => { detailMovieId = null; });
document.querySelector('#detailDialog').addEventListener('click', (event) => { if (event.target === event.currentTarget) closeDetail(); });
document.querySelector('#progressForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector('#progressMessage');
  try {
    await api(`/api/progress/${user.id}/${form.elements.peliculaId.value}`, { method:'PUT', body:JSON.stringify({ progreso:Number(form.elements.progreso.value) }) });
    await loadActivity();
    refreshDetail();
    document.querySelector('#progressDialog').close();
  } catch (error) { message.textContent = error.message; }
});
document.querySelector('#clearHistory').addEventListener('click', async () => {
  if (!historyItems.length || !confirm('¿Limpiar todo tu historial?')) return;
  try { await api(`/api/history/${user.id}`, { method:'DELETE' }); await loadActivity(); refreshDetail(); }
  catch (error) { alert(error.message); }
});
document.querySelector('#logout').addEventListener('click', () => { sessionStorage.removeItem('cometSession'); window.location.replace('login.html'); });
Promise.all([window.cometSettingsReady || Promise.resolve({}), api('/api/users/me'), api('/api/movies'), api(`/api/favoritos/${user.id}`), api(`/api/progress/${user.id}`), api(`/api/history/${user.id}`), api('/api/avatars')]).then(([, profileData, movieData, favoriteData, progressData, historyData, avatarData]) => { fallbackImage = window.getCometSetting?.('movie_fallback_url') || ''; user = profileData; session.user = { ...session.user, ...user }; sessionStorage.setItem('cometSession', JSON.stringify(session)); movies = movieData; favorites = favoriteData; progressItems = progressData; historyItems = historyData; avatars = avatarData; renderUser(); renderHero(); renderCatalog(); renderActivity(); }).catch((error) => alert(error.message));
