// ======= SESIÓN Y USUARIO =======
const usuarioJSON = sessionStorage.getItem('usuario');
if (!usuarioJSON) {
    alert('No hay sesión activa');
    window.location.href = 'login.html';
}
const usuario = JSON.parse(usuarioJSON);

// Elementos del header
const nombreUsuarioElem = document.getElementById('nombreUsuario');
const imagenUsuarioElem = document.getElementById('imagenUsuario');

// Elementos de la barra lateral
const sidebar = document.getElementById('sidebarUsuario');
const overlaySidebar = document.getElementById('overlaySidebar');
const cerrarSidebar = document.getElementById('cerrarSidebar');
const inputNombre = document.getElementById('inputNombre');
const inputEmail = document.getElementById('inputEmail');
const inputImagen = document.getElementById('inputImagen');
const sidebarImagenUsuario = document.getElementById('sidebarImagenUsuario');
const nombreUsuarioSidebar = document.getElementById('nombreUsuarioSidebar');
const btnGuardarUsuario = document.getElementById('btnGuardarUsuario');

// Mostrar usuario en header y sidebar
function mostrarUsuario(usuarioData) {
    nombreUsuarioElem.textContent = usuarioData.nombre || 'Usuario';
    imagenUsuarioElem.src = usuarioData.imagen || 'https://via.placeholder.com/64x64?text=User';
    sidebarImagenUsuario.src = usuarioData.imagen || 'https://via.placeholder.com/80x80?text=User';
    nombreUsuarioSidebar.textContent = usuarioData.nombre || 'Usuario';
    inputNombre.value = usuarioData.nombre || '';
    inputEmail.value = usuarioData.correo || '';
    inputImagen.value = usuarioData.imagen || '';
}

// Cargar usuario inicial
mostrarUsuario(usuario);

// Actualiza imagen en tiempo real mientras escribe URL
inputImagen.addEventListener('input', () => {
    const url = inputImagen.value.trim() || 'https://via.placeholder.com/80x80?text=User';
    sidebarImagenUsuario.src = url;
    imagenUsuarioElem.src = url;
});

// Abrir barra lateral
document.getElementById('btnUsuario').addEventListener('click', () => {
    sidebar.classList.add('active');
    overlaySidebar.style.display = 'block';
    inputNombre.focus();
});

// Cerrar barra lateral
cerrarSidebar.addEventListener('click', cerrarSidebarFunc);
overlaySidebar.addEventListener('click', cerrarSidebarFunc);

function cerrarSidebarFunc() {
    sidebar.classList.remove('active');
    overlaySidebar.style.display = 'none';
}

