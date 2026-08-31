# Roadmap — Sección Combustible

**Subsystem:** `fuel`
**Última actualización:** 27/08/2026
**Fuente:** especificación del usuario (panel web admin). Backend se trabajará en una fase posterior; frontend es el foco inmediato.

Seguridad (agregada 27/08): Personas (registro con nombre, apellido, cargo, departamento), Usuarios (CRUD con correo empresarial y rol), Perfiles (CRUD de roles + asignación de roles a usuarios).

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
| 1 | **Flota Liviana** | CRUD de llenados (leer, borrar, editar, visualizar), filtros (fecha, unidad/unidades, responsable), fotos, export Excel con totales | Frontend listo (responsable/hora/foto sin persistir hasta fase backend) |
| 2 | **Flota Pesada** | CRUD de llenados con fotos opcionales, switch galones/litros, export Excel con total consumido | Frontend listo (tx 96-100 pendientes; modo local activo) |
| 3 | **Tanque de Gasoil** *(fase 2, tras pesada funcional)* | Registro de llenados del tanque que almacena gasoil, control de nivel, alerta de tanque vacío | Planeado |
| 4 | **Personas (seguridad)** | CRUD precargado: nombre, apellido y cargo — fuente de datos para el campo "responsable" de flota liviana | Frontend listo (tx 91-94 pendientes) |

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

### 3.3 Tanque de gasoil (fase 2)

```
1. Sección por cada llenada del tanque que almacena gasoil.
2. Registro de llenado/abastecimiento del tanque (suma al nivel).
3. Cada despacho/llenado de las unidades pesadas resta del tanque.
4. Con cada llenado se ve cómo baja el nivel del tanque.
5. Aviso/alerta cuando el tanque se está quedando vacío.
```

---

## 4. Modelo de datos

> Base aplicada: `db/migrations/002_fuel.sql` (`vehicle`, `fuel_carga`, `fuel_foto`) solo para flota liviana.
> **Decisión 27/08/2026:** el modelo de Combustible pasa a **inglés** (identificadores de BD, igual que el código) y la medida de pesada es un **único par valor+tipo** (`measurement_value` / `measurement_type`). La migración `db/migrations/003_fuel_english.sql` renombra columnas y crea `fuel_pesada`; es **coordinada** con la fase backend (`queries.yaml` + BOs) y con `fuelService.js`/páginas fuel (no aplicar por separado).

### 4.1 `vehicle` (unidades) — ampliar para las dos flotas

Opción adoptada: **reutilizar `vehicle`** agregando un discriminador de flota.

| Columna | Cambio |
|---|---|
| `fleet_type VARCHAR(20) NOT NULL DEFAULT 'liviana'` | Nuevo por `003_fuel_english.sql`: `'liviana' | 'pesada'` (antes `codigo`→`code`, `nombre`→`name`, `placa`→`plate`, `tanque_capacidad_litros`→`tank_capacity_liters`) |
| (pesada) medida usada por la unidad | Indicar si se mide en `km` u `horas` (por unidad o por registro) |

Alternativa descartada: tabla separada `maquina` (un solo catálogo de unidades con `fleet_type`).

### 4.2 `fuel_carga` (llenados flota liviana) — ampliar

| Columna | Cambio |
|---|---|
| `responsible_id BIGINT REFERENCES person(id)` | Nuevo por `003_fuel_english.sql`: responsable (desde seguridad → personas) — antes `responsable_id` |
| `fuel_type VARCHAR(20) NOT NULL DEFAULT 'gasolina'` | Nuevo por `003_fuel_english.sql`: tipo de combustible — antes `combustible` |
| `filled_at` (ex `fecha`) | `TIMESTAMPTZ` guarda fecha+hora capturadas; se **descarta** la separación `fecha`/`hora_llenado` |
| `created_at` (existente) | Hora de REGISTRO; **solo visible por la BD** (rol admin), no en el panel |
| Foto | `fuel_foto` (existente, ligado a `refuel_id` ex `carga_id`) — se sube también desde la web |

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

