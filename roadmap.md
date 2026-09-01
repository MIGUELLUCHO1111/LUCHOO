# Roadmap — Sección Combustible

**Subsystem:** `fuel`
**Última actualización:** 27/08/2026 (cierre completo verificado 01/09/2026)
**Fuente:** especificación del usuario (panel web admin).

> **Corrección 01/09/2026 — sección de Combustible CERRADA:** `003_fuel_english.sql`
> se aplicó, y con eso se construyó `Fuel/Pesada` completo (backend + frontend,
> con descuento automático del tanque de gasoil en una transacción real —
> `db/migrations/007_fuel_backend_closeout.sql`), `Fuel/Tanque` completo
> (`008_fuel_tank_option.sql`, backend + página `/fuel/tank`), fotos reales
> para Liviana y Pesada (`POST/DELETE /fuel/photos`, fuera del dispatcher), y
> `transaction_no` + `getCargaById` para Liviana. Todo verificado end-to-end en
> el navegador. Lo único que queda de esta sección, ya fuera del alcance de
> "Combustible" en sí: la **app móvil** (§11, sin empezar) y dos detalles UX
> menores sin impacto funcional (ver §10).
>
> **Corrección 31/08/2026:** este documento seguía marcando Personas/Usuarios/
> Perfiles como "backend pendiente" — **ya no es así**. El BO completo de
> Security (Person/User/Profile, tx 1-4 + 31-36 + 91-105) está terminado y
> verificado end-to-end desde el 31/08/2026 (ver `ANALISIS_ARQUITECTURA.md`
> §11.8 y `db/MODELO_DATOS.md` §8 para los ids reales de transacción — varios
> no coinciden con los que este documento había propuesto, ver §6).

Seguridad: Personas, Usuarios y Perfiles — **CRUD completo, frontend y backend, funcional end-to-end**. Incluye además un sistema de permisos por sección (`Security/Option`, no estaba planeado en este roadmap) que controla qué partes de la app puede usar cada perfil.

---

## 1. Visión general

El sistema registra **cada llenado de combustible** de las unidades de la empresa, en dos flotas separadas:

- **Flota liviana** (lo ya construido sobre `vehicle` + `fuel_carga`).
- **Flota pesada** (nueva: maquinaria pesada, medidas en galones/gasoil).

Cada llenado lleva una **foto del ticket** (obligatoria o no según flota) y un **id de transacción** que identifica la nomenclatura del registro. El panel web **también carga las imágenes**, igual que la app móvil.

---

## 1.1 Decisiones tomadas (27/08/2026)

| Decisión | Opción elegida |
|---|---|
| Catálogo de unidades | Reutilizar `vehicle` con columna `fleet_type` (`'liviana'|'pesada'`) |
| Solicitante (pesada) | Texto libre |
| Export Excel | Frontend con `xlsx` (SheetJS), sobre el set ya filtrado |
| Combustible (liviana) | Seleccionable por llenado (gasolina/diesel), default `gasolina` |
| Foto (liviana) | **Obligatoria** al registrar |
| Foto (pesada) | Opcional |
| Hora de registro | `created_at` en BD, visible solo por rol admin; el panel muestra fecha/hora de llenado |

---

## 2. Subsecciones

| # | Subsección | Descripción | Estado |
|---|---|---|---|
| 1 | **Flota Liviana** | CRUD de llenados (leer, borrar, editar, visualizar), filtros (fecha, unidad/unidades, responsable), fotos, export Excel con totales | **Funcional end-to-end**, incluyendo responsable/combustible/foto real y `transaction_no` |
| 2 | **Flota Pesada** | CRUD de llenados con fotos opcionales, switch galones/litros, export Excel con total consumido | **Funcional end-to-end** (tx 105-109), con descuento automático del tanque de gasoil |
| 3 | **Tanque de Gasoil** | Registro de llenados/movimientos del tanque, control de nivel, alerta de nivel bajo | **Funcional end-to-end** (tx 111-117, página `/fuel/tank`) |
| 4 | **Personas (seguridad)** | CRUD precargado: nombre, apellido y cargo — fuente de datos para el campo "responsable" de flota liviana | **Funcional end-to-end** (tx 1, 91-94) |

