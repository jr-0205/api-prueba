# Contrato de Comet Movies API

Base local: `http://localhost:3000/api`. Las rutas protegidas reciben `Authorization: Bearer <token>`.

## Autenticación

| Método y ruta | Acceso | Cuerpo principal |
|---|---|---|
| `POST /register` | Público | `nombre`, `correo`, `contraseña`; asigna el primer avatar activo. |
| `POST /login` | Público | `correo`, `contraseña`; abre una sesión y devuelve el `token` con su `expira_en`. |
| `POST /logout` | Sesión | Revoca la sesión del token actual. |

Una contraseña nueva debe contener entre 8 y 128 caracteres, al menos una letra y un número. El correo se normaliza a minúsculas.

Cada `login` abre una sesión identificada por un `jti` firmado dentro del token. El servidor guarda las sesiones en la tabla `sesiones` y valida el `jti` en cada petición protegida, por lo que un `logout`, un límite de sesiones o una revocación invalidan el token de inmediato. Se permiten como máximo `MAX_SESSIONS_PER_USER` sesiones simultáneas por usuario (3 por defecto); al superarlo se revocan las más antiguas. Los `jti` caducados se depuran al iniciar sesión.

## Usuarios

| Método y ruta | Acceso | Resultado |
|---|---|---|
| `GET /users/me` | Sesión | Perfil vigente del token. |
| `PATCH /users/me` | Sesión | Cambia `nombre`, `correo` o `avatarId`; rechaza URLs de imagen. |
| `PATCH /users/me/password` | Sesión | Verifica `contraseñaActual` y cambia a `contraseñaNueva` cuando coincide `confirmacion`. |
| `GET /users` | Administrador | Lista segura de usuarios, sin hashes. |
| `GET /users/:id` | Propietario o administrador | Perfil solicitado. |
| `PUT/PATCH /users/:id` | Propietario o administrador | Actualización compatible por identificador. |
| `PATCH /users/:id/role` | Administrador | Cambia `rol` entre `admin` y `user`; impide cambiar el rol propio. |

Los usuarios no pueden subir archivos ni introducir enlaces de perfil. Sólo pueden seleccionar un `avatarId` activo del catálogo aprobado por el administrador. Los correos duplicados, sin importar mayúsculas, producen `409 Conflict`.

## Avatares de perfil

| Método y ruta | Acceso | Semántica |
|---|---|---|
| `GET /avatars` | Sesión | Para usuarios devuelve sólo los activos; para administradores incluye todos y su cantidad de asignaciones. |
| `POST /avatars` | Administrador | Crea un avatar con `nombre`, `url` HTTP/HTTPS y `activo`. |
| `PUT /avatars/:id` | Administrador | Actualiza nombre, imagen o disponibilidad. |
| `DELETE /avatars/:id` | Administrador | Elimina únicamente avatares que no estén asignados. |

El arranque incluye seis opciones beta. Un avatar asignado puede desactivarse para impedir nuevas selecciones sin romper las cuentas que ya lo utilizan.

## Películas y géneros

| Método y ruta | Acceso |
|---|---|
| `GET /movies`, `GET /movies/:id` | Público |
| `POST /movies`, `PUT /movies/:id`, `DELETE /movies/:id` | Administrador |
| `GET /genres`, `GET /genres/:id` | Público |
| `POST /genres`, `PUT /genres/:id`, `DELETE /genres/:id` | Administrador |

Las películas validan título, año, duración, sinopsis, URLs y existencia del género. `imagenVertical` se usa en tarjetas generales (recomendado 4:5 o 2:3) e `imagenHorizontal` en carruseles y destacados (recomendado 16:9). Las respuestas exponen `imagen_vertical` e `imagen_horizontal`; `imagen` permanece como alias de la portada vertical para clientes anteriores. Solo se admiten enlaces HTTP/HTTPS.

El campo `trailer` acepta enlaces de YouTube en formatos `watch?v=`, `youtu.be`, `embed`, `shorts` y `live`. El frontend los transforma a `youtube-nocookie.com/embed` y los reproduce dentro de Comet: al seleccionar una tarjeta se abre la pantalla de detalle y desde ahí el botón "Reproducir" abre el reproductor a pantalla completa.

Al eliminar una película se limpian sus favoritos. Un género con películas asociadas no puede eliminarse.

## Favoritos

| Método y ruta | Acceso | Semántica |
|---|---|---|
| `GET /favoritos/:usuarioId` | Propietario o administrador | Lista de favoritos. |
| `PUT /favoritos/:usuarioId/:peliculaId` | Propietario o administrador | Agrega de forma idempotente. |
| `DELETE /favoritos/:usuarioId/:peliculaId` | Propietario o administrador | Elimina explícitamente. |
| `POST /favoritos/:usuarioId` | Propietario o administrador | Alterna por compatibilidad; recibe `peliculaId`. |

## Actividad

| Método y ruta | Acceso | Semántica |
|---|---|---|
| `GET /progress/:usuarioId` | Propietario o administrador | Películas que se continúan viendo. |
| `PUT /progress/:usuarioId/:peliculaId` | Propietario o administrador | Guarda `progreso` entero de 0 a 100. |
| `DELETE /progress/:usuarioId/:peliculaId` | Propietario o administrador | Retira el seguimiento. |
| `GET /history/:usuarioId` | Propietario o administrador | Historial ordenado por fecha. |
| `POST /history/:usuarioId` | Propietario o administrador | Marca como vista; recibe `peliculaId`. |
| `DELETE /history/:usuarioId/:historyId` | Propietario o administrador | Elimina una entrada. |
| `DELETE /history/:usuarioId` | Propietario o administrador | Limpia todo el historial. |

Un progreso de `100` retira la película de “seguir viendo” y la registra una sola vez por día en el historial. Un progreso de `0` elimina el seguimiento sin marcarla como vista.

## Configuración visual

| Método y ruta | Acceso | Semántica |
|---|---|---|
| `GET /settings` | Público | Devuelve el mapa efectivo de enlaces que consume el frontend. |
| `GET /settings/admin` | Administrador | Devuelve etiquetas, descripción, valor inicial y estado de personalización. |
| `POST /settings` | Administrador | Guarda una clave permitida mediante `{ key, value }`. |
| `PUT /settings/:key` | Administrador | Actualiza un enlace mediante `{ value }`. |
| `DELETE /settings/:key` | Administrador | Elimina la personalización y restaura el valor inicial. |

Las claves permitidas son `auth_background_url`, `landing_background_url`, `admin_hero_background_url`, `movie_fallback_url` y `avatar_fallback_url`. No se admiten protocolos distintos a HTTP/HTTPS.

## Errores

- `400`: formato o validación incorrecta.
- `401`: token o credenciales inválidas.
- `403`: el rol o propietario no coincide.
- `404`: recurso inexistente.
- `409`: correo, género o relación en conflicto.
- `429`: límite temporal alcanzado.
