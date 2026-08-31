# Análisis de Arquitectura — Fullpetro

Fecha: 19/08/2026
Proyecto: `C:\Users\PASANTETI-FP\Documents\API - Fullpetro`

Este documento recopila el análisis completo de backend y frontend tal como están hoy, todos los errores detectados, las observaciones de seguridad y las sugerencias de modificación priorizadas.

---

## 1. Backend — Estructura actual

### 1.1 Árbol

```
backend\
├── .env                          (credenciales reales, no versionar)
├── .env.example
├── .gitignore
├── .npmrc                        (verify-deps-before-run=false)
├── main.js                       (entrada oficial)
├── main_simple.js                (servidor de prueba alternativo)
├── test_*.js                     (tests de prueba)
├── package.json                  (nombre: webii)
├── package-lock.json + pnpm-lock.yaml + pnpm-workspace.yaml
├── config\
│   ├── config.js                 (singleton: mensajes + queries)
│   ├── db.js                     (pool PostgreSQL)
│   ├── permission.csv            (matriz de permisos)
│   ├── queries.yaml              (578 líneas, ~80 queries)
│   ├── validations.json
│   └── messages\{es,en}.json
├── controller\                   (NO montado en el servidor)
├── service\                      (NO montado en el servidor)
├── utils\validator.js            (validador DUPLICADO)
└── src\
    ├── _business\                (atx 58, ftx 3, helpers 11 — NO montado)
    ├── bo\                       (class/method/sub_system VACÍOS)
    │   ├── method_registry.js
    │   └── method_resolver.js
    ├── dbms\dbms.js              (788 líneas: capa de datos)
    ├── debugger\debugger.js
    ├── dispatcher\               (POST / — valida sesión/perfil/permiso)
    ├── formatter\formatter.js
    ├── mailer\mailer.js
    ├── security\security.js
    ├── server\server.js
    ├── session\                  (login/register/me/forgot/reset/logout)
    ├── tokenizer\tokenizer.js    (JWT)
    ├── utils\utils.js
    └── validator\validator.js    (validador con Zod)
```

### 1.2 Flujo de arranque (main.js → server.js)

1. `config.init()` → carga `messages/*.json`.
2. `security.syncPermissions()` → sincroniza `permission.csv` contra la BD.
3. `security.syncTransactions()` → carga tabla `transaction` en memoria.
4. `security.syncUserProfiles()` → carga perfiles de usuario en memoria.

Rutas montadas:
- `POST /` → Dispatcher (`{ transaction_id, data, profile }`).
- `/user` → session (register, login, me, forgot/reset, logout).

### 1.3 Modelo transaccional (subsystem / class / method / transaction)

- Tablas maestras: `subsystem`, `class`, `method` (nombre UNIQUE cada una).
- Enlaces: `subsystem_class`, `class_method`, `method_profile` (el permiso).
- `transaction`: fila con UNIQUE `(subsystem_id, class_id, method_id)` — cada combinación es UNA transacción ejecutable.
- `insertPermission` (queries.yaml) crea todo en un CTE: entidades + enlaces + permiso + transacción.
- Dispatcher resuelve `transaction_id` → `{sub_system, class, method}` → verifica perfil y permiso → ejecuta el método.

---

## 2. Frontend — Estructura actual

Stack: Vite 7 + React 19.2 + Tailwind CSS 4 + react-router-dom 7 + react-hook-form + zod + axios + framer-motion + lucide-react + componentes shadcn/ui.

### 2.1 Árbol (src)

```
src\
├── main.jsx                     (StrictMode → BrowserRouter → ThemeProvider → App)
├── index.css                    (Tailwind 4, tema claro/oscuro)
├── app\App.jsx                  (rutas + AuthProvider)
├── assets\img\                  (fullpetro-dark.png, fullpetro-white.png)
├── auth\
│   ├── componentsAuth\          (AuthLayout, LoginForm, ForgotLayout, ResetLayout[MUERTO], ResetPasswordLayout, AuthForm[MUERTO])
│   └── schemasAuth\             (LoginSchema, ForgotSchema, ResetPasswordSchema, AuthSchema[MUERTO])
├── components\
│   ├── index.js
│   ├── AlertMessage, NotificationToast, ProtectedRoute, Sidebar
│   ├── ThemeToggle\             (definido, NUNCA usado)
│   └── ui\                      (button, card, table, donut, field, input, label, separator, switch)
├── context\
│   ├── AuthContext\             (única capa HTTP: axios, baseURL /user, withCredentials)
│   └── ThemeContext
├── lib\utils.js                 (cn)
├── pages\
│   ├── login, forgot, reset, notFound, dashboard
│   ├── reports\reportes.jsx     (donuts + tabla, 100% mock)
│   ├── personas, perfiles, usuarios  (placeholders "en construcción")
└── Service\securityService.js   (no es HTTP: regex de validación)
```

### 2.2 Rutas

| Ruta | Página | Protegida |
|---|---|---|
| `/`, `/login` | Login | No |
| `/forgot-password` | Forgot | No |
| `/reset-password` | ResetPassword | No |
| `/dashboard` | Dashboard | Sí |
| `/fuel` | FuelLightFleet (Flota Liviana) | Sí |
| `/fuel/heavy` | FuelHeavyFleet (Flota Pesada) | Sí |
| `/fuel/vehicles` | Vehicles (Unidades) | Sí |
| `/security/persons` | Persons | Sí |
| `/security/users` | Users | Sí |
| `/security/profiles` | Profiles | Sí |
| `/reports` | Reports | Sí |
| `*` | NotFound | No |

### 2.3 Comunicación con el backend

- Base URL: `http://localhost:3000/user` (o `VITE_API_URL`).
- Solo se consumen endpoints de auth: `GET /me`, `POST /login`, `POST /logout`, `POST /forgot-password`, `POST /reset-password`.
- **El dispatcher de negocio NO se consume desde el frontend** → reportes usan mock y las páginas de seguridad están vacías.

---

## 3. Errores y hallazgos del Backend

### 3.1 Críticos (bloquean el crecimiento con BOs)

