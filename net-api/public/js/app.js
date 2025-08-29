// public/js/app.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const message = document.getElementById('message');

    // Manejo del formulario de login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Captura valores del formulario
            const correo = loginForm.username.value.trim(); // input id="username"
            const contraseña = loginForm.password.value.trim(); // input id="password"

            if (!correo || !contraseña) {
                message.textContent = 'Por favor completa todos los campos';
                message.style.color = '#ff4444';
                return;
            }

            try {
                // Petición al servidor
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo, contraseña })
                });

                const data = await res.json();

                if (!res.ok) {
                    message.textContent = data.error || 'Error en el servidor';
                    message.style.color = '#ff4444';
                    return;
                }

                // 🔹 Guardar solo el objeto usuario en sessionStorage
                sessionStorage.setItem('usuario', JSON.stringify(data.usuario));

                // 🔹 Redirigir según rol
                if (data.usuario.rol === 'admin') {
                    window.location.href = 'dashboard-root.html';
                } else {
                    window.location.href = 'dashboard-user.html';
                }

            } catch (err) {
                console.error('❌ Error al iniciar sesión:', err);
                message.textContent = 'Error al conectar con el servidor';
                message.style.color = '#ff4444';
            }
        });
    }

    // Logout (si existe botón)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('usuario');
            window.location.href = 'login.html';
        });
    }

    // Validar sesión en dashboards
    const usuarioJSON = sessionStorage.getItem('usuario');
    if (usuarioJSON) {
        const usuario = JSON.parse(usuarioJSON);
        const nombreElem = document.getElementById('nombreUsuario');
        if (nombreElem) nombreElem.textContent = usuario.nombre;
    } else if (window.location.href.includes('dashboard')) {
        alert('No hay sesión activa. Redirigiendo a login...');
        window.location.href = 'login.html';
    }
});
