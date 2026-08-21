const form = document.querySelector('#loginForm');
const message = document.querySelector('#message');

function setMessage(text, success = false) {
  message.textContent = text;
  message.classList.toggle('success', success);
}

document.querySelectorAll('[data-demo-email]').forEach((button) => {
  button.addEventListener('click', () => {
    form.elements.correo.value = button.dataset.demoEmail;
    form.elements.password.value = button.dataset.demoPassword;
    setMessage('Credencial pública de prueba cargada.', true);
    if (button.hasAttribute('data-demo-submit')) form.requestSubmit();
  });
});

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