- **Fotos**: opcionales → `fuel_foto` se generaliza o se crea `fuel_pesada_foto` (decisión pendiente; recomendado generalizar `fuel_foto` con referencia polimórfica o una columna `pesada_id`).
- **Conversión**: `liters = gallons × 3.78541`.

### 4.4 `person` (seguridad) — ampliar para el CRUD personas

`person` ya existe (`db/schema.sql:27-42`): `first_name`, `last_name`, `degree`, `phone`, `document_id`, etc.

| Columna | Cambio |
|---|---|
| `department VARCHAR(150)` | **Nuevo** (la persona se ancla a cargo + departamento; el departamento es catálogo precargado en el front) |
| `cargo` | `degree` (ya existe) |
| `document_id` | Se mantiene NOT NULL; el front lo **autogenera** (`PER-*`) porque el usuario no captura cédula |

CRUD en **Seguridad → Personas** (decisión del usuario: sí incluye editar/borrar): nombre, apellido, cargo, departamento. Precede al selector de responsables de flota liviana.

### 4.4bis `user` — ampliar para el CRUD usuarios

| Columna | Cambio |
|---|---|
| `first_name`/`last_name` | **Nuevas** o derivar de `name` (seguir usando `name` como identificador de login hasta decidir el paso a email) |
| `email` | Ya existe (correo empresarial); decidir si pasa a ser el identificador de login |
| `is_active` | Ya existe |
| Rol | `user_profile` ↔ `profile` (ya existe) |

CRUD en **Seguridad → Usuarios**: nombre, apellido, correo empresarial, rol, contraseña (la digita el admin), activo.

### 4.5 `fuel_tanque` (fase 2) — tanque de gasoil