| # | Error | Ubicación |
|---|---|---|
| B1 | `method_resolver.js` usa `config.ERROR_CODES` que **no existe** en `config.js` (solo hay `STATUS_CODES`) → `TypeError` en rutas de error. | `backend/src/bo/method_resolver.js:9` |
| B2 | `src/bo/class`, `src/bo/method`, `src/bo/sub_system` están **vacíos** → `method_registry.initialize()` registra cero subsistemas → ningún método de negocio se puede ejecutar. | `backend/src/bo/*` |
| B3 | Existen **dos mecanismos de BO paralelos**: `src/bo` (registry/resolver, el que usa el Dispatcher) y `src/_business` (atx/ftx/helpers, sin montar). Generan dos caminos para hacer lo mismo. | `backend/src/_business`, `backend/src/bo` |
| B4 | `controller/` y `service/` de la raíz **no se montan** en `main.js` (código muerto). `service/security_service.js` no existe aunque `test_profiles_simple.js` lo importa. | `backend/controller/*`, `backend/service/*` |

### 3.2 Altos

| # | Error | Ubicación |
|---|---|---|
| B5 | El `validator` del `dbms.js` nunca se inyecta → **toda validación de estructura de params está silenciosamente desactivada**. | `backend/src/dbms/dbms.js:135-295`, `constructor(validatorInstance = null)` |
| B6 | `queries.yaml` es un archivo único de ~80 queries (578 líneas) → inmanejable con BOs grandes y con riesgo de colisión de nombres. | `backend/config/queries.yaml` |
| B7 | **Desfase schema/queries**: `queries.yaml` usa tablas de negocio (`item`, `location`, `movement`, `inventory`, `notification`, `audit`, `period`...) que `schema.sql` **no crea** (el schema solo tiene las 16 tablas de seguridad). | `backend/config/queries.yaml` vs `db/schema.sql` |
| B8 | `dbms.js` importa `parseMOP` desde `_business/atx/parse-mop.js` → acoplamiento de la capa de datos con lógica de negocio. | `backend/src/dbms/dbms.js:5` |
| B9 | CRUD genérico de `dbms.js` interpola `tableName` y columnas en SQL sin sanitización (hoy nombres vienen del código, pero es superficie de riesgo). | `backend/src/dbms/dbms.js:398-787` |

### 3.3 Medios

| # | Error | Ubicación |
|---|---|---|
| B10 | Dos validadores duplicados con APIs distintas: `src/validator/validator.js` (Zod) vs `utils/validator.js` (manual). | `backend/src/validator`, `backend/utils/validator.js` |
| B11 | `sessionRoutes.js` mezcla rutas, validación, lógica de negocio y respuesta HTTP en un solo archivo (sin separación de capas). | `backend/src/session/sessionRoutes.js` |
| B12 | `Security.execute()` atrapa errores y re-lanza (`throw error`) sin sanitizar → el detalle interno puede filtrarse al cliente vía dispatcher. | `backend/src/security/security.js:238-240` |
| B13 | Dependencia innecesaria `fs@0.0.1-security` (fs es módulo nativo). | `backend/package.json` |
| B14 | Coexisten `package-lock.json` (npm) y `pnpm-lock.yaml` (pnpm) → ambigüedad de gestor. | `backend/` |
| B15 | `main_simple.js` y `test_*.js` son código de prueba obsoleto en la raíz. | `backend/main_simple.js`, `backend/test_*.js` |
| B16 | `getProfileByName` devuelve alias `profile_de`; `registerUser` toma el email de `public.person.address` (inconsistencias de columnas). | `backend/config/queries.yaml` |
| B17 | **RESUELTO** — `structureToOrderedArray` usaba chequeo de truthiness (`if (current[key])`) → con valores `null`/`''`/`0` metía el objeto entero como parámetro SQL ("valor demasiado largo"). Corregido a chequeo de presencia. | `backend/src/formatter/formatter.js:117` |

---

## 4. Errores y hallazgos del Frontend

### 4.1 Críticos

| # | Error | Ubicación |
|---|---|---|
| F1 | **Contrato roto en `/me`**: el frontend espera `res.data.loggedIn`, el backend responde solo `{ user }` → `checkAuth()` nunca restaura la sesión tras recargar. | `frontend/src/context/AuthContext/AuthContext.jsx:20` vs `backend/src/session/sessionRoutes.js:108-115` |
| F2 | **No existe capa de servicios** (`services/api.js`): todo axios vive en `AuthContext`. Las páginas de negocio no tienen servicio que llamar → reportes usan mock y personas/perfiles/usuarios están vacías. | `frontend/src/context/AuthContext/AuthContext.jsx:4-7` |
| F3 | `AuthContext.jsx` espera `loggedIn` y el backend no lo devuelve → el usuario queda en "Sesión Requerida" al recargar el dashboard. | `frontend/src/context/AuthContext/AuthContext.jsx:17-28` |

### 4.2 Altos

| # | Error | Ubicación |
|---|---|---|
| F4 | Duplicación severa de layout: header/logo/Sidebar copiados en ~10 páginas; `login/forgot/reset/notFound` comparten ~70 líneas idénticas; `personas/perfiles/usuarios` son copy-paste entre sí. | `frontend/src/pages/*` |
| F5 | Ítem "Configuración" del Sidebar navega a `/settings`, ruta que **no existe** → cae en el 404. | `frontend/src/components/Sidebar/Sidebar.jsx` |
| F6 | `ResetLayout.jsx` simula éxito con `setTimeout(1500)` sin llamar al backend y **importa `resetPasswordSchema` de una ruta equivocada** (`ForgotSchema/ForgotSchema`) → habría fallado si se usara. | `frontend/src/auth/componentsAuth/ResetLayout/ResetLayout.jsx:10,22-28` |
| F7 | El login navega a `/dashboard` con `setTimeout(1500)` acoplado al timing del toast. | `frontend/src/auth/componentsAuth/AuthLayout/AuthLayout.jsx:40` |
| F8 | `ProtectedRoute` no redirige automáticamente; si `!user && !showWarning` muestra spinner infinito. | `frontend/src/components/ProtectedRoute/ProtectedRoute.jsx:59-65` |

### 4.3 Medios

