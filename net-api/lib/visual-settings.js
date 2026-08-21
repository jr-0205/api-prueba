const VISUAL_SETTINGS = Object.freeze({
  auth_background_url: {
    label: 'Fondo de acceso y registro',
    description: 'Imagen lateral utilizada en las pantallas de inicio de sesión y creación de cuenta.',
    defaultValue: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1400&q=80',
  },
  landing_background_url: {
    label: 'Fondo de portada',
    description: 'Imagen de fondo de la página inicial pública.',
    defaultValue: 'https://i.pinimg.com/originals/b4/ba/75/b4ba75f4371e5077d83bd0613f9929cb.jpg',
  },
  admin_hero_background_url: {
    label: 'Fondo del resumen administrativo',
    description: 'Imagen destacada del encabezado principal del panel administrador.',
    defaultValue: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1600&q=80',
  },
  movie_fallback_url: {
    label: 'Portada de película predeterminada',
    description: 'Se muestra cuando una película no tiene una imagen propia.',
    defaultValue: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=75',
  },
  avatar_fallback_url: {
    label: 'Avatar predeterminado',
    description: 'Se muestra cuando el usuario no ha configurado una imagen de perfil.',
    defaultValue: 'https://ui-avatars.com/api/?name=Comet&background=7c5cff&color=fff',
  },
});

function publicSettings(rows = []) {
  const stored = new Map(rows.map((row) => [row.clave, row.valor]));
  return Object.fromEntries(Object.entries(VISUAL_SETTINGS).map(([key, setting]) => [key, stored.get(key) || setting.defaultValue]));
}

module.exports = { publicSettings, VISUAL_SETTINGS };
