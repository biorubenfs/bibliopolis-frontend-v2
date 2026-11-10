# Plan: dashboard de estadísticas de un usuario en el backoffice

Plan para ejecutar en una sesión nueva. Es autocontenido. Afecta a dos repositorios: `../bibliopolis-backend` y este. Las convenciones de cada uno están en su `CLAUDE.md`.

Estado a 2026-11-09: backend con commit `96f13b7` en `feature/user-stats` (sin subir). Frontend **implementado sin commit** en `feature/user-stats` (desde `main` local `65ddd73`), pendiente de la revisión del usuario. **El top 5 se quitó** (sin títulos no aportaba nada frente a la distribución). El usuario aceptó las cuatro propuestas, con un cambio en la de privacidad: **solo cifras, nunca nombres**. El contrato definitivo está en `../bibliopolis-backend/docs/api/users.md` (`GET /users/:id` y `GET /users/:id/stats`); manda sobre el de este plan.

## Objetivo

En el backoffice, al pulsar un usuario de la lista se abre una página con estadísticas de sus datos:

1. Número de bibliotecas.
2. Media de libros por biblioteca.
3. Biblioteca más grande.
4. Distribución de las valoraciones (1–10).
5. Libros valorados frente a libros sin valorar.
6. Top 5 de libros mejor valorados.
7. Libros que no están en ninguna biblioteca.

**Restricción del usuario: no se toca el modelo de datos.** Todo sale de las colecciones `libraries` y `user_books` tal como están, sin campos nuevos ni migraciones. Por eso quedan fuera las métricas temporales (último libro añadido, actividad por mes): `user_books` no guarda `createdAt` (ver «Fuera de este plan»).

## Contexto comprobado

- `libraries`: `{ _id, name, description, userId, books: string[] (IDs de user-books), isFavorite, tagIds, createdAt, updatedAt }`. El número de libros que muestra la aplicación es `books.length`.
- `user_books`: único por `{ userId, bookId }`. `libraries: string[]` lista las bibliotecas que lo contienen. Quitar un libro de una biblioteca solo hace `$pull` (`user-books.dao.ts`, `delete` y `deleteAll`): el documento no se borra nunca, así que un libro quitado de todas sus bibliotecas queda con `libraries: []`. «Mis libros» (`GET /user-books`) filtra solo por `userId`, de modo que esos libros se siguen viendo allí.
- `rating`: `null` o un entero de 1 a 10.
- Un admin no tiene bibliotecas (`checkRegular` responde 403 en `/libraries`, `/user-books`, `/imports` y `/tags`).
- No existe `GET /users/:id`: el backoffice solo tiene `GET /users` (lista paginada, sin avatar), `POST /users` y `POST /users/:id/password-reset`, todos con `checkAdmin`.
- El frontend no tiene ninguna librería de gráficas, solo Angular Material.

## Decisiones (confirmadas)

| Tema | Propuesta |
|---|---|
| **Privacidad** | **Decidido: solo cifras, nunca nombres.** La biblioteca más grande se da solo como número de libros (`largestBooks`) y el top 5 solo como valoraciones (`top: [10, 9, 9, 7, 7]`), sin títulos, autores ni portadas. Hay que anotar en `backoffice.md` que el admin ve estas cifras |
| Usuarios admin | La fila de un admin no es pulsable, porque no tiene datos. El endpoint responde **404** si el usuario no existe o es admin, con el mismo error en los dos casos |
| Endpoints | `GET /users/:id` (datos del usuario, para la cabecera de la página, sin avatar como en la lista) y `GET /users/:id/stats`. Los dos con `checkAdmin`. Así la página funciona al recargar o al abrir el enlace directamente, sin depender del estado del router |
| Libros que cuentan | Todos los user-books del usuario, estén o no en alguna biblioteca, igual que en «Mis libros». Las valoraciones y el top 5 incluyen los libros sin biblioteca |
| Media de libros por biblioteca | `suma de books.length / número de bibliotecas`. Un libro que está en dos bibliotecas cuenta en las dos. Con 0 bibliotecas, `0`. El backend devuelve el valor sin redondear y el frontend lo muestra con un decimal |
| Biblioteca más grande | Solo su número de libros. `null` si no tiene bibliotecas |
| Top 5 | Solo las valoraciones de los cinco libros mejor valorados, de mayor a menor |
| Distribución | Siempre las 10 claves (de `1` a `10`), con 0 donde no haya libros, para que el frontend no tenga que rellenar huecos |
| Total y media de valoración | No se piden, pero salen gratis de la distribución: `totalBooks = rated + unrated` y la media se calcula en el backend con `$avg`. **Propuesta:** devolverlas y mostrarlas como dos tarjetas más. Se pueden quitar si no se quieren |
| Gráfica | Barras horizontales hechas con HTML y CSS, sin librería: son 10 barras. Cada barra lleva su cifra en texto, para no depender del color ni del tamaño |

## Backend

### Contrato

Ver `../bibliopolis-backend/docs/api/users.md` (`GET /users/:id/stats`), que es la referencia. En resumen: `libraries { count, averageBooks, largestBooks }`, `books { total, rated, unrated, withoutLibrary }` y `ratings { average, distribution (siempre las 10 claves), top (números) }`. El `type` es `user-stats`, sin `id`. 404 si el usuario no existe o es admin; 403 si no llama un admin.

### Consultas

Dos agregaciones en paralelo (`Promise.all`), cada una en su DAO:

