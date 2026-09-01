# Revisión de arquitectura — Security (Person/User/Profile/Option)

> **Fecha:** 31/08/2026
> Hallazgos de una revisión de robustez, desacoplamiento y escalamiento sobre
> todo lo construido en la sección Security esta sesión (Person, Usuario,
> Profile, Option, el core de `security.js`, el dispatcher y las sesiones).
> Es una lista de pendientes para atacar más adelante — nada de esto se
> implementó todavía.

---

## Robustez

### 1. Cero atomicidad en operaciones multi-paso (y ya existe la solución sin usar)
`backend/src/dbms/dbms.js` ya tiene `beginTransaction()` / `commitTransaction()`
/ `rollbackTransaction()` / `executeJsonTransaction()` (líneas 333-393)
construidos y listos, pero **ninguna clase de Security los usa**. Cada llamada
a `executeNamedQuery()` abre y cierra su propia conexión del pool de forma
independiente — no hay ninguna transacción real detrás.

Casos concretos donde ya es un problema real:
- `backend/src/bo/sub_system/classes/usuario.js` → `createUsuario`: inserta el
  `user` y, si falla el `insertUserProfile` siguiente, el usuario queda creado
  huérfano (sin perfil, sin rollback).
- `usuario.js` → `updateUsuario`: 3-4 escrituras secuenciales (`updateUsuario`,
  `updateUserPassword`, `deleteUserProfilesByUser` + `insertUserProfile`) sin
  transacción — una falla a mitad de camino deja al usuario parcialmente
  actualizado.
- `backend/src/bo/sub_system/classes/option.js` → `grantSectionMethods` /
  `revokeSectionMethods`: hace el `INSERT`/`DELETE` en `option_profile` y
  luego un loop de N llamadas (una por método) a `security.setPermission()` /
  `delProfileMethod`. Si falla la llamada 5 de 10, el perfil queda con la
  sección "asignada" pero solo la mitad de los permisos de método reales
  otorgados — silencioso, sin rollback, sin log de qué falló.

**Fix propuesto:** envolver estos métodos en `dbms.executeJsonTransaction()`
(ya existe, no hay que construir nada nuevo).

### 2. `permission.csv` — el `id` es cosmético, sin ninguna salvaguarda
El id real de cada transacción lo asigna Postgres por **orden de inserción**,
no por el número escrito en el archivo. Comprobado empíricamente dos veces
esta sesión (Person casó con lo esperado, Profile no). Nada en el código lo
valida ni lo documenta salvo una nota en `db/MODELO_DATOS.md`. Cualquiera que
edite el CSV sin saber esto puede reordenar accidentalmente los
`transaction_id` que el frontend ya tiene hardcodeados, rompiendo features
enteras sin ningún error visible hasta que alguien prueba a mano.

**Fix propuesto:** documentarlo de forma más visible (ej. un script de
verificación post-sync que compare el CSV vs. la tabla `transaction` y avise
si no coinciden), o migrar a un mecanismo donde el id se declare explícito
(`INSERT ... OVERRIDING SYSTEM VALUE`) en vez de depender del orden.

### 3. Cache en memoria de `Security` sin invalidación automática
Cada BO que muta perfiles/permisos (`usuario.js`, `profile.js`, `option.js`)
tiene que acordarse manualmente de llamar `security.syncUserProfiles()` o
`security.syncPermissions()` después de escribir. No hay ningún mecanismo
(evento, hook en el DBMS, decorator) que lo garantice. Ya se me olvidó una vez
esta sesión y tuve que retrofittear las llamadas una por una — es exactamente
el tipo de bug que reaparece la próxima vez que alguien agregue un método de
asignación nuevo.

### 4. Reglas de contraseña inconsistentes entre los puntos donde se establece una
Ya se corrigió una instancia (login exigía fuerza de contraseña). Pero sigue
habiendo asimetría real:
- Crear usuario desde el panel exige 6 caracteres sin complejidad
  (`frontend/src/pages/users/users.jsx`, `minLength={6}`).
- `/user/register` y `/user/reset-password` exigen 8+ con
  mayúscula/minúscula/número (`backend/utils/validator.js`).
- Costo de bcrypt distinto: `session.js` usa costo 12, `usuario.js` sigue en
  costo 10.

No es un bug hoy, pero confundirá al próximo que lo toque.