| # | Error | Ubicación |
|---|---|---|
| F9 | Código muerto: `ThemeToggle` (nunca usado), `ResetLayout`, `AuthForm`, `AuthSchema` (archivo sin extensión), `Switch` (sin consumo), `CardHeader`/`CardTitle` (sin uso), `App.css` (vacío). | `frontend/src/*` |
| F10 | Textos con encoding corrupto (`"La pÃ¡gina..."`, `"Panel de la URU â€¢"`). | `frontend/src/pages/notFound/notFound.jsx:90`, `dashboard.jsx:67`, `personas.jsx:86,90` |
| F11 | Importaciones inconsistentes: mezcla de alias `@/` y rutas relativas `../../` para lo mismo. | `frontend/src/pages/*` |
| F12 | Exports mixtos en `pages/index.js` (named para auth/dashboard, default→named para el resto). | `frontend/src/pages/index.js` |
| F13 | `securityService.js` valida en cliente con regex que puede rechazar passwords legítimos (p. ej. "select" o "update") y tiene `console.log` en producción. | `frontend/src/Service/securityService.js` |
| F14 | `index.html` y `package.json` con nombres genéricos ("front", título "front", favicon de Vite). | `frontend/index.html`, `frontend/package.json` |
| F15 | `index.css:121-128` duplica directivas `@apply`. | `frontend/src/index.css` |
| F16 | Componente `donut.jsx` no sigue el patrón shadcn del resto (`forwardRef` + `cn`); `card.jsx` usa colores hardcodeados en vez de tokens de tema. | `frontend/src/components/ui/donut.jsx`, `card.jsx` |

---

## 5. Seguridad — Errores y hallazgos

### 5.1 Lo que está bien

- Passwords con **bcrypt** (cost 10) en register/login/reset.
- Sesión con cookie **`httpOnly`** (no accesible desde JS).
- CORS restringido a `http://localhost:5173` con `credentials: true`.
- `forgot-password` no revela existencia de usuario (respuesta idéntica).
- Requisitos de contraseña: min 8, mayúscula, minúscula, número.
- Bloqueo de XSS/SQLi por regex en el validador.
- `insertPermission` usa parámetros `$1..$4` (PostgreSQL parametrizado, sin SQLi).
- Control de acceso fino: perfil + permiso por transacción antes de ejecutar (Dispatcher).

### 5.2 Problemas

| # | Problema | Ubicación |
|---|---|---|
| S1 | **`JWT_SECRET` con fallback inseguro** `'default_secret'` → si falta en `.env`, cualquiera puede forjar tokens de reset. | `backend/src/tokenizer/tokenizer.js:10` |
| S2 | **Sesión sin store persistente** (MemoryStore de Express) → pierde sesiones al reiniciar y no escala. | `backend/src/server/server.js:41` |
| S3 | Cookie de sesión `secure: false` → viaja por HTTP plano (OK en dev, obligatorio `true` en prod con HTTPS). | `backend/src/server/server.js:46` |
| S4 | `saveUninitialized: true` → crea sesión vacía para cada request sin login (ruido/vectores). | `backend/src/server/server.js:44` |
| S5 | `maxAge: 5 min` → sesión muy corta; usuario se desloguea solo por inactividad. | `backend/src/server/server.js:48` |
| S6 | **Sin rate limiting** en login ni forgot-password → fuerza bruta y email bombing sin límite. | `backend/src/session/sessionRoutes.js` |
| S7 | Regex anti-SQLi rechaza `;`, `'`, `"` en cualquier campo → falsos positivos (p. ej. `O'Reilly`). La defensa real es parametrización (ya se usa). | `backend/utils/validator.js:231-234` |
| S8 | `validateSecurity` bloquea palabras como `select`, `update`, `insert` en texto legítimo. | `backend/utils/validator.js:232` |
| S9 | `Security.execute()` re-lanza errores sin sanitizar → detalles internos pueden filtrarse. | `backend/src/security/security.js:238-240` |
| S10 | Cookie de sesión sin `sameSite` explícito → default ambiguo entre navegadores. | `backend/src/server/server.js:45-49` |
| S11 | Validación de estructura en `dbms.js` desactivada (validator nunca inyectado) → sin capa de contención si un BO construye SQL dinámico. | `backend/src/dbms/dbms.js` |
| S12 | CRUD genérico interpola `tableName`/columnas → vigilar cuando lleguen BOs grandes. | `backend/src/dbms/dbms.js:398-787` |
| S13 | `securityService.js` del frontend valida con regex (seguridad client-side no fiable) y puede rechazar passwords legítimos. | `frontend/src/Service/securityService.js` |

---

## 6. Sugerencias de modificación — Backend (prioridad)

### P1. Arreglar el resolver (bloqueante)
- Agregar a `config/config.js` un mapa de códigos de error (`NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR`, `INTERNAL`) mapeado a los `STATUS_CODES` existentes.
- En `method_resolver.js:9`, usar ese mapa y usar `handleError` de `src/utils/utils.js` (ya existe, lanza JSON estructurado) en lugar de `throw new Error(...)`.

### P2. Decidir UN mecanismo de BO (bloqueante)
- **Quedarse con `src/bo`** (registry/resolver): es el flujo completo que ya arma el Dispatcher.
- Vaciar el concepto `class/` y `method/` como carpetas: el registry descubre clases y métodos desde cada subsistema. Usar solo `sub_system/` como punto de entrada.
- **Regla**: cada archivo en `sub_system/` = un subsistema, exporta una clase con el mismo nombre del archivo.
- Archivar (mover a `_legacy/`, NO borrar): `src/_business`, `controller/`, `service/`, `main_simple.js`, `test_*.js`. Verificar antes que ningún módulo vivo los importe.

### P3. Escalar queries.yaml
- Dividir por subsistema: `config/queries/security.yaml`, `person.yaml`, `ubicacion.yaml`, etc.
- `Config.getQueries()` carga un índice (lista de archivos) y mergea, manteniendo `executeNamedQuery({nameQuery})` intacto.
- Convención de nombres: prefijo de subsistema (`person_insert`, `person_get_by_id`).