```sql
CREATE TABLE public.fuel_tanque (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  capacidad_litros NUMERIC(10,2) NOT NULL,
  nivel_min_alerta_litros NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.fuel_tanque_movimiento (
  id BIGSERIAL PRIMARY KEY,
  tanque_id BIGINT NOT NULL REFERENCES public.fuel_tanque(id),
  tipo VARCHAR(10) NOT NULL,           -- 'entrada' (abastecimiento) | 'salida' (despacho)
  cantidad_litros NUMERIC(10,2) NOT NULL,
  referente_tipo VARCHAR(20),          -- 'pesada' | 'manual' | ...
  referente_id BIGINT,                 -- fuel_pesada.id si el despacho fue un llenado pesado
  nota TEXT,
  created_by BIGINT REFERENCES public."user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- Nivel actual = Σ entradas − Σ salidas (se calcula al consultar, no se almacena).
- Alerta cuando `nivel ≤ nivel_min_alerta_litros`.

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

> **PENDIENTE:** el usuario dará la nomenclatura exacta de cada llenado y su `transaction_id`.

Flota liviana actual (verificada en `permission.csv`):

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

Pendientes de nomenclatura (IDs propuestos, a confirmar cuando existan los BOs):

| Transacción | Método esperado | ID propuesto |
|---|---|---|
| Personas listar | `Security/Persona/getAllPersonas` | 91 |
| Personas obtener | `Security/Persona/getPersonaById` | 92 |
| Personas actualizar | `Security/Persona/updatePersona` | 93 |
| Personas eliminar | `Security/Persona/deletePersona` | 94 |
| Llenado detalle | `Fuel/Carga/getCargaById` | 95 |
| Pesada CRUD | `Fuel/Pesada/createPesada` | 96 |
| Pesada obtener | `Fuel/Pesada/getPesadaById` | 97 |
| Pesada listar | `Fuel/Pesada/getAllPesadas` | 98 |
| Pesada actualizar | `Fuel/Pesada/updatePesada` | 99 |
| Pesada eliminar | `Fuel/Pesada/deletePesada` | 100 |
| Foto subida/descarga | Subir/obtener foto de llenado | TBD |
| Roles listar | `Security/Profile/getAllProfiles` | 101 |
| Roles actualizar | `Security/Profile/updateProfile` | 102 |
| Roles eliminar | `Security/Profile/deleteProfile` | 103 |
| Quitar rol a usuario | `Security/Profile/removeProfileFromUser` | 104 |
| Roles por usuario | `Security/Profile/getProfilesByUser` | 105 |
| Tanque (fase 2) | `Fuel/Tanque/...` | TBD |

> **Usuarios:** el CRUD usa `Users/Usuario` 31-36 (ya en `permission.csv`, BO pendiente). El login actual autentica por `name` (`user.name`); al pasar a "correo empresarial" el backend debe aceptar email como identificador (decidir en fase backend).
> **Personas:** `createPerson` (tx 1) funciona hoy; el resto (91-94) queda pendiente. `document_id` se autogenera en el front `PER-XXXX` para cumplir el NOT NULL de la BD.

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
| `/fuel/tank` *(fase 2)* | Tanque Gasoil | Abastecimientos, nivel, alerta de vacío |
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

- `fuelService.js`: `getRefuelById`, métodos de pesada (`createHeavyRefuel`…), vehículos (`createVehicle`…).
- `personService.js` / `userService.js` / `profileService.js` para el CRUD de personas, usuarios y roles.
- Los `transaction_id` se mapean cuando el usuario entregue la nomenclatura.

### 8.4 Orden sugerido de trabajo (frontend)

- [x] 1. **CRUD Personas** (seguridad → personas): precarga responsable.
- [x] 2. **Flota Liviana**: ampliación del formulario + detalle + edición + borrado + filtros + totales + export Excel + fotos.
- [x] 3. **Flota Pesada**: CRUD + switch galones/litros + fotos opcionales + total consumido + export Excel. (tx 96-100 pendientes → modo local)
- [ ] 4. **Tanque Gasoil** (fase 2): registro de abastecimientos, nivel, alerta.

---

## 9. Backend — pendientes (fase posterior)

- Migración `003_fuel_english.sql` (renombrado de columnas a inglés + `fuel_pesada` con medida única; **coordinada** con queries.yaml/BOs/frontend — ver §4).
- BOs nuevos: `Fuel/Pesada`, `Fuel/Tanque`, `Security/Persona` (CRUD personas).
- Queries nuevas en `queries.yaml` (con prefijo por dominio).
- Subida/descarga de fotos (local `backend/uploads/fuel/` para el piloto).
- `insertPermission` para las transacciones nuevas (nomenclatura pendiente del usuario).
- Activar el validador en `dbms.js` (P4) al crecer el número de queries.

---

## 10. Checklist

- [x] Tablas base flota liviana (`vehicle`, `fuel_carga`, `fuel_foto`) — `002_fuel.sql`
- [x] Subsistema `Fuel` (Vehiculo, Carga) verificado end-to-end
- [x] Página `/combustible` con formulario, tabla y barra de tanque
- [x] Frontend CRUD **Personas** (nombre, apellido, cargo) en seguridad → personas (backend tx 91-94 pendientes)
- [x] Frontend flota liviana: responsable, hora de llenado, combustible, foto en web (obligatoria), detalle/editar/borrar
- [x] Frontend flota liviana: filtros (fecha, unidad/unidades, responsable) + totales
- [x] Frontend flota liviana: export Excel con totales
- [x] Frontend flota pesada: CRUD + switch galones/litros + fotos opcionales + total consumido + export Excel (modo local hasta tx 96-100)
- [x] Unidades: selector de flota liviana/pesada (`fleet_type`, persistencia pendiente en BD)
- [x] Modelo de datos en **inglés** + `fuel_pesada` con medida única valor+tipo (decisión 27/08/2026; migración `003_fuel_english.sql` coordinada con backend/frontend)
- [x] Frontend **Personas** rediseñada: nombre, apellido, cargo y departamento (catálogo) — sin cédula (autogenerada), con editar/borrar
- [x] Frontend **Usuarios**: CRUD (nombre, apellido, correo empresarial, rol, contraseña, activo)
- [x] Frontend **Perfiles**: CRUD de roles + asignación de roles a usuarios
- [ ] Nomenclatura `transaction_id` de cada llenado (lo entrega el usuario)
- [ ] Tanque de gasoil: abastecimientos, nivel, alerta de vacío (fase 2)
- [ ] Backend: aplicar `003_fuel_english.sql` + BOs + queries + fotos (fase posterior, habilita 91-105, `fleet_type` y `department`; coordinado con el rename a inglés del modelo)

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