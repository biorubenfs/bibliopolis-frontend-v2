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
pnpm run build --configuration dev           # build para el servidor de desarrollo remoto
pnpm test                                    # Vitest (jsdom) vía @angular/build:unit-test, en modo watch
pnpm test --watch=false                      # una sola pasada (para comprobar antes de terminar)
pnpm test --include src/app/foo.spec.ts      # un único fichero de test
pnpm ng generate component <ruta/nombre>     # scaffolding con la CLI local
```

Formato con Prettier (`.prettierrc`: printWidth 100, comillas simples, parser `angular` para HTML). No hay ESLint configurado.

Node 22 (gestionado con nvm). Angular 22 exige Node ≥ 22.22.3, por eso el proyecto está en Angular 21; si se actualiza Node se puede migrar con `pnpm ng update`.

## Despliegue

`.github/workflows/deploy.yml` compila con pnpm y copia `dist/bibliopolis-frontend-v2/browser/` al VPS con rsync. Un push a `main` despliega en el entorno `dev` de GitHub (`--configuration dev`) y un push a `production`, en el entorno `production`. También se puede lanzar a mano eligiendo el entorno. Los secretos `VPS_*` se configuran en GitHub.

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

## Guía visual

Material 3 (`mat.theme` en `src/styles.scss`) con la paleta verde de la marca y los dos esquemas de color (`color-scheme: light dark`): los tokens `--mat-sys-*` se definen con `light-dark()` y el navegador elige. `ThemeService` (`core/theme/`) fija el esquema elegido por el usuario en `<html style="color-scheme">` y lo guarda en `localStorage`; el botón de cambio está en la barra lateral, sobre «Cerrar sesión».

- **Colores siempre por tokens** (`var(--mat-sys-…)` o los `--app-*` de `styles.scss`); nunca literales hexadecimales en los SCSS, salvo la barra lateral (`shell.scss`, con `light-dark()`) y los visores de cámara. Un literal rompe el modo oscuro.
- **Tipografía**: Inter en toda la interfaz; los títulos de página usan `font: var(--app-font-title)` con `letter-spacing: var(--app-font-title-tracking)`. Lora (`--app-font-display`) solo para la marca (wordmark del login y de la barra superior, inicial del avatar).
- **Densidad -1** global: campos de 48 px, botones de 36 px. Los buscadores en píldora usan radio 24 px y la clase global `app-tonal-field` (relleno tonal sin borde).
- **Tarjetas** (bibliotecas, libros, perfil): sin borde, `border-radius: var(--app-card-radius)`, `background: var(--app-card-background)` y `box-shadow: var(--app-card-shadow)` (`--app-card-shadow-hover` al pasar el ratón).
- **Chips de filtro** tonales en píldora (tokens `--mat-chip-*` en `libraries-page.scss`); el filtro de etiquetas imita ese aspecto.
- La barra lateral es oscura, pegada a los bordes y sin esquinas redondeadas (colores con `light-dark()` en `shell.scss`); el usuario descartó la variante de panel flotante.

## Contrato con el backend

Referencia completa: `../bibliopolis-backend/docs/index.md` (autenticación, formato de respuestas, paginación, tabla de códigos de error) y una página por recurso en `../bibliopolis-backend/docs/api/` (`auth`, `users`, `books`, `libraries`, `user-books`, `external`, `imports`). Consultarla antes de implementar una llamada; no inventar campos ni endpoints.

### URLs por entorno

| Entorno | Configuración | Fichero | `apiUrl` |
|---|---|---|---|
| Local (`pnpm start`) | `development` | `environment.development.ts` | `http://localhost:3000` |
| Servidor de desarrollo | `dev` | `environment.dev.ts` | `https://dev.bibliopolis.es/api` |
| Producción | `production` | `environment.ts` | `https://bibliopolis.es/api` |

La URL base se lee de `src/environments/` (con `fileReplacements` en `angular.json`); nunca escribirla a mano en un servicio.

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