---

## 3. Flujo de usuario

### 3.1 Flota liviana

```
1. Persona entra a /fuel (Flota Liviana)
2. Registra un llenado:
   - Unidad (vehículo)
   - Fecha del llenado
   - Hora del llenado
   - Responsable (persona precargada desde seguridad → personas)
   - Combustible (gasolina)
   - Litros
   - ¿Tanque lleno? (sí/no)
   - Estación (opcional)
   - Odómetro (opcional)
   - Monto (opcional)
   - Observaciones (opcional)
   - Foto del ticket (se sube en la web)
3. El sistema guarda además la hora de registro (created_at) SOLO visible por la BD
   (rol admin con acceso directo a la BD); el usuario ve la fecha/hora de llenado.
4. El registro aparece en la tabla. Se puede:
   - Leer/visualizar (detalle con foto)
   - Editar
   - Borrar
5. Filtrar por: rango de fechas, unidad (o varias unidades), responsable.
6. Al filtrar se muestran los TOTALES: sumatoria de litros y monto.
7. Exportar a Excel: la tabla filtrada más una fila/área de totales
   (sumatoria de litros y monto total). Se exporta también al filtrar por fechas
   o por una o varias unidades.
```

### 3.2 Flota pesada

```
1. Persona entra a /fuel/heavy
2. Registra un llenado:
   - Id de transacción (nomenclatura)
   - Fecha
   - Hora
   - Solicitante (campo distinto al "responsable" de liviana)
   - Unidad (maquinaria pesada)
   - Combustible: gasoil
   - Kilómetros / Horas (según la unidad)
   - Galones
   - Nota (opcional)
   - Foto (OPCIONAL, no obligatoria)
3. Mismo CRUD: leer/visualizar, editar, borrar.
4. Switch para ver la tabla en GALONES o en LITROS (1 galón = 3.78541 L).
5. Filtros y export Excel igual que liviana, con "total consumido"
   (suma en la unidad activa: galones o litros).
```

### 3.3 Tanque de gasoil — implementado

```
1. Página /fuel/tank: uno o más tanques (código, nombre, capacidad, alerta mínima).
2. Registrar movimiento manual (entrada = abastecimiento, salida = despacho manual).
3. Cada carga Pesada registrada resta del tanque activo de gasoil AUTOMÁTICAMENTE
   (transacción real: si falla el descuento, la carga tampoco queda creada).
4. Barra de nivel (TankBar) por tanque, con aviso cuando el nivel ≤ alerta mínima.
5. Historial de movimientos por tanque (fecha, tipo, litros, referencia, nota).
```

---

## 4. Modelo de datos

> Migraciones aplicadas: `002_fuel.sql` (`vehicle`, `fuel_carga`, `fuel_foto`
> originales) → `003_fuel_english.sql` (renombra todo a inglés, agrega
> `fleet_type`/`responsible_id`/`fuel_type`, crea `fuel_pesada`) →
> `007_fuel_backend_closeout.sql` (agrega `transaction_no` a `fuel_carga`,
> hace `fuel_foto.refuel_id` opcional y agrega `fuel_foto.pesada_id`, crea
> `fuel_tank`/`fuel_tank_movement`) → `008_fuel_tank_option.sql` (sección
> `/fuel/tank` en el sistema de permisos). El modelo quedó completamente en
> **inglés**, y la medida de pesada es el único par valor+tipo
> (`measurement_value` / `measurement_type`) tal como se decidió el 27/08.

### 4.1 `vehicle` (unidades) — ampliar para las dos flotas

Opción adoptada: **reutilizar `vehicle`** agregando un discriminador de flota.

| Columna | Cambio |
|---|---|
| `fleet_type VARCHAR(20) NOT NULL DEFAULT 'liviana'` | **Aplicado** por `003_fuel_english.sql`: `'liviana' | 'pesada'`, seleccionable y persistido de verdad desde Unidades (antes `codigo`→`code`, `nombre`→`name`, `placa`→`plate`, `tanque_capacidad_litros`→`tank_capacity_liters`) |
| (pesada) medida usada por la unidad | Indicar si se mide en `km` u `horas` (por unidad o por registro) |

