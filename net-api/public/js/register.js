const form = document.querySelector('#registerForm');
const message = document.querySelector('#message');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const errors = [];
  const normalizedName = data.nombre.trim().replace(/\s+/g, ' ');
  if (normalizedName.length < 2 || normalizedName.length > 80 || /[\u0000-\u001f\u007f]/.test(normalizedName)) errors.push('Escribe un nombre válido de 2 a 80 caracteres.');
  if (!/^\S+@\S+\.\S+$/.test(data.correo.trim())) errors.push('El correo no es válido.');
  if (data.contraseña.length < 8) errors.push('La contraseña requiere al menos 8 caracteres.');
  if (!/\p{L}/u.test(data.contraseña) || !/\d/.test(data.contraseña)) errors.push('La contraseña debe incluir al menos una letra y un número.');
  if (data.contraseña !== data.confirmacion) errors.push('Las contraseñas no coinciden.');
  if (errors.length) { message.textContent = errors.join(' '); return; }
  try {
    const response = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: normalizedName, correo: data.correo.trim(), contraseña: data.contraseña }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.details?.join(' ') || payload.error);
    message.textContent = 'Cuenta creada. Ahora puedes iniciar sesión.';
    message.classList.add('success');
    setTimeout(() => window.location.replace('login.html'), 900);
  } catch (error) { message.textContent = error.message || 'No fue posible crear la cuenta.'; }
});
