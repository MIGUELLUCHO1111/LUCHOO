# Roadmap — Ficha Técnica de la Flota (detalle de unidades)

> **Fecha:** 30/09/2026
> **Estado:** solo documentado — todavía no hay código.
> **Responsable del desarrollo:** compañero de Julio (en paralelo a la
> sección de Mantenimiento, ver `ROADMAP_MANTENIMIENTO.md`).
> **Fuente:** conversación con Julio + `POLITICA MANTENIMIENTO FULLPETRO.docx`
> (FP-MTTO-PO-01, §4.1 "Ficha técnica del activo" y §10.6 "Evidencias").

---

## 1. Qué es y por qué

Hoy ya existe **un registro único de unidades**, `fleet_unit` (desde el
21/09/2026 lo comparten Combustible, Tracker GPS y Control de Horas). Pero
cada unidad solo tiene lo mínimo: código, placa, conductor, tipo de flota
(LIVIANA/PESADA), nombre y capacidad de tanque.

Esta sección **completa la información de cada unidad** para que el sistema
tenga su "ficha técnica": qué es, de quién es responsabilidad, dónde está
asignada, cuánto ha trabajado, cuánto consume y qué documentos tiene.

Es la **base de Mantenimiento**: la política de mantenimiento exige una
ficha técnica por activo antes de habilitarlo a operar (§4.1), y los planes
preventivos se calculan sobre el horómetro/kilometraje que se registra aquí.

## 2. Lo que ya existe (no duplicar)

| Dato | Dónde vive hoy |
|---|---|
| Código, placa, nombre, tipo de flota, capacidad de tanque | `fleet_unit` |
| Conductor (texto libre, "ROTATIVO" por defecto) | `fleet_unit.driver_name` |
| Proyecto asignado (con fechas de inicio/fin) | `project_equipment_assignment` (Control de Horas) |
| Horas trabajadas por día | `hours_daily_entry.executed_hours` (Control de Horas) |
| Km recorridos | GPS (Recorridos / `TRIPSPOINTS_MOD`) |
| Litros cargados + odómetro al cargar | `fuel_carga` / `fuel_pesada` (Combustible) |
| Personas (para "encargados") | `person` (Seguridad → Personas) |

**Regla:** la ficha **muestra y reutiliza** estos datos, no los vuelve a
pedir. Por ejemplo, "a qué proyecto está asignada" se lee de
`project_equipment_assignment`, no se crea otro campo.

## 3. Información nueva a agregar

### 3.1 Datos técnicos (fijos)
- Marca, modelo, número de serie / VIN, año de fabricación.
- Categoría de equipo: **GT** (grúa telescópica), **BA** (brazo articulado /
  boom truck), **MT** (montacargas), **CF** (cargador frontal), **CC**
  (camión cesta), y las categorías de flota liviana que falten. Hoy estos
  prefijos solo están implícitos en el código de la unidad.
- Capacidad nominal (ej. "15 ton", "2,5 ton").
- Tipo de medidor principal: **horómetro** (equipos) o **kilometraje**
  (vehículos), o ambos.
- Tipo de combustible.
- Propiedad: propia / alquilada (ej. GT-03 era alquilada y ya se entregó).

### 3.2 Medidores (cambian con el uso)
- Horómetro y/o kilometraje **actual**, con fecha de la última lectura.
- Historial de lecturas (tabla aparte, no un solo campo), con el origen de
  cada lectura: manual, carga de combustible, GPS o Control de Horas.
- **Lectura base inicial** obligatoria: sin ella no se puede proyectar
  cuándo toca el próximo mantenimiento.

### 3.3 Rendimiento (calculado, no se captura)
- Flota liviana: **km/L** = km recorridos (GPS u odómetro entre cargas)
  / litros cargados.
- Flota pesada: **L/hora** = litros cargados / horas trabajadas en el
  período.
- Se calcula al consultar, igual que el nivel del tanque de gasoil.