### P4. Activar validación en dbms.js
- Crear el validador en el arranque (`config.init()` o constructor de `Server`) e inyectarlo siempre: `new DBMS(new Validator())`.
- Alternativa mínima: loggear un warning cuando una query tenga `structure_params` y no haya validador (evitar falla silenciosa).

### P5. Migrar permisos a BD (progresivo)
- `permission.csv` queda como semilla/fixture; la fuente de verdad pasa a `method_profile`/`transaction` en BD.
- Ya está casi hecho (`syncPermissions` compara CSV vs BD e inserta lo faltante). Solo invertir el origen.

### P6. Sanitizar errores del Dispatcher
- `Security.execute()` → `handleError` con mensaje genérico al cliente y detalle al log.

### P7. Limpieza
- Eliminar `fs@0.0.1-security` de package.json.
- Elegir un solo gestor de paquetes (pnpm) y eliminar `package-lock.json`.
- Resolver duplicación de validadores (`src/validator` vs `utils/validator`) eligiendo uno.

---

## 7. Sugerencias de modificación — Frontend (prioridad)

### P8. Arreglar el contrato `/me` (bloqueante)
- Opción simple: ajustar `checkAuth()` para usar `res.data.user` (el backend ya responde `{ user }`).
- Alternativa: que el backend devuelva `{ loggedIn, user }`.

### P9. Crear capa de servicios
- `frontend/src/services/api.js`: instancia axios única (baseURL `/user` + cliente para `/dispatcher`), con interceptores para centralizar errores.
- Mover la lógica HTTP de `AuthContext` al servicio; el contexto queda solo como estado.

### P10. Reducir duplicación
- Crear `PageLayout` (fondo + grid + logo + Sidebar + header) y `PageHeader` (título + tema + logout).
- Crear componente `Logo` reutilizable (importar desde `@/assets/img`).
- Aplicar a las 5 páginas protegidas.
- Eliminar o usar `ThemeToggle`, `ResetLayout`, `AuthForm`, `AuthSchema`.

### P11. Arreglar rutas y navegación
- Definir la ruta `/settings` o quitar el ítem "Configuración" del Sidebar.
- Quitar el `setTimeout(1500)` del login; navegar en el `await` de `login()`.
- Hacer que `ProtectedRoute` redirija con `<Navigate to="/login">` en vez de spinner infinito.

### P12. Reportes con datos reales
- Cuando exista el primer BO, reemplazar el mock data por un fetch al dispatcher (`POST /` con `transaction_id`).

---

## 8. Seguridad — Sugerencias (prioridad)

| # | Sugerencia |
|---|---|
| P13 | Quitar el fallback `default_secret` del Tokenizer → lanzar error si falta `JWT_SECRET` en entorno. |
| P14 | Store de sesión persistente con `connect-pg-simple` (usando el pool existente). |
| P15 | `secure: true` en cookie en producción (HTTPS); `sameSite: 'lax'` explícito. |
| P16 | `saveUninitialized: false` y aumentar `maxAge` según política de sesión. |
| P17 | Rate limiting con `express-rate-limit` en `/user/login` y `/user/forgot-password`. |
| P18 | Dividir validación: regex anti-XSS donde aplique; **quitar falsos positivos de SQLi** del validador de texto y confiar en parametrización. |
| P19 | Sanitizar errores de `Security.execute()` (mensaje genérico al cliente, detalle al log). |
| P20 | Activar el validador en `dbms.js` (ver P4) y vigilar el CRUD genérico al agregar BOs. |
| P21 | Crear middleware de autenticación agnóstico (`src/auth/authMiddleware.js`): acepta JWT Bearer o cookie de sesión → `req.user`; migrar `sessionWrapper.js` y las validaciones a `req.user`. (Sección 10.4) |
| P22 | Login devuelve `{ user, token }` para apps nativas (JWT con `{ userId }`, expiración configurable ~1h), manteniendo cookie para web. |
| P23 | Ampliar el `origin` de CORS cuando exista el frontend móvil (lista de orígenes permitidos; nativos no envían Origin). |
| P24 | Escalabilidad: PM2 cluster mode + `connect-pg-simple` (P14) + NGINX reverse proxy; medir carga antes de más instancias; k8s solo si hay múltiples servicios/equipos. (Sección 9) |
| P25 | Configurar el pool de Postgres (`config/db.js`): `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`, `maxUses`; dimensionar por proceso al activar PM2 cluster. (Sección 9.7) |

---

## 9. Escalabilidad — Análisis

### 9.1 Límites actuales

- **Un solo proceso Node** → usa 1 solo core de CPU y la memoria de un proceso. Ese es el límite real de peticiones.
- **Sesiones en MemoryStore de Express** → bloqueante arquitectónico para escalar: con 2+ procesos, las sesiones no se comparten (login en uno, request en otro = sin sesión). Ya anotado en P14.
- **Sin rate limiting** → no es límite de escala sino de abuso (fuerza bruta / email bombing). Ya anotado en P17.
- **Postgres en 1 instancia** → suficiente por años para BOs internos.
- **Frontend estático** (Vite build) → se sirve desde cualquier CDN/NGINX; escala solo con cero código.

### 9.2 Veredicto

- **No** montar sistema distribuido / balanceador / k8s a esta escala. Un solo nodo bien configurado alcanza típicamente del orden de **cientos a ~1-2 mil peticiones/seg** con queries a Postgres. Para uso interno de oficina/campo, estamos a 3-4 órdenes de magnitud de necesitar cluster.
- Regla práctica: no montar un sistema distribuido hasta que un solo nodo bien configurado no alcance. Sin datos de carga (usuarios concurrentes, peticiones/hora), cualquier cluster es adivinar.

### 9.3 Plan por etapas

| Etapa | Acción | Requiere |
|---|---|---|
| 1. Hoy (semanas) | PM2 **cluster mode** (N procesos = N cores, una línea de config) + **NGINX** reverse proxy (sirve frontend + balancea a Node) + worker de correo si el mail es lento | Store de sesión en Postgres (P14) |
| 2. Cuando un nodo no alcance | Más instancias Node detrás de NGINX (stickiness o sesiones en BD) + Postgres con más recursos o réplicas de lectura (solo si hay reportes pesados) | Medir primero |
| 3. Solo si hay múltiples servicios/equipos | Kubernetes (mantenimiento puro sin beneficio a esta carga) | — |