Alternativa descartada: tabla separada `maquina` (un solo catálogo de unidades con `fleet_type`).

### 4.2 `fuel_carga` (llenados flota liviana) — ampliar

| Columna | Cambio |
|---|---|
| `responsible_id BIGINT REFERENCES person(id)` | **Aplicado**: responsable (desde seguridad → personas), persistido de verdad — antes `responsable_id` |
| `fuel_type VARCHAR(20) NOT NULL DEFAULT 'gasolina'` | **Aplicado**: tipo de combustible, persistido de verdad — antes `combustible` |
| `transaction_no VARCHAR(40)` | **Aplicado** por `007_fuel_backend_closeout.sql`: nomenclatura libre, igual que ya tenía `fuel_pesada` |
| `filled_at` (ex `fecha`) | `TIMESTAMPTZ` guarda fecha+hora capturadas; se **descarta** la separación `fecha`/`hora_llenado` |
| `created_at` (existente) | Hora de REGISTRO; **solo visible por la BD** (rol admin), no en el panel |
| Foto | `fuel_foto` (ligado a `refuel_id`) — subida real vía `POST /fuel/photos` (multipart, fuera del dispatcher), mostrada en tabla/detalle/edición |

### 4.3 `fuel_pesada` (llenados flota pesada) — nueva tabla

> Creada por `003_fuel_english.sql`. **Medida única valor+tipo** (no hay odómetro en pesada; hay unidades que se rigen por horas).

```sql
CREATE TABLE public.fuel_pesada (
  id BIGSERIAL PRIMARY KEY,
  transaction_no VARCHAR(40),          -- nomenclatura / id de transacción
  vehicle_id BIGINT NOT NULL REFERENCES public.vehicle(id),
  filled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requester VARCHAR(120),              -- solicitante: distinto al responsable de liviana
  fuel_type VARCHAR(20) NOT NULL DEFAULT 'gasoil',
  measurement_value NUMERIC(10,1),     -- valor de la medida
  measurement_type VARCHAR(10) NOT NULL DEFAULT 'km',  -- 'km' | 'horas'
  gallons NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_by BIGINT REFERENCES public."user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- hora de registro (solo BD)
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ck_fuel_pesada_gallons_positive CHECK (gallons > 0),
  CONSTRAINT ck_fuel_pesada_measurement_type CHECK (measurement_type IN ('km', 'horas'))
);
```

- **Fotos**: opcionales, **implementado** — `fuel_foto` ganó una columna `pesada_id` (nullable, con `refuel_id` también nullable y un `CHECK` de "exactamente uno de los dos") vía `007_fuel_backend_closeout.sql`. Subida real vía `POST /fuel/photos`.
- **Conversión**: `liters = gallons × 3.78541`.

### 4.4 `person` (seguridad) — ampliar para el CRUD personas

> **Ya aplicado** (vía `004_security_completion.sql`, no vía `003`).

`person` ya existe (`db/schema.sql:27-42`): `first_name`, `last_name`, `degree`, `phone`, `document_id`, etc.

| Columna | Cambio |
|---|---|
| `department VARCHAR(150)` | **Nuevo** (la persona se ancla a cargo + departamento; el departamento es catálogo precargado en el front) |
| `cargo` | `degree` (ya existe) |
| `document_id` | Se mantiene NOT NULL; el front lo **autogenera** (`PER-*`) porque el usuario no captura cédula |

CRUD en **Seguridad → Personas** (decisión del usuario: sí incluye editar/borrar): nombre, apellido, cargo, departamento. Precede al selector de responsables de flota liviana.

### 4.4bis `user` — ampliar para el CRUD usuarios

> **Ya aplicado** (vía `004_security_completion.sql` + `006_username_unique.sql`, no vía `003`).

| Columna | Cambio |
|---|---|
| `first_name`/`last_name` | Agregadas — `name` sigue siendo el identificador de login (username), ahora editable a mano por el admin, no solo derivado |
| `email` | Ya existe (correo empresarial), ahora `UNIQUE`; sigue sin ser el identificador de login (decisión sin tomar) |
| `is_active` | Ya existe |
| Rol | `user_profile` ↔ `profile` (ya existe) |

