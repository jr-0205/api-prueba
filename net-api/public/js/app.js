document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const message = document.getElementById('message');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = loginForm.username.value.trim();
            const password = loginForm.password.value.trim();

            let userData = null;

            // login simulado
            if (username === 'root' && password === 'root123') {
                userData = { nombre: 'Administrador', rol: 'admin' };
            } else if (username === 'user' && password === 'user123') {
                userData = { nombre: 'Usuario', rol: 'user' };
            }

            if (userData) {
                // Guardar sesión en sessionStorage
                sessionStorage.setItem('usuario', JSON.stringify(userData));

                // Redirigir según rol
                if (userData.rol === 'admin') {
                    window.location.href = 'dashboard-root.html';
                } else {
                    window.location.href = 'dashboard-user.html';
                }
            } else {
                message.textContent = 'Credenciales incorrectas';
                message.style.color = '#ff4444';
            }
        });
    }

    // Mostrar lista de películas si existe el elemento
    const moviesList = document.getElementById('moviesList');
    if (moviesList) {
        fetch('http://localhost:3000/movies')
            .then(res => res.json())
            .then(data => {
                moviesList.innerHTML = data.map(movie => `<li>${movie.title} (${movie.release_year})</li>`).join('');
            });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('usuario'); // borrar sesión
            window.location.href = 'login.html';
        });
    }

    // Validar sesión en páginas de dashboard
    const usuarioJSON = sessionStorage.getItem('usuario');
    if (usuarioJSON) {
        const usuario = JSON.parse(usuarioJSON);
        const nombreElem = document.getElementById('nombreUsuario');
        if (nombreElem) nombreElem.textContent = usuario.nombre;
    } else if (window.location.href.includes('dashboard')) {
        // Si intenta acceder sin sesión
        alert('No hay sesión activa. Redirigiendo a login...');
        window.location.href = 'login.html';
    }
});