### 9.4 Recomendación concreta

1. **PM2 cluster** + `connect-pg-simple` (sesiones en PG) + **NGINX** = "el sistema distribuido" que esta app necesita, sin cambiar código.
2. **Medir primero**: usuarios concurrentes y peticiones/hora antes de decidir infra.
3. Kubernetes **ahora es overkill** (YAMLs, ingress, RBAC, operadores sin ganancia).

### 9.5 Entorno de despliegue (definido por el usuario)

**Hardware — servidor físico único:**

| Especificación | Valor |
|---|---|
| Modelo | Dell PowerEdge R730xd (24 bahías SFF, 2U) |
| CPU | 2× Intel Xeon E5-2690 v4 @ 2.6 GHz (**28 núcleos / 56 hilos** en total) |
| RAM | 128 GB DDR4 |
| Almacenamiento | 4× 1.2 TB 10K SAS 2.5" 12 Gb/s HDD |
| RAID | H730P 2 GB |
| Red | NIC 10 Gb + I350 1 Gb |

**Implicaciones para el plan:**

- **Un solo nodo físico, muy potente** → confirma el plan de la Etapa 1: PM2 cluster (usar ~8-12 procesos Node, no los 28; Postgres también consume) + NGINX + Postgres en el mismo servidor. No hace falta distribuido.
- **Núcleos de sobra**: headroom para crecer sin cambiar de servidor; el cuello de botella será disco (HDD SAS 10K) y luego RAM/CPU.
- **Discos HDD 10K SAS (no SSD)**: punto de atención para Postgres y para reportes pesados sobre telemetría. Recomendaciones:
  - Mantener el RAID H730P con su caché (2 GB, idealmente modo write-back con batería) → amortigua los discos.
  - Particionar el volumen: sistema + Postgres data en el RAID primario; backups/logs separados.
  - En telemetría de alto volumen, evaluar a futuro: pre-agregados de reportes para no leer millones de filas por consulta.
  - 128 GB RAM → se puede dedicar mucho a `shared_buffers`/caché de Postgres y a caché en memoria de reportes.
- **PM2 cluster en este servidor**: suficiente por años para un sistema interno, incluso con la app móvil agregada.

### 9.6 Seguridad de infraestructura — Firewall

**UFW** (Ubuntu/Debian) o **firewalld** (CentOS/RHEL) es de lo primero a configurar. Regla de oro: solo abrir lo que el mundo necesita ver; el resto interno.

| Puerto | ¿Abrir? | Para qué |
|---|---|---|
| 80 / 443 (HTTP/HTTPS) | Sí, público | NGINX → frontend + API |
| 22 (SSH) | Sí, restringido | Solo IPs de administración/red interna; ideal solo llaves (sin password) |
| 5432 (Postgres) | **NO** | Solo acceso local (Node por localhost) |
| 3000/3001 (Node) | **NO** | NGINX los proxya; nadie entra directo |
| 5900/8443/443 iDRAC | **NO** a internet | Administración R730xd se queda en red interna de gestión |

- **Flujo de tráfico**: clientes → solo NGINX (80/443) → Node (localhost) → Postgres (localhost). Todo lo demás cerrado.
- **HTTPS**: NGINX termina SSL (dominio/certificado); el backend no necesita saber de TLS.
- **UFW vs rate limiting (P17)**: capas distintas que se complementan — el firewall bloquea por IP/red; el rate limiting por peticiones de login.
- **iDRAC** es el riesgo silencioso (credenciales default + acceso total al hardware): aislarlo en VLAN de gestión + cambiar contraseña es casi tan importante como el firewall.

### 9.7 Pool de conexiones a Postgres

**Estado actual** (`backend/config/db.js`): `new Pool(dbConfig)` con valores por defecto de `pg` (sin `max`, sin `idleTimeoutMillis`, sin `connectionTimeoutMillis`). Un solo `Pool` compartido por toda la app (diseño correcto). Con 1 proceso Node en dev, `max` default (10) alcanza.

**Configuración recomendada de partida** para el R730xd (28 núcleos / 128 GB RAM):

```js
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  max: 25,                          // conexiones del pool (base; ver regla por proceso)
  idleTimeoutMillis: 30_000,        // cierra conexiones ociosas > 30s
  connectionTimeoutMillis: 5_000,   // timeout si Postgres no responde
  maxUses: 7500,                    // recicla conexiones (evita leaks en pg)
};
```

**Reglas de dimensionamiento:**

1. **`max` ≈ 5-8 conexiones por proceso Node** (no "cuanto más, mejor": cada conexión consume ~10 MB de RAM en Postgres y contexto de proceso).
2. **PM2 cluster**: N procesos × pool.max = conexiones totales. Con ~8-12 procesos × 8 = **64-96 conexiones** → `max_connections` de Postgres (default 100) debe superar eso con margen.
3. **Regla general**: `max_connections ≥ (procesos Node × pool.max) + margen` (margen para pg_dump, monitoreo, otros sistemas).
4. **Postgres en el mismo servidor** → conexiones por localhost/Unix socket; el cuello real es el HDD SAS 10K, no la red.
5. **Ajustes de Postgres acordes a 128 GB RAM**: `shared_buffers` (p. ej. 25-30% de la RAM), `work_mem` razonable, subir `max_connections` si habrá varios sistemas en el mismo server.
6. **`maxUses`**: buena práctica; `pg` puede acumular conexiones viejas con el tiempo.

**Matiz clave**: el pool no es el cuello de botella hoy (1 proceso); importa **cuando se active PM2 cluster** — pasa a ser un parámetro por proceso, no por app.

---

## 10. Compatibilidad móvil — Análisis

### 10.1 Decisión tomada: app nativa única

El frontend móvil será una **app nativa** (React Native / Flutter / Kotlin / Swift). **No será una app por sección**, sino una sola app que contendrá todas las secciones del sistema. Por ahora, solo la sección de **Combustible** estará disponible; las demás se agregarán progresivamente.

Esto condiciona la capa de autenticación: **las apps nativas no gestionan cookies como un navegador**.

