# Comet Movies API Beta

Aplicación de portafolio construida con Node.js, Express y SQLite. Incluye catálogo visual, favoritos, perfiles editables y un panel administrativo con autorización por rol.

## Ejecutar

```powershell
cd net-api
Copy-Item .env.example .env
npm install
npm run check
npm start
```

Abre `http://localhost:3000`. La comprobación de disponibilidad está en `GET /api/health`.
o para la version en linea puedes usar `[http://localhost:3000](https://api-prueba-9hox.onrender.com/)`

## Accesos de demostración

Estas credenciales ficticias están expuestas intencionalmente en el login y pueden abrir cada panel con un clic. Se mantienen configurables en `.env` y se desactivan automáticamente cuando `NODE_ENV=production`.

| Rol | Usuario | Contraseña | Alcance |
|---|---|---|---|
| Administrador | `admin@comet.demo` | `Admin2026!` | Métricas, usuarios, roles y CRUD de películas y géneros. |
| Usuario | `viewer@comet.demo` | `Viewer2026!` | Catálogo, búsqueda, favoritos, edición de perfil y cambio de contraseña. |

## Módulos terminados

| Módulo | Funcionalidad |
|---|---|
| Autenticación | Registro, acceso, migración de hashes heredados y token firmado. |
| Usuarios | Perfil propio `/me`, correo único, elección de avatar aprobado, contraseña y administración de roles. |
| Avatares | Catálogo administrable; el usuario sólo puede elegir opciones activas y no puede subir archivos ni URLs. |
| Películas | Listado, detalle, CRUD con dos formatos de imagen y reproductor interno de tráiler de YouTube mediante doble clic. |
| Géneros | Listado público y CRUD administrativo con protección cuando existen películas asociadas. |
| Favoritos | Listado, alta idempotente, baja explícita, compatibilidad con alternado y control por propietario. |
| Actividad | Seguimiento de progreso entre 0 y 100, traspaso automático al historial y limpieza por propietario. |
| Apariencia | CRUD administrativo de enlaces visuales con vista previa, restauración y consumo dinámico desde todas las páginas. |

El contrato completo de rutas y cuerpos está en [docs/API.md](net-api/docs/API.md).

## Seguridad y validaciones

- Contraseñas protegidas con `scrypt`; las credenciales antiguas se migran al iniciar sesión.
- Token Bearer firmado y vencimiento configurable.
- Roles asignados y comprobados en el servidor; un usuario no puede promoverse a sí mismo.
- Validación compartida de registro, inicio de sesión, perfiles, avatares aprobados, contraseñas, películas, géneros, URL e identificadores.
- Límite de intentos, Helmet, CSP, compresión, consultas parametrizadas e índices SQLite.
- Respuestas `401`, `403`, `404` y `409` diferenciadas para que el frontend pueda guiar al usuario.

## Interfaz

El sistema visual oscuro está inspirado en paneles de contenido: navegación lateral, buscador superior, bloque destacado, tarjetas y vistas específicas por rol. Es responsive y no reproduce marcas de las referencias.

El administrador puede abrir **Apariencia** para cambiar sin tocar código:

- Fondo del acceso y registro.
- Fondo de la portada pública.
- Fondo del resumen administrativo.
- Portada predeterminada de películas.
- Avatar predeterminado de usuarios.

Los enlaces se guardan en SQLite, se validan como HTTP/HTTPS y pueden restaurarse a su valor inicial.

SQLite y las cuentas demo son apropiadas para evaluación local. No uses datos personales reales ni publiques secretos del archivo `.env`.