- **`librariesDao.statsByUser(userId)`**: `$match { userId }` → `$project { name, size: { $size: '$books' } }` → `$facet` con `count`/suma (`$group`) y la mayor (`$sort { size: -1, _id: 1 }`, `$limit 1`).
- **`userBooksDao.statsByUser(userId)`**: `$match { userId }` → `$facet` con:
  - totales: `$group` con `total`, `rated` (`rating != null`), `withoutLibrary` (`$size: '$libraries'` igual a 0) y `average` (`$avg: '$rating'`, que ignora los `null`);
  - distribución: `$match { rating: { $ne: null } }` → `$group { _id: '$rating', count }`;
  - top: `$match { rating: { $ne: null } }` → `$sort { rating: -1, _id: -1 }` → `$limit 5`.

El índice `{ userId: 1, bookId: 1 }` de `user_books` sirve para el `$match` por `userId`. `libraries` ya debería tener un índice por `userId`; hay que comprobarlo en `libraries.dao.ts`. Si no lo tiene, **no** se añade en este plan: se anota.

El servicio (`usersService.getStats`) comprueba el usuario, junta los dos resultados, rellena las 10 claves de la distribución y convierte las portadas con `getCoverUrl`.

### Ficheros

- `users.router.ts`: `GET /:id` y `GET /:id/stats` con `checkAdmin`. Deben ir **después** de las rutas `/me`, para que `me` no se tome como un `:id`.
- `users.service.ts`: `getByIdForAdmin(id)` y `getStats(id)`.
- `users.interfaces.ts`: tipo `UserStats`.
- `libraries.dao.ts` y `user-books.dao.ts`: `statsByUser`.
- `docs/api/users.md`: documentar los dos endpoints.
- Tests de integración en `users.test.ts` (o en un `user-stats.test.ts` nuevo):
  - usuario sin bibliotecas ni libros: todo a 0, `largest: null`, `average: null`, `top: []` y las 10 claves de la distribución a 0;
  - usuario con varias bibliotecas, un libro en dos bibliotecas y otro sin biblioteca: comprobar cada cifra;
  - empates en la biblioteca más grande y en el top 5;
  - más de 5 libros valorados: solo vuelven 5 y en el orden correcto;
  - los datos de otro usuario no se mezclan;
  - 404 con un usuario inexistente y con un admin; 403 si llama un regular;
  - `GET /users/:id`: 200 sin avatar, 404 y 403.

## Frontend

### Ruta y navegación

- Ruta nueva hija de `backoffice`: `users/:id` → `BackofficeUserStatsPage` (lazy, como las demás).
- En `backoffice-users-page.html`, el nombre de un usuario `regular` pasa a ser un enlace (`routerLink`) a `users/:id`. No toda la fila: dentro está el botón de restablecer la contraseña, y una fila pulsable con un botón dentro da problemas de accesibilidad. Las filas de admin siguen como hasta ahora.
- La página tiene un enlace «Volver a usuarios» que conserva la búsqueda y la página de la lista. Hay que comprobar si `SearchableList` las guarda en la URL; si es así, basta con volver atrás con los mismos query params.

### Servicio

En `ManagedUsersService`: `get(id)` y `getStats(id)`, con el mismo manejo de errores (`toApiError`). Tipo `UserStats` en un `user-stats.model.ts` dentro de `features/backoffice/users/`.

### Página

Estados: cargando, error (con «Reintentar»), 404 («Este usuario no existe») y cargado. Contenido de arriba abajo:

1. **Cabecera**: nombre, email y fecha de alta.
2. **Tarjetas** (rejilla que pasa a una columna en móvil): bibliotecas · media de libros por biblioteca · libros de la biblioteca más grande · libros totales · valoración media · libros sin biblioteca.
3. **Valorados frente a sin valorar**: una barra apilada con el porcentaje y las dos cifras en texto.
4. **Distribución de valoraciones**: 10 barras horizontales, de 10 a 1, con la cifra al lado. Si no hay valoraciones, un mensaje en lugar de la gráfica.
5. **Top 5**: solo las cinco valoraciones más altas (sin títulos ni portadas, por privacidad).

Usuario sin datos: se muestra la página con ceros y un aviso del tipo «Este usuario todavía no tiene bibliotecas ni libros», sin gráficas vacías.

Colores: los tokens del tema actual (variante B Material, ver la memoria de dirección visual), sin colores nuevos fijos.

### Tests

- `backoffice-user-stats-page.spec.ts`: cada estado, el usuario sin datos y que la distribución pinte las 10 barras con sus cifras.
- `managed-users.service.spec.ts`: `get` y `getStats` (URL y mapeo).
- `backoffice-users-page.spec.ts`: el nombre de un regular es un enlace y el de un admin no.

## Orden de trabajo

1. Backend: DAO, servicio, rutas, tests y documentación. Commit.
2. Frontend: modelo, servicio, página, enlace desde la lista y tests. Commit.
3. Prueba manual con el seed (`pnpm run seed`) y un usuario con varias bibliotecas.
4. Revisión del usuario antes de los commits (ver la memoria «avisar antes de cambiar»).

## Fuera de este plan

- **Métricas temporales** (último libro añadido, actividad por mes). Necesitan que `UserBooksDao.upsert` guarde `createdAt`/`updatedAt`, que hoy no guarda aunque el modelo los declara (anotado en los refactors pendientes). Aun así, `createdAt` solo diría cuándo entró el libro por primera vez en la colección, no cuándo se añadió a cada biblioteca. Para eso haría falta `lastAddedAt` o una fecha por biblioteca.
- Autores más frecuentes, etiquetas y resultado de las importaciones: candidatos para una segunda versión, sin cambios en el modelo.
- Último acceso del usuario: necesita un campo nuevo (`lastLoginAt`).