### 10.2 Lo que ya es compatible con móvil ✅

- API JSON pura (Express 5).
- **Patrón Dispatcher** (`POST /` con `{ transaction_id, data, profile }`): excelente para móvil. Un solo endpoint, el cliente solo manda el código de transacción; no se versionan docenas de rutas por pantalla.
- Modelo de permisos por transacción: el móvil manda `profile` y el backend valida; no se filtra lógica de permisos al cliente.
- Los nativos no aplican CORS (solo los navegadores); el `origin` restringido no bloquea apps nativas.
- `withCredentials` + cookies funcionan en PWA/móvil web sin cambios.
- **JWT Bearer** (ya implementado en 11.5): la app nativa se autentica vía token, no cookie.

### 10.3 El punto crítico: modelo de sesión ✅ (resuelto)

Auth actual es **dual** — cookie de sesión + JWT Bearer (`src/auth/authMiddleware.js`):

| Escenario | ¿Sirve? |
|---|---|
| Desktop web (navegador) | ✅ Cookie de sesión |
| App nativa (React Native / Flutter) | ✅ JWT Bearer |
| PWA / móvil web (futuro) | ✅ Cookie de sesión |

**Decisión para la app nativa de combustible:** Se usa **JWT Bearer**. El login devuelve `{ user, token }`; la app guarda el token y lo envía en `Authorization: Bearer <token>` en cada request.

### 10.4 Diseño recomendado: middleware de auth agnóstico

```
Request → ¿Authorization: Bearer <JWT>? → verifica y setea req.user
       → si no → ¿req.session.data.user? → setea req.user
       → si no → 401
```

- Todo el código pasa a leer **`req.user`** en vez de `req.session.data.user`.
- La app (dispatcher, session, BOs) no sabe ni le importa cómo se autenticó el cliente: cookie en web, token en nativa.
- **Login devuelve ambos**: en web/PWA cookie (como hoy); en nativa el `POST /user/login` responde `{ user, token }` (JWT firmado con `JWT_SECRET`). Mismo endpoint, la app decide.
- **JWT con data mínima** (`{ userId }`), expiración configurable (p. ej. 1h); refresh tokens complejos NO al inicio (expiración corta + relogin es suficiente para un sistema interno).
- **`SECRET` y `JWT_SECRET` sin fallback** (P13) — se vuelve obligatorio al emitir tokens.

### 10.5 Estado actual: auth agnóstico ya implementado ✅

El middleware de auth agnóstico ya está implementado (ver 11.5). El backend soporta tanto cookie (web) como JWT Bearer (nativa) sin cambios. La app nativa solo necesita:

1. Llamar a `POST /user/login` con `{ username, password }`
2. Guardar el `token` de la respuesta
3. Enviar `Authorization: Bearer <token>` en cada request
4. Implementar `GET /user/me` para obtener el perfil completo

No se requieren cambios en el backend para soportar la app nativa.

---

## 11. Hoja de ruta (pendiente por definir)

| Ítem | Estado | Descripción |
|---|---|---|
| MVP — 3 secciones | **Definido** | Primer lanzamiento: **Administración**, **Combustible** e **Inventario** (ver 11.1 mapeo a subsistemas). |
| Modelado de datos | **En progreso por el usuario** | Lo irá armando y seccionando por lanzamiento/versión. Hoy `queries.yaml` referencia tablas que `schema.sql` no crea (B7). |
| Permisos / perfiles | **Pendiente** (el usuario los indicará pronto) | Matriz real de `permission.csv` / `method_profile`. |
| Primer BO piloto | **COMPLETADO (19/08/2026)** | `Security/Person/createPerson` funcionando end-to-end. Ver 11.4 patrón de BO y hallazgos. |
| Framework móvil (React Native vs Flutter) | **Pendiente** | Define el contrato de API/token (P21-P22 ya listos). |
| Auth middleware agnóstico | **COMPLETADO (19/08/2026)** | Ver 11.5: JWT + cookie, login con token, `/me` dual, 401 estructurado. |
| Frontend services layer | **COMPLETADO (19/08/2026)** | Ver 11.6: api.js, authService.js, personService.js, AuthContext refactorizado. |
| Sección Combustible (backend + frontend) | **COMPLETADO (26/08/2026)** | Ver 11.7: tablas, BOs, queries, servicios, página con formulario, tabla, barra de tanque. |
| Muestra de datos MOP/telemetría | **Pendiente** | Para conectar el parser (`parse-mop.js`) a un BO de ingesta. |

### 11.1 MVP — Mapeo de secciones a subsistemas

| Sección | `sub_system` | Contenido típico |
|---|---|---|
| Administración | `admin` | Personas, usuarios, perfiles (hoy `seguridad`), vehículos, ubicaciones |
| Combustible | `fuel` | Cargas de combustible, consumos por vehículo, tanques/despachos, rendimientos |
| Inventario | `inventory` | Ítems, entradas/salidas, movimientos, stock mínimo |

**Observaciones de diseño:**

- El `queries.yaml` heredado ya referencia tablas `item`, `inventory`, `movement`, `location` → el modelo anterior apuntaba a estos dominios (útil como referencia; las tablas aún no existen en `schema.sql`, ver B7).
- **Combustible es un inventario en sí mismo**: decide pronto si el combustible vive como ítem dentro de `inventory` con movimientos propios, o como subsistema separado que consulta inventario. Recomendación: separados pero relacionados — `fuel` registra la operación operativa (vehículo, chofer, litros, horas-máquina); `inventory` lleva el stock del tanque.
- **Cruces entre subsistemas**: reportes tipo "consumo vs rendimiento por vehículo" cruzan `fuel` + `admin`. Definir si un método puede llamar a otro subsistema o cada uno se limita a sus tablas.

### 11.2 Visión de escalamiento (post-MVP)

Mapa completo de módulos previstos:

| Módulo | `sub_system` | Contenido |
|---|---|---|
| Seguridad | `security` (ya existe) | Personas, usuarios, perfiles |
| Administrativo | `admin` | Cuentas, horas de trabajo, materiales, costos, rentabilidad, (facturación) |
| Operaciones | `operations` | Trabajos, proyectos, horas por proyecto/maquinaria, gasoil/gasolina, mantenimientos, consumibles, asignación de vehículos, rendimiento |
| Combustible | `fuel` | Surtido de combustible con evidencia fotográfica desde app móvil (litros, hora, unidad) |
| Inventario | `inventory` | Stock, entradas/salidas, consumibles |
| Tickets | `tickets` | Internos/externos |

**Decisiones tempranas recomendadas (evitan refactors):**

1. **Horas de trabajo aparece en Admin y Operaciones** → definir un solo dueño del dato: se captura en `operations` (por proyecto/maquinaria) y `admin` consulta/agrega para costos. No duplicar captura.
2. **Costos y rentabilidad no son transaccionales**: son cálculos sobre consumo + horas + materiales → reportes/pre-agregados, no tablas manuales.
3. **Facturación ("quizás")**: territorio ERP (fiscal/legal). Si llega a ser real, evaluar integración vía API con el sistema contable existente antes de programarla.
4. **App de surtido con foto**: mejor caso de uso de Dispatcher + JWT (móvil envía `{ transaction_id: FUEL.DISPENSE }` + imagen + hora + unidad). Decisiones de infra pendientes: almacenamiento de imágenes (filesystem vs object storage), compresión y retención (los HDD crecen poco).
5. **Mantenimientos cruza todo**: vehículo (`admin`) + repuestos/consumibles (`inventory`) + órdenes (`operations`). El módulo más relacional; modelar con calma.
6. **Tickets externos** implican clientes como actores → el modelo de personas/perfiles debe soportar acceso externo limitado.

### 11.3 Requisitos no funcionales — Interoperabilidad y Distribución (concurrencia)

Indicación recibida: el sistema debe ser interoperable y distribuido, motivada principalmente por **concurrencia y funcionamiento**. Interpretación correcta: escalabilidad horizontal (niveles 1-2), NO microservicios.

**Niveles de distribución:**

| Nivel | Qué significa | Estado |
|---|---|---|
| 1. Cliente-servidor distribuido (n-tier) | Frontend, backend y BD como procesos separados por red | **Cumplido** |
| 2. Escalabilidad horizontal | Varios procesos/nodos detrás de balanceador, sesiones compartidas | Diseñado (P14/P24/P25) |
| 3. Microservicios / multi-nodo físico | Servicios desplegados por separado | No requerido a esta escala |

**Interoperabilidad — estado:** cimientos listos (REST+JSON, PostgreSQL, JWT+cookie agnóstico funcional, catálogo de transacciones estables). Pendientes: catálogo exportable de transacciones, perfiles de servicio (API key = usuario sistema).

### 11.4 Patrón de BO (establecido con el piloto `Security/Person/createPerson`)

**Estado del sprint de fundaciones:**

- ✅ Paso 1 — `_legacy/`: archivado `_business/`, `controller/`, `service/`, `main_simple.js`, `test_*.js`; desacoplado `parseMOP` de `dbms.js`. UN solo mecanismo de BO.
- ✅ Paso 2 — Resolver arreglado: mapa semántico `ERROR_CODES` en `config.js`; dispatcher devuelve errores estructurados con su statusCode real (404/409/400) en vez de 500 genérico.
- ✅ Paso 3 — Primer BO end-to-end verificado: sin sesión → mensaje; método inexistente → 404; campos faltantes → 400; duplicado → 409; creación OK → 200.

**Estructura obligatoria de un subsistema** (descubierta por `method_registry.js` / `method_resolver.js`):

```
backend/src/bo/sub_system/
├── Security.js                    ← export class Security (NAMED + default)
│   constructor() { this.Person = Person; }   ← la CLASE, no new Person()
└── classes/
    └── person.js                  ← métodos como arrow-function class fields
                                    ← (deben ser own enumerable properties)
```

- El registry recorre `Object.entries(instanciaSubsystem)` y solo procesa propiedades `typeof === 'function'` → asignar clases.
- Los métodos se descubren con `Object.keys(claseInstanciada)` → **deben ser class fields**, no métodos de prototipo.
- Imports desde `classes/`: `../../../dbms/...`, `../../../utils/...`, `../../../../config/...` (config vive en la raíz del backend, NO en src).
- Inicialización DBMS en el constructor: `this.dbms = new DBMS(); this.dbmsReady = this.dbms.init();`

**Convención de errores de negocio:**

```js
throw new Error(JSON.stringify({ message, statusCode: STATUS_CODES.CONFLICT }));
```
El dispatcher parsea el payload y devuelve el statusCode real al cliente. Para errores de BD anidados por el DBMS (doble wrap), usar extracción recursiva de `.message`/`.error` (ver `extractDbError` en person.js).

**Tipos nullable en queries.yaml** (agregado al validador):

```yaml
structure_params: { ci: 'string', phone: 'string|null' }
```

**Hallazgos corregidos durante el piloto:** B17 (truthiness en formatter), import roto `parseMOP`→eliminado, soporte `|null` en validador.

### 11.5 Auth middleware agnóstico (completado 19/08/2026)

Implementado `src/auth/authMiddleware.js` — middleware global instalado antes de todas las rutas en `server.js`:

- **Bearer token**: `Authorization: Bearer <JWT>` → apps nativas, integraciones. JWT payload: `{ userId, username }`, expiración configurable via `AUTH_TOKEN_EXPIRES` (default 1h).
- **Cookie de sesión**: flujo web existente sin cambios.
- Ambos caminos setean `req.user` con `{ id, username, via: 'token'|'session' }`.

**Archivos modificados/creados:**

| Archivo | Cambio |
|---|---|
| `src/auth/authMiddleware.js` | Nuevo — parser Bearer o cookie → `req.user` |
| `src/tokenizer/tokenizer.js` | Sin fallback (`JWT_SECRET` obligatorio, P13); `generateToken(data, expiresIn)` configurable |
| `backend/.env` | `JWT_SECRET` generado (48 bytes base64, faltaba — S1 activo) |
| `src/session/sessionRoutes.js` | Login devuelve `{ user, token }`; `/me` soporta ambos caminos (Bearer carga perfil completo desde BD) |
| `src/dispatcher/dispatcher.js` | Usa `request.user` (no `sessionWrapper`); sin auth → 401 (antes 200) |
| `config/queries.yaml` | `getUserById` completado con lastname/ci (mismas columnas que `getUser`, sin password) |

