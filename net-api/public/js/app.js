const form = document.querySelector('#loginForm');
const message = document.querySelector('#message');

function setMessage(text, success = false) {
  message.textContent = text;
  message.classList.toggle('success', success);
}

const DEMO_ROLES = {
  admin: { label: 'Administrador', action: 'Entrar como admin' },
  user: { label: 'Espectador', action: 'Entrar como espectador' },
};

// Delegación: las filas se crean después de consultar al servidor, así que el
// listener no puede adjuntarse en tiempo de carga.
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-demo-email]');
  if (!button) return;
  form.elements.correo.value = button.dataset.demoEmail;
  form.elements.password.value = button.dataset.demoPassword;
  setMessage('Credencial pública de prueba cargada.', true);
  if (button.hasAttribute('data-demo-submit')) form.requestSubmit();
});

async function loadDemoAccess() {
  const panel = document.querySelector('#demoPanel');
  const rows = document.querySelector('#demoRows');
  if (!panel || !rows) return;
  try {
    const response = await fetch('/api/auth/demo');
    if (!response.ok) return;
    const data = await response.json();
    if (!data.enabled || !Array.isArray(data.users) || data.users.length === 0) return;

    for (const user of data.users) {
      const role = DEMO_ROLES[user.rol] || { label: user.rol, action: `Entrar como ${user.rol}` };
      const row = document.createElement('div');
      row.className = 'demo-row';

      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = role.label;
      const credentials = document.createElement('small');
      credentials.textContent = `${user.correo} · ${user.password}`;
      info.append(title, credentials);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'demo-use';
      button.dataset.demoEmail = user.correo;
      button.dataset.demoPassword = user.password;
      button.setAttribute('data-demo-submit', '');
      button.textContent = role.action;

      row.append(info, button);
      rows.append(row);
    }
    panel.hidden = false;
  } catch {
    // Sin acceso demo disponible: el panel se queda oculto.
  }
}

loadDemoAccess();

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const correo = form.elements.correo.value.trim().toLowerCase();
  const contraseña = form.elements.password.value;
  if (!/^\S+@\S+\.\S+$/.test(correo) || contraseña.length < 8) {
    setMessage('Escribe un correo válido y una contraseña de al menos 8 caracteres.');
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  setMessage('Validando acceso…');
  try {
    const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo, contraseña }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No fue posible iniciar sesión.');
    sessionStorage.setItem('cometSession', JSON.stringify({ user: data.usuario, token: data.token }));
    window.location.replace(data.usuario.rol === 'admin' ? 'dashboard-root.html' : 'dashboard-user.html');
  } catch (error) {
    setMessage(error.message);
    submit.disabled = false;
  }
});