// Guardar cambios del usuario
btnGuardarUsuario.addEventListener('click', async () => {
    const nombre = inputNombre.value.trim();
    const correo = inputEmail.value.trim();
    const imagen = inputImagen.value.trim();

    try {
        const res = await fetch(`/api/users/${usuario.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, correo, imagen })
        });
        if (!res.ok) throw new Error(`Error: ${res.status}`);
        const data = await res.json();
        sessionStorage.setItem('usuario', JSON.stringify(data));
        mostrarUsuario(data);
        alert('Usuario actualizado correctamente');
    } catch (err) {
        console.error(err);
        alert('No se pudo actualizar el usuario');
    }
});

// Cerrar sesión
document.getElementById('btnCerrarSesion').addEventListener('click', () => {
    sessionStorage.removeItem('usuario');
    window.location.href = 'login.html';
});

// ======= PELÍCULAS, FAVORITOS Y HISTORIAL =======
const favoritosContainer = document.getElementById('favoritosContainer');
const historialContainer = document.getElementById('historialContainer');
const peliculasPorGenero = document.getElementById('peliculasPorGenero');
const seccionFavoritos = document.getElementById('seccionFavoritos');
const seccionHistorial = document.getElementById('seccionHistorial');
const catalogoPeliculas = document.getElementById('catalogoPeliculas');
const mensajeError = document.getElementById('mensaje-error');

const modal = document.getElementById('modalPelicula');
const modalTitulo = document.getElementById('modalTitulo');
const modalCerrar = document.getElementById('modalCerrar');
const sinopsisElem = document.getElementById('sinopsis');
const trailerVideo = document.getElementById('trailerVideo');
const trailerSource = trailerVideo.querySelector('source');
const trailerIframe = document.getElementById('trailerIframe');
const btnFavoritoModal = document.getElementById('btnFavoritoModal');

// ======= FUNCIONES AUXILIARES =======
function convertirYoutubeEmbed(url) {
    if (url.includes('watch?v=')) return url.replace('watch?v=', 'embed/');
    if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'www.youtube.com/embed/');
    return url;
}

function limpiarTrailer() {
    trailerVideo.pause();
    trailerSource.src = '';
    trailerVideo.load();
    trailerVideo.style.display = 'none';
    trailerIframe.src = '';
    trailerIframe.style.display = 'none';
}

function showError(message) {
    mensajeError.textContent = message;
    mensajeError.style.display = 'block';
    setTimeout(() => mensajeError.style.display = 'none', 5000);
}

function actualizarBotonFavorito(esFav) {
    btnFavoritoModal.textContent = esFav ? '★' : '☆';
}

// ======= MODAL =======
function abrirModal(pelicula) {
    window.peliculaActual = pelicula;
    fetch(`/api/movies/${pelicula.id}`)
        .then(res => { if (!res.ok) throw new Error(`Error al obtener detalles: ${res.status}`); return res.json(); })
        .then(detalle => {
            modalTitulo.textContent = detalle.titulo || 'Sin título';
            sinopsisElem.textContent = detalle.sinopsis || 'Sin sinopsis disponible.';
            limpiarTrailer();

            if (detalle.trailer) {
                const esYT = detalle.trailer.includes('youtube.com') || detalle.trailer.includes('youtu.be');
                if (esYT) {
                    trailerIframe.src = convertirYoutubeEmbed(detalle.trailer) + '?autoplay=1&controls=1';
                    trailerIframe.style.display = 'block';
                } else {
                    trailerSource.src = detalle.trailer;
                    trailerVideo.style.display = 'block';
                    trailerVideo.muted = false;
                    trailerVideo.autoplay = true;
                    trailerVideo.controls = true;
                    trailerVideo.load();
                    trailerVideo.play().catch(() => showError('No se pudo reproducir el trailer.'));
                }
            }

            // Verificar si es favorito
            fetch(`/api/favoritos/${encodeURIComponent(usuario.nombre)}`)
                .then(r => r.json())
                .then(favs => {
                    const esFav = favs.some(f => f.id === pelicula.id);
                    actualizarBotonFavorito(esFav);
                }).catch(err => showError('Error al verificar favoritos.'));

            modal.style.display = 'flex';
            modalCerrar.focus();
        })
        .catch(err => showError(`Error al cargar detalles: ${err.message}`));
}

// Cerrar modal
modalCerrar.addEventListener('click', () => { limpiarTrailer(); modal.style.display = 'none'; window.peliculaActual = null; });
modal.addEventListener('click', e => { if (e.target === modal) { limpiarTrailer(); modal.style.display = 'none'; window.peliculaActual = null; } });

// ======= CREAR CARDS =======
function crearPeliculaCard(p, mostrarFecha = false) {
    const div = document.createElement('div');
    div.classList.add('pelicula');
    div.title = p.titulo || 'Sin título';
    const img = document.createElement('img');
    img.src = p.imagen || 'https://via.placeholder.com/160x240?text=No+Image';
    img.alt = p.titulo || 'Sin título';
    div.appendChild(img);
    const info = document.createElement('div');
    info.classList.add('titulo-fecha');
    const titulo = document.createElement('div');
    titulo.textContent = p.titulo || 'Sin título';
    info.appendChild(titulo);
    if (mostrarFecha && p.fecha) {
        const f = document.createElement('div');
        f.textContent = `Visto el: ${p.fecha}`;
        f.style.fontSize = '12px';
        f.style.color = '#ccc';
        info.appendChild(f);
    }
    div.appendChild(info);
    div.addEventListener('dblclick', () => abrirModal(p));
    return div;
}

// ======= CARGAR FAVORITOS =======
async function cargarFavoritos() {
    try {
        const res = await fetch(`/api/favoritos/${encodeURIComponent(usuario.nombre)}`);
        const data = await res.json();
        favoritosContainer.innerHTML = '';
        if (data.length === 0) { favoritosContainer.textContent = 'No tiene películas favoritas.'; return; }
        data.forEach(f => favoritosContainer.appendChild(crearPeliculaCard(f)));
    } catch (err) {
        favoritosContainer.textContent = 'No se pudieron cargar favoritos.';
        showError(`Error: ${err.message}`);
    }
}

// ======= CARGAR HISTORIAL =======
async function cargarHistorial() {
    try {
        const res = await fetch(`/api/historial/${encodeURIComponent(usuario.nombre)}`);
        const data = await res.json();
        historialContainer.innerHTML = '';
        if (data.length === 0) { historialContainer.textContent = 'No tiene historial de visualización.'; return; }
        data.forEach(v => historialContainer.appendChild(crearPeliculaCard(v, true)));
    } catch (err) {
        historialContainer.textContent = 'No se pudo cargar el historial.';
        showError(`Error: ${err.message}`);
    }
}

// ======= CARGAR PELÍCULAS POR GÉNERO =======
async function cargarPeliculasPorGenero() {
    try {
        const res = await fetch('/api/movies');
        const data = await res.json();
        peliculasPorGenero.innerHTML = '';
        const generosMap = {};
        data.forEach(p => {
            if (!generosMap[p.genero]) generosMap[p.genero] = [];
            generosMap[p.genero].push(p);
        });
        for (const g in generosMap) {
            const sec = document.createElement('section');
            const h = document.createElement('h2');
            h.textContent = g;
            sec.appendChild(h);
            const carr = document.createElement('div');
            carr.classList.add('carrusel');
            generosMap[g].forEach(peli => carr.appendChild(crearPeliculaCard(peli)));
            sec.appendChild(carr);
            peliculasPorGenero.appendChild(sec);
        }
    } catch (err) {
        peliculasPorGenero.innerHTML = 'No se pudo cargar el catálogo.';
        showError(`Error: ${err.message}`);
    }
}

// ======= NAVEGACIÓN =======
function mostrarFavoritos() { seccionFavoritos.style.display = 'block'; seccionHistorial.style.display = 'none'; catalogoPeliculas.style.display = 'none'; }
function mostrarHistorial() { seccionFavoritos.style.display = 'none'; seccionHistorial.style.display = 'block'; catalogoPeliculas.style.display = 'none'; }
function mostrarCatalogo() { seccionFavoritos.style.display = 'none'; seccionHistorial.style.display = 'none'; catalogoPeliculas.style.display = 'block'; }

document.getElementById('btnFavoritos').addEventListener('click', e => { e.preventDefault(); mostrarFavoritos(); });
document.getElementById('btnHistorial').addEventListener('click', e => { e.preventDefault(); mostrarHistorial(); });
document.getElementById('btnCatalogo').addEventListener('click', mostrarCatalogo);

// Carruseles
document.querySelectorAll('.carrusel-nav').forEach(button => {
    button.addEventListener('click', () => {
        const carruselId = button.dataset.carrusel;
        const carrusel = document.getElementById(carruselId);
        carrusel.scrollBy({ left: button.classList.contains('prev') ? -200 : 200, behavior: 'smooth' });
    });
});

// ======= BOTÓN FAVORITO MODAL =======
btnFavoritoModal.addEventListener('click', async () => {
    if (!window.peliculaActual) return;

    const peliculaId = window.peliculaActual.id;
    try {
        // Primero obtenemos la lista actual de favoritos para este usuario
        const resFav = await fetch(`/api/favoritos/${encodeURIComponent(usuario.nombre)}`);
        const favs = await resFav.json();
        const esFav = favs.some(f => f.id === peliculaId);

        // Enviar POST o DELETE según corresponda
        await fetch(`/api/favoritos/${encodeURIComponent(usuario.nombre)}`, {
            method: esFav ? 'DELETE' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ peliculaId })
        });

        // Actualizamos el botón SOLO del modal
        actualizarBotonFavorito(!esFav);

        // Recargamos la sección de favoritos
        await cargarFavoritos();
    } catch (err) {
        showError(`No se pudo actualizar favoritos: ${err.message}`);
    }
});


// ======= INICIALIZACIÓN =======
async function inicializar() {
    document.title = `JR-flix - Bienvenido ${usuario.nombre || 'Usuario'}`;
    await cargarPeliculasPorGenero();
    await cargarFavoritos();
    await cargarHistorial();
    mostrarCatalogo();
}
inicializar();