**Verificación (todos los caminos):**

| Caso | Resultado |
|---|---|
| `/me` con Bearer | 200 + perfil completo (cargado desde BD) ✓ |
| `/me` con cookie | 200 + perfil completo (desde sesión) ✓ |
| Dispatcher + Bearer | 200 — creación/consulta sin cookie ✓ |
| Dispatcher + cookie | 200/409 — comportamiento idéntico ✓ |
| Sin credenciales | 401 `"session_required"` ✓ |
| Token inválido/expirado | 401 `"session_required"` ✓ |

### 11.6 Frontend services layer (completado 19/08/2026)

Capa de comunicación frontend→backend centralizada y consistente.

**Archivos creados en `frontend/src/services/`:**

| Archivo | Responsabilidad |
|---|---|
| `api.js` | Instancia axios global. Interceptor Bearer (lee `localStorage.token`), interceptor 401 (limpia token, redirige a `/login`). Helper `executeTransaction(txId, data, profile)`. |
| `authService.js` | `login`, `logout`, `getMe`, `forgotPassword`, `resetPassword`. Maneja token y usuario en localStorage. |
| `personService.js` | Patrón BO: cada método = una transacción (`executeTransaction(N, data)`). Ejemplo para Person; replicar por cada nuevo BO. |
| `index.js` | Barrel export. |

**AuthContext refactorizado** (`context/AuthContext/AuthContext.jsx`):
- Ya no importa axios directamente — usa `authService`.
- Token y usuario persistidos en localStorage (sobreviven refresh).
- `checkAuth()` carga el usuario actual al montar la app.

**Patrón para nuevos BOs:**
1. Crear `src/services/[bo]Service.js` (copiar `personService.js`).
2. Mapear cada método al `transaction_id` correspondiente de `permission.csv`.
3. Exportar desde `index.js`.

**Build verificado:** `vite build` exitoso (14s, sin errores de compilación).

### 11.7 Sección Combustible (completado 26/08/2026)

Primera sección funcional del MVP. Backend + frontend completos.

**Backend:**
- Migración `db/migrations/002_fuel.sql`: tablas `vehicle`, `fuel_carga`, `fuel_foto`
- Subsistema `Fuel` en `src/bo/sub_system/Fuel.js` con clases `Vehiculo` y `Carga`
- 9 transacciones (tx 81-89) en `permission.csv`
- 9 queries en `queries.yaml`
- Verificado end-to-end: crear vehículo, crear carga, listar, duplicado (409), campos faltantes (400)

**Frontend:**
- `fuelService.js`: servicio con todas las transacciones mapeadas
- `TankBar`: componente de visualización de nivel de tanque (verde/amarillo/rojo)
- Página `/fuel` (`FuelLightFleet`): formulario de carga, tabla de historial, filtros, totales, barras de tanque, detalle modal
- Sidebar actualizado con sección Combustible
- Build verificado sin errores

**Transaction IDs:**
| ID | Método |
|---|---|
| 81 | `Fuel/Vehiculo/createVehiculo` |
| 82 | `Fuel/Vehiculo/getVehiculoById` |
| 83 | `Fuel/Vehiculo/getAllVehiculos` |
| 84 | `Fuel/Vehiculo/updateVehiculo` |
| 85 | `Fuel/Carga/createCarga` |
| 86 | `Fuel/Carga/getCargasByVehiculo` |
| 87 | `Fuel/Carga/getAllCargas` |
| 88 | `Fuel/Carga/updateCarga` |
| 89 | `Fuel/Carga/deleteCarga` |

---

**Concurrencia — cómo se resuelve:**

- Node/Express es I/O-concurrente (event loop): miles de conexiones por proceso; la carga típica (CRUD/reportes) es el caso ideal.
- Límites actuales: 1 proceso (1 núcleo), sesiones en memoria, pool default (10).
- Solución (ya planificada): PM2 cluster (8-12 procesos) + sesiones en Postgres (P14) + pool dimensionado (P25) + NGINX + rate limiting (P17).
- Capacidad estimada con el R730xd: miles de usuarios concurrentes → sobra para uso interno por años.

**Disponibilidad ("funcionamiento"):**

- Único punto de fallo real: el servidor físico. Antes de considerar un segundo nodo: backups automáticos probados, RAID operativo (tolerancia a falla de disco), monitoreo (PM2/logs/alertas) y auto-arranque de servicios.
- HA con segundo servidor es decisión de negocio/costo, no exigida por la concurrencia.

---

## 12. Conclusión

- **Base sólida** en ambos lados: ESM + Express 5 + PostgreSQL; Vite + React 19 + Tailwind 4, contextos y componentes `ui/` consistentes.
- **El esqueleto conceptual soporta BOs grandes** (el modelo transaccional `subsystem/class/method` + dispatcher + permisos es escalable), pero el **estado actual no** por los bloqueantes B1-B4 (resolver roto, `src/bo` vacío, dos mecanismos paralelos).
- **Prioridad 1**: arreglar resolver (`ERROR_CODES`), elegir `src/bo`, archivar `_legacy`.
- **Prioridad 2**: primer BO piloto end-to-end (tabla → query por subsistema → clase en `sub_system/` → permiso → consumir desde frontend).
- **Prioridad 3**: dividir queries, activar validación DBMS, capa de servicios + contrato `/me` en frontend.
- **Seguridad**: buena base (bcrypt, httpOnly, CORS, permisos), endurecer secret, sesión persistente y rate limiting antes de exponer con BOs reales.
- **Escalabilidad**: hoy basta con PM2 cluster + sesión en Postgres + NGINX; distribuido/k8s es prematuro a esta carga (medir primero).
- **Móvil (app nativa)**: la capa de negocio (Dispatcher/transacciones/permisos) ya es compatible; la capa de auth con middleware agnóstico cookie/JWT (P21-P22) ya está lista — la app móvil puede autenticarse vía Bearer token. Pendiente: decidir framework (React Native vs Flutter).