### 3.4 Responsables
- Encargado de la unidad (persona de `person`).
- Conductor/operador habitual. Hoy es texto libre; evaluar pasarlo a
  `person` sin perder "ROTATIVO".
- Historial de cambios de encargado, con fechas.

### 3.5 Documentos
- Tipos: certificado de izamiento, prueba de carga, prueba dieléctrica
  (camión cesta), póliza de seguro, registro/título, revisión técnica, etc.
- Cada documento: tipo, número, fecha de emisión, **fecha de vencimiento**,
  archivo adjunto (PDF/foto).
- **Alerta de vencimiento 30 días antes** (lo exige la política, §8). Se
  puede notificar por Telegram igual que las alertas del Tracker.

### 3.6 Condición operativa
Categorías de la política (§4.1): **Operativo en contrato**, **Standby /
back-up (BG)**, **Disponible** o **Fuera de servicio** (con causa: en
reparación, sin componente mayor, etc.).

> ⚠️ Este campo lo **cambia Mantenimiento** (al abrir o cerrar una orden de
> trabajo que saca el equipo de servicio). Ver §5, "Frontera con
> Mantenimiento".

## 4. Pantalla propuesta

Una **ficha por unidad** (se abre desde cualquiera de las 3 pantallas de
unidades actuales), con pestañas:

1. **General:** datos técnicos, responsables, condición y proyecto actual.
2. **Uso:** horómetro/km, historial de lecturas y rendimiento.
3. **Documentos:** lista con semáforo de vencimiento.
4. **Hoja de vida:** la llena Mantenimiento (historial de OT). Dejar el
   espacio previsto.

## 5. Frontera con Mantenimiento (coordinar antes de empezar)

Las dos secciones se desarrollan en paralelo y tocan las mismas unidades.
Para no pisarse:

| Tema | Dueño | El otro solo… |
|---|---|---|
| Datos técnicos, responsables, documentos | **Ficha técnica** | lee |
| Lecturas de horómetro/km | **Ficha técnica** (tabla de lecturas) | lee y, al cerrar una OT, agrega una lectura |
| Condición operativa | **Mantenimiento** la cambia | Ficha técnica la muestra |
| Criticidad (matriz §5) | **Mantenimiento** | Ficha técnica la muestra |
| Hoja de vida (historial de OT) | **Mantenimiento** | Ficha técnica la muestra en su pestaña |

**Choques técnicos a evitar:**
- **Migraciones:** las dos ramas van a crear la `045_…`. Acordar quién toma
  qué número, o renumerar al integrar.
- **Números de transacción** (`backend/config/permission.csv`): la regla es
  "siempre al final con el número siguiente", pero dos ramas en paralelo van
  a usar **los mismos números**. Hay que reservar rangos (ej. ficha técnica
  desde 170, mantenimiento desde 200) o integrar una rama antes de que la
  otra agregue los suyos.
- **Códigos de unidad:** la política usa `GT-02`, y el sistema tiene
  `FP-GT-02` / `FP-GT.02`. Definir un código normalizado antes de cruzar
  datos.

## 6. Inspiración: demo de PJ System Solutions (revisada 30/09/2026)

Del demo `fullpetro.pjsystemsolutions.com` (datos ficticios, ver también
`ROADMAP_MANTENIMIENTO.md` §8) se revisaron Editar unidad, Inventario,
Catálogo, Marcas y colores, Asignaciones de flota, Catálogos, Personal,
Sedes, Proveedores y Panel de inventario.

**Se adopta para la ficha técnica:**
- **Catálogo Marca → Modelo → Versión** (con tipo de equipo/carrocería).
  La unidad *elige* un modelo, no escribe marca y modelo a mano. Evita
  "Grove" vs "GROVE" vs "Grove RT760E".
- **Campos de identificación:** código interno, placa (puede quedar vacía,
  los equipos no siempre tienen), serial de carrocería (del título de
  propiedad), serial de motor, año y fecha de ingreso.
- **"El odómetro no se edita, se vuelve a leer":** las lecturas van a un
  historial, nunca se sobrescriben. También existe **"odómetro reemplazado
  el"** para cuando se cambia el tablero; sin eso, las lecturas nuevas se
  ven como un error.