### 5. Rate limiter compartido entre las 4 rutas de auth
20 intentos combinados entre login/registro/forgot/reset por IP
(`backend/src/session/sessionRoutes.js`). Un solo cliente detrás de la misma
IP (oficina, NAT) agotando el cupo en cualquiera de las 4 bloquea las otras 3
también. Ya me pasó durante las pruebas de esta sesión.

---

## Desacoplamiento

### 1. `SECTION_PERMISSIONS` en `option.js` conoce los detalles internos de todos los demás subsistemas
La tabla hardcodeada en `backend/src/bo/sub_system/classes/option.js` (líneas
12-63) obliga a la clase `Option` a saber exactamente qué métodos existen en
`Person`, `Usuario`, `Profile`, `Fuel.Vehiculo`, `Fuel.Carga`. Cada vez que se
agregue un método nuevo a cualquier BO, hay que acordarse de venir a
actualizar este archivo específico — no hay ninguna relación estructural, es
una lista de strings mantenida a mano en paralelo a `permission.csv`.

### 2. Dos sistemas de autorización paralelos, sincronizados a mano
`method_profile` (la barrera real que usa el dispatcher) y `option_profile`
(sección/menú) son conceptualmente independientes, y el puente entre ambos
(`grantSectionMethods` / `revokeSectionMethods`) es código de aplicación, no
una restricción de la base de datos. Si alguien inserta/borra en
`option_profile` directamente (una migración futura, otra herramienta de
admin), `method_profile` puede quedar desincronizado sin que nada lo detecte.

### 3. Tres puntos de mantenimiento para agregar una sola sección nueva
Para que una página nueva participe en el sistema de permisos hay que tocar:
`frontend/src/components/Sidebar/Sidebar.jsx` (menú), una migración nueva en
`option` (seed), y `SECTION_PERMISSIONS` en `option.js`. No hay un solo lugar
que describa "esta página existe y estos son sus permisos".

### 4. Dos validadores + un tercero improvisado, todos en el camino de auth
`backend/src/validator/validator.js` (Zod, estructural), `backend/utils/validator.js`
(regex manual, sessionRoutes), y un check manual inline agregado en `/login`.
Tres formas distintas de validar en el mismo subsistema.

---

## Escalamiento

### 1. El cache de `Security` es un singleton en memoria de un solo proceso
Contradice el propio plan de escalamiento del proyecto (`ANALISIS_ARQUITECTURA.md`
recomienda PM2 en modo clúster). Bajo clúster, cada worker tendría su propio
mapa de permisos/perfiles en memoria. Si un cambio de permisos ocurre en el
worker A, los workers B/C/D nunca se enteran (no hay pub/sub ni invalidación
entre procesos) — quedarían sirviendo autorización desactualizada
indefinidamente. Gap serio si el proyecto llega a desplegarse como se
documentó.

### 2. `syncPermissions()` hace un resync completo del sistema entero por cada cambio puntual
Otorgar/revocar un permiso a un perfil dispara: releer `permission.csv`
completo del disco + una query que hace join de 6 tablas para traer toda la
matriz de permisos + reconstruir el mapa completo en memoria. Hoy es barato
(matriz pequeña); con más subsistemas/perfiles, cada asignación individual se
vuelve progresivamente más cara.

### 3. Sin paginación en ningún `getAll*`
`getAllPersons`, `getAllUsuarios`, `getAllProfiles`, `getAllOptions` traen
todo sin límite, y las tablas del frontend renderizan todo de una vez. Bien
para decenas de filas, no para cientos.

### 4. El rate limiter usa `MemoryStore`
Mismo problema que el cache de Security: no sobrevive un reinicio ni se
comparte entre workers en clúster.

### 5. Un usuario solo puede "actuar" con un perfil, aunque el modelo soporta varios
`user_profile` es N:M, pero tanto el backend (`profiles[0]` al hacer login)
como el frontend (mismo criterio) solo usan el primer perfil asignado. El
modelo de datos permite combinar roles; el código no.

---

## Priorización sugerida (impacto vs. esfuerzo)

1. **Transacciones reales** en `createUsuario`/`updateUsuario`/
   `grantSectionMethods`/`revokeSectionMethods` — ya existe la infraestructura,
   es la corrección más barata de las grandes.
2. **Un solo lugar** para el mapeo sección↔permisos, en vez de tres.
3. **Multi-proceso** (cache de Security + rate limiter) — el más importante a
   largo plazo, pero solo urge el día que se despliegue en clúster.