CRUD en **Seguridad → Usuarios**: nombre, apellido, correo empresarial, rol, contraseña (la digita el admin), activo.

### 4.5 `fuel_tank` / `fuel_tank_movement` — tanque de gasoil (implementado)

> Creadas por `007_fuel_backend_closeout.sql`, con nombres en inglés (el
> sketch original de este roadmap las llamaba `fuel_tanque`/
> `fuel_tanque_movimiento` en español; se ajustó al pasar a implementación
> para seguir la convención ya aplicada al resto de Fuel). Se sembró un
> tanque activo por defecto (`TANQUE-01`, 5000L) vía la misma migración.

```sql
CREATE TABLE public.fuel_tank (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  capacity_liters NUMERIC(10,2) NOT NULL,
  min_alert_liters NUMERIC(10,2) NOT NULL DEFAULT 0,
  fuel_type VARCHAR(20) NOT NULL DEFAULT 'gasoil',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.fuel_tank_movement (
  id BIGSERIAL PRIMARY KEY,
  tank_id BIGINT NOT NULL REFERENCES public.fuel_tank(id),
  movement_type VARCHAR(10) NOT NULL,      -- 'in' (abastecimiento) | 'out' (despacho)
  quantity_liters NUMERIC(10,2) NOT NULL,
  reference_type VARCHAR(20),              -- 'pesada' | 'manual'
  reference_id BIGINT,                     -- fuel_pesada.id si el despacho fue automático
  notes TEXT,
  created_by BIGINT REFERENCES public."user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- Nivel actual = Σ entradas − Σ salidas (se calcula al consultar vía subquery, no se almacena).
- Alerta cuando `nivel ≤ min_alert_liters` (se muestra en la tarjeta del tanque en `/fuel/tank`).
- `Fuel/Pesada/createPesada` inserta el movimiento `'out'` automáticamente en el
  tanque activo de `fuel_type` correspondiente, dentro de la MISMA transacción
  de BD que crea la carga pesada (real `BEGIN`/`COMMIT`/`ROLLBACK`, no dos
  escrituras independientes). Si no hay tanque activo, la carga igual se
  registra con un aviso en el mensaje de respuesta.

---

## 5. Reglas de cálculo y unidades

| Regla | Detalle |
|---|---|
| Conversión pesada | `1 galón = 3.78541 litros` |
| Switch galones/litros | Solo cambia la VISUALIZACIÓN (tabla, detalle, Excel, totales); el dato en BD se guarda en galones |
| Totales liviana | Sumatoria de **litros** y **monto total** sobre el set filtrado (fechas, unidad/unidades, responsable) |
| Total consumido pesada | Sumatoria en la unidad activa (galones o litros) sobre el set filtrado |
| Nivel tanque gasoil | `nivel = Σ entradas − Σ salidas`; alerta cuando ≤ nivel mínimo |
| Fecha/hora | El usuario registra **fecha + hora de llenado**; la **hora de registro** es `created_at` (solo BD, rol admin) |

---

## 6. Transacciones / nomenclatura

> **Corregido 31/08/2026:** el `id` que aparece en `permission.csv` es solo un
> identificador de lectura para humanos — **Postgres asigna el `transaction_id`
> real por orden de inserción** cuando `syncPermissions()` sincroniza el CSV
> contra la BD, no por el número escrito en el archivo (ver
> `db/MODELO_DATOS.md` §7 y `SECURITY_REVIEW.md`). Los "IDs propuestos" de la
> versión anterior de esta tabla asumían que el número escrito = el id real;
> **no fue así para Profile**. La tabla de abajo ya tiene los ids reales,
> verificados contra la tabla `transaction`.

Flota liviana + Unidades (verificada en `permission.csv`), **funcional end-to-end**:

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
| 90 | `Fuel/Vehiculo/deleteVehiculo` |
| 110 | `Fuel/Carga/getCargaById` |

Security — **ya completo**, ids reales verificados:

| Transacción | Método | ID real |
|---|---|---|
| Persona crear | `Security/Person/createPerson` | 1 |
| Perfil crear / asignar a usuario / obtener por nombre | `Security/Profile/{createProfile,assignProfileToUser,getProfileByName}` | 2-4 |
| Usuario CRUD | `Users/Usuario/{createUsuario,getUsuarioById,getUsuarioByEmail,getAllUsuarios,updateUsuario,deleteUsuario}` | 31-36 |
| Persona listar/obtener/actualizar/eliminar | `Security/Person/{getAllPersons,getPersonById,updatePerson,deletePerson}` | 91-94 |
| Perfil listar/obtener/actualizar/eliminar/quitar de usuario/perfiles por usuario | `Security/Profile/{getAllProfiles,getProfileById,updateProfile,deleteProfile,removeProfileFromUser,getProfilesByUser}` | 95-100 |
| Sección listar/por perfil/asignar/quitar (**nuevo, no estaba planeado**) | `Security/Option/{getAllOptions,getOptionsByProfile,assignOptionToProfile,removeOptionFromProfile}` | 101-104 |

Fuel Pesada — **funcional end-to-end**, ids reales verificados (confirmaron
la advertencia de arriba: no cayeron en 96-100, quedaron después de 104):

| ID | Método |
|---|---|
| 105 | `Fuel/Pesada/createPesada` |
| 106 | `Fuel/Pesada/getPesadaById` |
| 107 | `Fuel/Pesada/getAllPesada` |
| 108 | `Fuel/Pesada/updatePesada` |
| 109 | `Fuel/Pesada/deletePesada` |

Fuel Tanque — **funcional end-to-end**, ids reales verificados:

| ID | Método |
|---|---|
| 111 | `Fuel/Tanque/createTank` |
| 112 | `Fuel/Tanque/getAllTanks` |
| 113 | `Fuel/Tanque/getTankById` |
| 114 | `Fuel/Tanque/updateTank` |
| 115 | `Fuel/Tanque/deleteTank` |
| 116 | `Fuel/Tanque/getMovementsByTank` |
| 117 | `Fuel/Tanque/registerMovement` |

Fotos (fuera del dispatcher, sin transacción propia — reutilizan el permiso
de crear/editar la carga/pesada del `target_type`): `POST /fuel/photos`,
`DELETE /fuel/photos/:id`, `GET /fuel/photos/file/:targetType/:targetId/:filename`.

> **Usuarios:** el login sigue autenticando por `name` (username) — ya no es
> solo autogenerado, el admin lo puede editar a mano desde el panel (con
> `UNIQUE` en `user.name`). Pasar el login a "correo empresarial" como
> identificador sigue siendo una decisión sin tomar.
> **Personas:** CRUD completo (tx 1, 91-94), incluyendo `department`.
> `document_id` se autogenera en el front `PER-XXXX` para cumplir el NOT NULL
> de la BD.

---

## 7. Exportación a Excel

- Librería recomendada (frontend): `xlsx` (SheetJS) — exportación 100% cliente sobre los datos ya filtrados.
- Contenido de liviana: columnas de la tabla filtrada + **fila de totales** (litros, monto).
- Contenido de pesada: columnas + **fila de total consumido** en la unidad activa.
- Se exporta el mismo set que está filtrado (fechas, unidad/unidades, responsable).

---

## 8. Frontend — plan

### 8.1 Rutas propuestas

| Ruta | Página | Contenido |
|---|---|---|
| `/fuel` | Flota Liviana (existente, se amplía) | Formulario (con responsable, hora, foto), tabla, filtros, totales, export Excel, detalle/editar/borrar |
| `/fuel/heavy` | Flota Pesada | CRUD llenados, switch galones/litros, fotos opcionales, filtros, total consumido, export Excel |
| `/fuel/tank` | Tanque Gasoil | CRUD de tanques, movimientos manuales, historial, alerta de nivel bajo |
| `/fuel/vehicles` | Unidades | Ampliar: selector de flota liviana/pesada |
| `/security/persons` | Personas | CRUD (nombre, apellido, cargo) — reemplaza el placeholder |
| `/security/users` | Usuarios | CRUD (nombre, apellido, correo empresarial, rol, contraseña, activo) |
| `/security/profiles` | Perfiles / Roles | CRUD de roles + asignación de roles a usuarios |

### 8.2 Componentes nuevos/ampliados

| Componente | Notas |
|---|---|
| `Persons` (`persons.jsx`) | CRUD con tabla + formulario (patrón de `vehicles.jsx`) |
| `FuelLightFleet` (`fuelLightFleet.jsx`) | + responsable (select desde personas), + hora de llenado, + combustible, + subida de foto, + filtros, + totales, + detalle modal, + export Excel |
| `FuelHeavyFleet` (`fuelHeavyFleet.jsx`) | Tabla + formulario + fotos + switch galones/litros + total consumido + export |
| `Users` (`users.jsx`) / `Profiles` (`profiles.jsx`) | CRUD usuarios y roles/asignación |
| `Vehicles` (`vehicles.jsx`) | Selector de flota liviana/pesada |
| `FotoUpload` / `FotoViewer` | Carga y visualización de imágenes (reutilizable web/móvil) |
| `FiltrosCombustible` | Selector de rango de fechas, unidades (multi), responsable |
| `TotalRow` | Pie de tabla con sumatorias (litros/monto | galones/litros) |
| `ExportButton` | Botón de export Excel con `xlsx` |

### 8.3 Servicios (frontend)

- `fuelService.js`: vehículos (`createVehicle`…), Liviana (`createRefuel`, `getCargaById`…),
  Pesada (`createHeavyRefuel`…), Tanque (`createTank`, `registerMovement`,
  `getMovementsByTank`…), fotos (`uploadFuelPhoto`, `deleteFuelPhoto`,
  `resolvePhotoUrl`).
- `personService.js` / `userService.js` / `profileService.js` para el CRUD de personas, usuarios y roles.
- `transaction_no` es texto libre que el usuario escribe al registrar el llenado (no autogenerado).

### 8.4 Orden sugerido de trabajo (frontend)

- [x] 1. **CRUD Personas** (seguridad → personas): precarga responsable.
- [x] 2. **Flota Liviana**: ampliación del formulario + detalle + edición + borrado + filtros + totales + export Excel + fotos.
- [x] 3. **Flota Pesada**: CRUD + switch galones/litros + fotos opcionales + total consumido + export Excel (tx 105-109, backend real).
- [x] 4. **Tanque Gasoil**: CRUD de tanques, registro de movimientos, nivel, alerta (tx 111-117).

---

## 9. Backend — CERRADO (01/09/2026)

Todo lo que este roadmap listaba como pendiente ya está hecho y verificado:

- ✅ `003_fuel_english.sql` aplicada (modelo en inglés + `fuel_pesada`).
- ✅ BOs `Fuel/Pesada` y `Fuel/Tanque` (`backend/src/bo/sub_system/classes/pesada.js`, `tanque.js`).
- ✅ Queries nuevas en `queries.yaml` para ambos, con prefijo por dominio.
- ✅ Subida/descarga de fotos real: `backend/src/fuel/fuelPhotoRoutes.js` (multipart
  vía `multer`, disco local `backend/uploads/fuel/`, servido protegido por sesión).
- ✅ `permission.csv` con las transacciones nuevas, ids reales verificados (ver §6).
- ✅ Bug real encontrado y corregido de paso: `STATUS_CODES.CREATED` nunca existía
  en `config.js` (los `create*` devolvían `statusCode: undefined`, invisible
  porque el dispatcher siempre reporta 200 por fuera — pero rompía la ruta de
  fotos, que sí necesita el código real). Se agregó `CREATED: 201`.

No pendiente, fuera de alcance: activar el validador de `dbms.js` (P4) —
sigue siendo una mejora de robustez general, no algo que bloquee Combustible;
ver `SECURITY_REVIEW.md`.

---

## 10. Checklist

- [x] Tablas base flota liviana (`vehicle`, `fuel_carga`, `fuel_foto`) — `002_fuel.sql`
- [x] Subsistema `Fuel` (Vehiculo, Carga) verificado end-to-end
- [x] Página `/combustible` con formulario, tabla y barra de tanque
- [x] CRUD **Personas** (nombre, apellido, cargo, departamento) en seguridad → personas — **frontend + backend, funcional end-to-end** (tx 1, 91-94)
- [x] Frontend flota liviana: responsable, hora de llenado, combustible, foto en web (obligatoria), detalle/editar/borrar
- [x] Frontend flota liviana: filtros (fecha, unidad/unidades, responsable) + totales
- [x] Frontend flota liviana: export Excel con totales
- [x] Frontend flota pesada: CRUD + switch galones/litros + fotos reales + total consumido + export Excel (tx 105-109, backend real, sin modo local)
- [x] Unidades: selector de flota liviana/pesada (`fleet_type`, persistido de verdad)
- [x] Modelo de datos en **inglés** + `fuel_pesada` con medida única valor+tipo — **aplicado** (`003_fuel_english.sql`)
- [x] Frontend **Personas** rediseñada: nombre, apellido, cargo y departamento (catálogo) — sin cédula (autogenerada), con editar/borrar
- [x] **Personas — backend**: CRUD completo end-to-end (tx 1, 91-94)
- [x] Frontend **Usuarios**: CRUD (nombre, apellido, correo empresarial, rol, contraseña, activo) — username editable
- [x] **Usuarios — backend**: CRUD completo end-to-end (tx 31-36)
- [x] Frontend **Perfiles**: CRUD de roles + asignación de roles a usuarios + checklist de secciones permitidas
- [x] **Perfiles — backend**: CRUD completo end-to-end (tx 2-4, 95-100) + permisos por sección (`Security/Option`, tx 101-104, no estaba en este roadmap)
- [x] Nomenclatura `transaction_no` de cada llenado (texto libre, Liviana y Pesada)
- [x] Tanque de gasoil: CRUD, movimientos, nivel, alerta de nivel bajo (tx 111-117, página `/fuel/tank`)
- [x] Backend Fuel Pesada: `003_fuel_english.sql` aplicada + BO + queries + fotos + descuento automático del tanque (transacción real)
- [x] Fotos reales para Liviana y Pesada: subida/descarga/borrado (`/fuel/photos`, fuera del dispatcher)

Detalles menores conocidos, sin impacto funcional (no arreglados a propósito, quedan anotados):
- [ ] Al editar un llenado de Liviana, "Foto del ticket" no tiene un límite de
  cantidad — subir una foto nueva agrega otra fila en `fuel_foto` en vez de
  reemplazar automáticamente la anterior (si no se borra primero a mano con
  el botón de quitar foto, quedan varias asociadas al mismo llenado; la UI
  solo muestra la última).
- [ ] El backend solo acepta jpg/png/webp para fotos; un formato distinto (ej.
  HEIC de iPhone) falla con un aviso claro en vez de bloquear el registro,
  pero puede sorprender a un usuario con iPhone que no sepa esto.

---

## 11. Extensión Móvil — App nativa

La app móvil (nativa única, por ahora solo Combustible) se conecta al mismo backend. El panel web carga imágenes igual que la app.

### Flujo

```
USUARIO MÓVIL (operador)                                  PERSONA ENCARGADA (web)
1. Abre app → selecciona unidad
2. Llena formulario (litros, estación, etc.)
3. Toma foto del ticket
4. Envía → registro + foto se guardan
                                                   5. Ve en el dashboard web:
                                                      - Carga registrada
                                                      - Foto del ticket
                                                      - Nivel del tanque
                                                      - Alertas de anomalías
                                                   6. Valida/verifica la carga
```

### Almacenamiento de fotos (piloto)

Disco local (`backend/uploads/fuel/`) con Express sirviendo estáticos; migrar a S3/MinIO al escalar.

### Checklist móvil

- [ ] Decidir plataforma (React Native / Flutter)
- [ ] Implementar auth (Bearer token — ya listo en backend)
- [ ] Cámara + subida de fotos
- [ ] Pantallas (Home, NuevaCarga, Camera, Historial)
- [ ] Backend: endpoint de subida de fotos + almacenamiento local
- [ ] Web: columna de foto + modal de visualización
- [ ] Piloto con 5 usuarios