- **Régimen / propietario:** propia, alquilada a terceros o de un cliente.
  Vacío = de la empresa.
- **Sede o base** de la unidad (el demo usa Boscán y Km 40).
- **Tipos de documento concretos** para vehículos en Venezuela:
  **Certificado del INTT, Permiso de circulación, RCV**, además de los de
  izamiento de la política. En el panel se ven como **"papel vencido"**.
- **Asignación con "frente"** (lugar dentro del proyecto) y estado
  operativo. Hoy `project_equipment_assignment` no tiene frente.
- **Indicador de equipo parado:** "más de 90 días sin movimiento". Aquí se
  puede sacar del GPS y de Control de Horas.
- **Catálogos administrables** (tipos de documento, estados, sistemas del
  vehículo…): listas que se amplían desde la app, sin tocar código.
- **Función ≠ Rol:** el rol es el permiso; la función es a quién se le
  puede asignar trabajo (técnico, conductor, supervisor…). Sirve para
  "encargado de la unidad" y para los técnicos de Mantenimiento.

**No se adopta:** alquiler (tarifario, disponibilidad, reservas), valor de
inventario a costo y antigüedad en patio como stock de venta, colores por
marca, y el simulador de rutas (el demo no tiene GPS real; aquí sí).

## 7. Decisiones tomadas (Julio, 30/09/2026)
- **Documentos obligatorios por categoría:** certificado de izamiento y
  prueba de carga para GT y BA; además prueba dieléctrica para CC.
  Vehículos: Certificado del INTT, RCV y permiso de circulación.
- **Flota liviana:** ficha básica (documentos, km y encargado). La ficha
  completa es solo para los equipos del contrato PDVSA-Chevron.
- **Código oficial:** el del sistema (`FP-GT.02`, el que usa el GPS). El
  de la política (`GT-02`) se guarda como código corto o alias.
- **Carga inicial: NO se importa desde Excel.** Se hace en dos pasos:
  1. **El equipo de TI** carga las unidades que da el Tracker GPS:
     nomenclatura (código), placa y modelo. Código y placa ya están en
     `fleet_unit`, porque el sync del GPS registra solo las unidades
     nuevas. El modelo hay que agregarlo al catálogo.
  2. **Los encargados** completan el resto de la ficha de sus unidades
     (seriales, documentos, etc.) y dan de alta los **modelos nuevos** en
     el catálogo cuando falten.
  - Implica: un perfil "Encargado de flota" que **solo puede editar sus
    propias unidades**, validado en el backend (igual que
    `assertProjectAccess` en Horas); usuario propio para cada encargado;
    y el encargado asignado a cada unidad **antes** de pedirle que la
    complete. Conviene un bloque **"Fichas incompletas"** para que el admin
    vea qué falta.
  - Nota técnica: hoy `foresightClient.getCurrentUnitsStatus` solo guarda
    ID, placa, código, ubicación, coordenadas, encendido y hora (el resto
    de lo que devuelve `usersearchplatform` se descarta). No está
    verificado si la API del GPS trae marca o modelo; si no los trae, el
    modelo se carga a mano en el paso 1.
  - **Modelos nuevos con aprobación de un admin** (decidido 30/09/2026),
    para evitar duplicados ("Grove RT760E" vs "GROVE RT-760E"). El
    encargado propone el modelo y queda **PENDIENTE**; un admin lo
    **aprueba** o lo **rechaza/fusiona** con uno existente. Mientras está
    pendiente, la unidad puede quedar asociada al modelo propuesto, pero
    este no aparece en el catálogo general para los demás. Es el mismo
    patrón que ya usa la aprobación de suscriptores de Telegram (estado
    PENDIENTE/ACTIVO, migración 042).

## 8. Preguntas abiertas
- ¿El horómetro se carga a mano todos los días, o se deriva de Control de
  Horas (`executed_hours` acumulado desde una lectura base)?
