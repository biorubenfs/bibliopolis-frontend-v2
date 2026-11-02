# CLAUDE.md

Este fichero da indicaciones a Claude Code (claude.ai/code) para trabajar con el código de este repositorio.

## Visión general

Bibliopolis frontend v2: SPA en Angular 21 para gestionar bibliotecas personales de libros (bibliotecas del usuario, sus libros, exploración del catálogo y escaneo de ISBN). Sustituye a `../bibliopolis-frontend`, con una interfaz más moderna y algunos cambios funcionales.

- El backend está en `../bibliopolis-backend` (API REST con Express y MongoDB). Su documentación de la API, en `../bibliopolis-backend/docs/`, es la fuente de verdad del contrato.
- `../bibliopolis-frontend` sirve de referencia para las reglas de negocio y los flujos existentes, pero **no** hay que copiar su comportamiento sin más: el usuario indicará qué cambia en cada funcionalidad. Ante la duda, preguntar.
- Los textos de la interfaz y los mensajes de error que ve el usuario están en español.
- El proyecto se empezó desde la plantilla de `ng new` (zoneless, SCSS, sin SSR) y se irá construyendo pantalla a pantalla.

## Comandos

El gestor de paquetes es **pnpm** (v10, fijado en `packageManager` de `package.json`). No se instala nada de forma global: la CLI de Angular es una dependencia del proyecto y se usa con `pnpm ng …`.

```bash
pnpm install
pnpm start                                   # ng serve en http://localhost:4200
pnpm run build                               # build de producción -> dist/bibliopolis-frontend-v2/browser
pnpm test                                    # Vitest (jsdom) vía @angular/build:unit-test, en modo watch
pnpm test --watch=false                      # una sola pasada (para comprobar antes de terminar)
pnpm test --include src/app/foo.spec.ts      # un único fichero de test
pnpm ng generate component <ruta/nombre>     # scaffolding con la CLI local
```

Formato con Prettier (`.prettierrc`: printWidth 100, comillas simples, parser `angular` para HTML). No hay ESLint configurado.

Node 22 (gestionado con nvm). Angular 22 exige Node ≥ 22.22.3, por eso el proyecto está en Angular 21; si se actualiza Node se puede migrar con `pnpm ng update`.

## Convenciones de Angular y TypeScript

### TypeScript

- Tipado estricto. Preferir la inferencia cuando el tipo es obvio.
- Evitar `any`; usar `unknown` cuando el tipo sea incierto.

### Componentes

- Siempre standalone, sin NgModules. **No** poner `standalone: true` en el decorador (es el valor por defecto desde Angular 20).
- `changeDetection: ChangeDetectionStrategy.OnPush` en todos los componentes.
- `input()` / `output()` / `model()` en lugar de los decoradores `@Input` / `@Output`.
- No usar `@HostBinding` ni `@HostListener`: las host bindings van en el objeto `host` del decorador.
- Componentes pequeños y con una sola responsabilidad. Plantilla inline solo si es pequeña; si no, ficheros aparte con rutas relativas al `.ts`.
- Formularios reactivos (o signal forms, cuando sean estables), no template-driven.
- `NgOptimizedImage` para imágenes estáticas (no funciona con imágenes base64 inline).

### Estado

- Signals para el estado local; `computed()` para el estado derivado.
- Nunca `mutate` en signals: usar `set` o `update`.
- Transformaciones de estado puras y predecibles.

### Plantillas

- Control flow nativo (`@if`, `@for`, `@switch`); nunca `*ngIf`, `*ngFor`, `*ngSwitch`.
- Bindings `[class.x]` / `[style.x]`; nunca `ngClass` ni `ngStyle`.
- Plantillas sencillas: sin arrow functions (no están soportadas) ni lógica compleja; moverla a `computed()` o al componente.
- No asumir globales en la plantilla (p. ej. `new Date()`).
- Pipe `async` para observables, o convertirlos a signal con `toSignal()`.

### Servicios y rutas

- Un servicio por responsabilidad, `providedIn: 'root'` para los singleton.
- `inject()` en lugar de inyección por constructor.
- Todas las rutas de página con lazy loading (`loadComponent`).

### Accesibilidad

- Debe pasar todas las comprobaciones de AXE.
- Debe cumplir WCAG AA: gestión del foco, contraste de color, atributos ARIA, controles con `<label>`, botones de solo icono con `aria-label`.

## Contrato con el backend

Referencia completa: `../bibliopolis-backend/docs/index.md` (autenticación, formato de respuestas, paginación, tabla de códigos de error) y una página por recurso en `../bibliopolis-backend/docs/api/` (`auth`, `users`, `books`, `libraries`, `user-books`, `external`). Consultarla antes de implementar una llamada; no inventar campos ni endpoints.

### URLs por entorno

| Entorno | `apiUrl` |
|---|---|
| Local (`pnpm start`) | `http://localhost:3000` |
| Servidor de desarrollo | `https://dev.bibliopolis.es/api` |
| Producción | `https://bibliopolis.es/api` |

La URL base se leerá de `src/environments/` (con `fileReplacements` en `angular.json`); nunca escribirla a mano en un servicio.

### Formato de las respuestas

```jsonc
{ "results": { "type": "libraries", "id": "<ulid>", "attributes": { … } } }        // recurso único
{ "results": [ … ], "paginationInfo": { "skip": 0, "limit": 10, "total": 100 } }  // colección
{ "statusCode": 400, "errorCode": "INVALID_BODY", "message": "…", "validationError": [ … ] } // error
```

- Los IDs son ULIDs (string) y las fechas, ISO 8601.
- Las colecciones se paginan con los query params `skip` y `limit`. En la UI se maneja página actual y tamaño de página y se calcula `skip`.
- Aplanar los recursos en los servicios (`{ ...item.attributes, id: item.id }`) para que los componentes trabajen con modelos planos, no con el envoltorio de la API.
- Errores: convertir `HttpErrorResponse` en un error con el `message` del backend (`ApiError`), para mostrarlo al usuario.

### Autenticación

- `POST /auth/login` devuelve un único JWT (sin refresh token ni cookies). Caduca a los 7 días por defecto.
- Se envía en la cabecera `Authorization: Bearer <token>` en todas las peticiones salvo `/auth/login` (con un interceptor funcional).
- No hay logout en el servidor: cerrar sesión es borrar el token en el cliente.
- `GET /auth/me` devuelve el usuario autenticado; sirve para validar un token guardado al arrancar la app.
- Una respuesta 401 significa token ausente, inválido o caducado: limpiar la sesión y redirigir al login.
- El token incluye el rol (`regular` o `admin`); algunos endpoints son solo para administradores.

## Acuerdo de trabajo (para Claude)

- El usuario escribe en español y las respuestas van en español. El código, los comentarios, los commits y los PRs van en inglés; los textos de la interfaz, en español.
- Trabajar en una rama, nunca hacer commit directamente en `main`. Ramas `feature/…`, `fix/…`, `refactor/…`, `chore/…`, `docs/…`; mensajes de commit con Conventional Commits, solo asunto (una línea), sin cuerpo ni trailers (tampoco `Co-Authored-By`), salvo que el usuario indique lo contrario.
- Antes de dar un cambio por terminado, ejecutar `pnpm run build` y `pnpm test --watch=false`.
- Limitar los cambios a la tarea; proponer las refactorizaciones no relacionadas en lugar de hacerlas.
- El usuario no es desarrollador frontend: explicar brevemente las decisiones técnicas de UI cuando sean relevantes y proponer una recomendación en lugar de una lista de opciones.
