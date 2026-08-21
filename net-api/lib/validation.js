const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function validateEmail(value) {
  const correo = normalizeEmail(value);
  return EMAIL_PATTERN.test(correo) && correo.length <= 254 ? correo : null;
}

function validatePassword(value) {
  const password = String(value || '');
  const errors = [];
  if (password.length < 8 || password.length > 128) errors.push('La contraseña debe contener entre 8 y 128 caracteres.');
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) errors.push('La contraseña debe incluir al menos una letra y un número.');
  if (CONTROL_CHARACTERS.test(password)) errors.push('La contraseña contiene caracteres de control no permitidos.');
  return { valid: errors.length === 0, errors, value: password };
}

function normalizeHttpUrl(value, maxLength = 500, label = 'La URL') {
  const rawUrl = String(value || '').trim();
  if (!rawUrl) return { valid: true, value: null };
  if (rawUrl.length > maxLength) return { valid: false, error: `${label} no puede superar ${maxLength} caracteres.` };
  try {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    return { valid: true, value: url.toString() };
  } catch {
    return { valid: false, error: `${label} debe usar una URL HTTP o HTTPS válida.` };
  }
}

function validateProfileUpdate(body = {}, current = {}) {
  const nombre = normalizeName(Object.hasOwn(body, 'nombre') ? body.nombre : current.nombre);
  const correo = validateEmail(Object.hasOwn(body, 'correo') ? body.correo : current.correo);
  const avatarId = Object.hasOwn(body, 'avatarId') ? parsePositiveInteger(body.avatarId) : current.avatar_id;
  const errors = [];
  if (nombre.length < 2 || nombre.length > 80 || CONTROL_CHARACTERS.test(nombre)) errors.push('El nombre debe contener entre 2 y 80 caracteres válidos.');
  if (!correo) errors.push('El correo no tiene un formato válido.');
  if (Object.hasOwn(body, 'imagen')) errors.push('La foto de perfil debe elegirse del catálogo de avatares.');
  if (Object.hasOwn(body, 'avatarId') && !avatarId) errors.push('El avatar seleccionado no es válido.');
  return { valid: errors.length === 0, errors, value: { nombre, correo, avatarId } };
}

function validateLogin(body = {}) {
  const correo = validateEmail(body.correo);
  const password = String(body.contraseña || '');
  const errors = [];
  if (!correo) errors.push('El correo no tiene un formato válido.');
  if (password.length < 8 || password.length > 128 || CONTROL_CHARACTERS.test(password)) errors.push('La contraseña no cumple el formato requerido.');
  return { valid: errors.length === 0, errors, value: { correo, password } };
}

function validateRegistration(body = {}) {
  const nombre = normalizeName(body.nombre);
  const correo = validateEmail(body.correo);
  const passwordValidation = validatePassword(body.contraseña);
  const password = passwordValidation.value;
  const errors = [];

  if (nombre.length < 2 || nombre.length > 80 || CONTROL_CHARACTERS.test(nombre)) errors.push('El nombre debe contener entre 2 y 80 caracteres válidos.');
  if (!correo) errors.push('El correo no tiene un formato válido.');
  errors.push(...passwordValidation.errors);

  return { valid: errors.length === 0, errors, value: { nombre, correo, password } };
}

function parsePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

module.exports = {
  normalizeEmail,
  normalizeHttpUrl,
  normalizeName,
  parsePositiveInteger,
  validateEmail,
  validateLogin,
  validatePassword,
  validateProfileUpdate,
  validateRegistration,
};
