# Roadmap — Sección Mantenimiento de Flota

> **Fecha:** 30/09/2026
> **Estado (07/10/2026):** primera y segunda entrega **construidas**. Ver
> §0 justo abajo; el resto del documento es el diseño original.
> **Fuente principal:** `POLITICA MANTENIMIENTO FULLPETRO.docx`
> (FP-MTTO-PO-01, v01, 31/08/2026, Gerencia de Mantenimiento y
> Confiabilidad). La política ya define casi todo el proceso; esta sección
> es básicamente **su versión digital** (la política la llama "CMMS").
> **Depende de:** `ROADMAP_FLOTA_DETALLE.md` (ficha técnica y horómetro),
> que se desarrolla en paralelo.

---

## 0. Lo construido (07/10/2026)

**Decisiones de Julio:**
- Entra toda la flota.
- Niveles de aprobación de la política desde ya.
- Perfiles `mantenimiento`, `supervisor_mantenimiento` y `gerencia`. La correctiva mayor necesita dos firmas de gerencia de personas distintas.
- Umbral USD menor/mayor configurable, todavía sin valor.
- Las OT reemplazan el "historial de servicios" de la ficha de Flota.

**Primera entrega** (`062_maintenance.sql`, transacciones 250-276, subsistema `Mantenimiento`):
- **OT:** preventiva, correctiva menor/mayor y emergencia, con su ciclo de estados y las firmas de §9.4. Emergencia con regularización en 48 h.
- **Tareas y repuestos** dentro de cada OT.
- **Efecto en la ficha de Flota:**
  - Condición operativa automática: "En mantenimiento (OT-xx)".
  - Lectura de cierre en el historial de lecturas (source MANTENIMIENTO).
  - Eventos en el historial de la unidad.
- **Incidencias** que se agrupan en una OT.
- **Criticidad** por unidad (base §5.2) y **ajustes**.
- **Pantallas:** `/maintenance` (incluye la hoja de vida con `?unit=`), `/maintenance/incidents` y `/maintenance/criticality`.

**Segunda entrega** (`063_maintenance_plan.sql`, transacciones 277-288):
- **Plan preventivo** sembrado de §7 (25 servicios por familia + flota liviana), con semáforo "lo que ocurra primero": vencido, próximo, al día, sin base y sin lectura.
- **Medidor estimado:** última lectura (ficha o Combustible) + horas de Control de Horas desde esa fecha.
- **OT preventiva** con un clic. Opcional: generación automática diaria (`MNT_AUTO_PREVENTIVA`, apagada por defecto; cron `MNT_PREVENTIVA_CRON`, 6:00).
- Al cerrar la preventiva se actualiza la base del plan.
- **Catálogos** de servicios (15 sembrados) y proveedores.
- **Evidencias** (fotos y PDF, 10 MB) por `/maintenance/files`.
- **Tiempos de parada:** diagnóstico, espera de repuesto y reparación.
- **Indicadores:** días medios de cierre y horas medias de reparación (90 días); unidades sin lectura.

**Pendiente:**
- KPIs completos de §11 (disponibilidad, MTBF, cumplimiento del plan).
- RCA y Pareto de fallas.
- Matriz de criticidad con puntaje (Anexo D).
- Hoja de vida en PDF para auditoría.
- Predictivo.
- Avisos por Telegram.
- Incidencias desde Informes.
- Que Luis quite `registrarServicio` (tx 172-173) y muestre la hoja de vida en la ficha.

---

## 1. Qué es

Es el módulo que planifica, ejecuta y deja evidencia de todo el
mantenimiento de la flota, sea **preventivo, correctivo o predictivo**. Todo
mantenimiento pasa por una **Orden de Trabajo (OT)** y queda en la **hoja de
vida** de cada equipo, que es la evidencia ante auditorías de PDVSA-Chevron.

## 2. Qué problema resuelve

- La política existe en papel, pero el control se lleva a mano: el formato
  de OT (Anexo B) y el checklist (Anexo C) son físicos o de hoja de cálculo.
- Nadie avisa cuándo un equipo **pasa su horómetro o fecha** de servicio.
  La política prohíbe que un equipo crítico opere así sin una OT abierta
  (la "regla de oro" de §8).
- Los KPIs (disponibilidad, MTBF, MTTR, cumplimiento del plan) no se
  pueden calcular sin datos estructurados.
- El cliente exige un expediente por activo disponible "en todo momento"
  (§10.6).

## 3. Componentes

### 3.1 Plan maestro de mantenimiento (preventivo)
- **Plantillas de tareas por categoría de equipo** (GT, BA, MT, CF, CC),
  cada una con su intervalo en **horas, km o días**, "lo que ocurra
  primero". Ejemplo: aceite de motor cada 250 h o 3 meses.
- Las tablas de la política (§7) son los **datos iniciales**: se cargan tal
  cual, y el fabricante puede ajustarlas por equipo.
- Cada equipo hereda el plan de su categoría. Se pueden hacer ajustes por
  equipo.
- **Motor de vencimientos:** un cron diario calcula, para cada equipo y
  tarea, cuánto falta (horas, km o días) y **genera la OT preventiva
  sola**. La política dice que la preventiva "se origina automáticamente
  del plan maestro" (§9.1).

### 3.2 Órdenes de Trabajo (OT) — el corazón
- **Campos:** los del Anexo B (número, fecha, equipo, horómetro/km, tipo,
  prioridad, solicitante, criticidad, descripción, tareas, repuestos,
  técnico, horas de intervención, prueba funcional, resultado, autorizó,
  cierre).
- **Tipos:** preventiva, correctiva menor, correctiva mayor, correctiva de
  emergencia, predictiva de alerta temprana, predictiva de hallazgo crítico
  y modificación estructural.
- **Ciclo de vida (propuesta):**
  `Solicitada → Aprobada → En ejecución → (En espera de repuesto) → Ejecutada → Cerrada/Validada`,
  más `Rechazada` y `Anulada`.
- **Autorización según tipo** (§9.4): la preventiva se auto-aprueba; la
  correctiva menor la aprueba el Supervisor; la mayor, Gerencia de
  Mantenimiento más Operaciones; la de emergencia se ejecuta de inmediato
  y **se regulariza en 24-48 h**.
- **Evidencia:** fotos y archivos adjuntos. Se reutiliza el mismo mecanismo
  de fotos de Combustible (`multer`, disco local).
- **Efecto sobre el equipo:** abrir una OT que saca el equipo de servicio
  lo marca **Fuera de servicio**, y cerrarla lo devuelve a su condición
  anterior. Al cerrar, el horómetro/km registrado se guarda como lectura.

### 3.3 Checklist de inspección pre-uso (Anexo C)
- El operador lo llena antes de cada turno. Resultado: **Apto**, **Apto con
  observación** o **No apto**.
- **No apto** → genera una OT correctiva y pone el equipo Fuera de
  servicio. **Con observación** → avisa al Supervisor.
- Ítems genéricos, y los específicos se activan por categoría (el cable de
  acero, por ejemplo, solo aplica a GT/BA).
- ⚠️ Lo llena gente en campo: en la práctica necesita **celular o tablet**.
  Hay que conectarlo con la app móvil que ya está planeada
  (`roadmap.md` §11), o hacer una vista web para móvil.

### 3.4 Criticidad de activos (Anexo D)
- Matriz por equipo con 5 criterios ponderados (Seguridad 30%, Impacto 25%,
  Costo 20%, Frecuencia 10%, Respaldo 15%). **≥ 3,5 = crítico**, 2,5-3,4 =
  semi-crítico, < 2,5 = no crítico.
- Valor por defecto según la categoría (§5.2). Por ejemplo, GT, BA, CC y
  MT de 15 ton = crítico.
- La criticidad define **quién autoriza**, **con qué frecuencia se
  monitorea** y **qué KPIs se reportan con prioridad**.

### 3.5 Registro de paradas (downtime)
- Por cada falla: inicio y fin, separando **diagnóstico / espera de
  repuesto / reparación** (§10.3).
- Es lo que alimenta la disponibilidad, el MTBF y el MTTR.

### 3.6 Análisis de fallas
- Categoría de falla por sistema: mecánico, hidráulico, eléctrico,
  estructural o inducido por el operador (§10.5). Con eso sale el
  **Pareto trimestral**.
- **RCA obligatorio** (§10.2) en fallas de emergencia, fallas de equipo
  crítico y fallas repetitivas (más de 2 del mismo modo en 6 meses). El
  sistema **lo detecta y lo exige** al cerrar la OT.

### 3.7 Repuestos usados
- Por OT: número de parte, proveedor, costo y motivo (§10.4).
- Hoy es un registro en la OT, **sin inventario**. Cuando exista la
  sección de Inventario, se conecta ahí.

### 3.8 Predictivo (fase posterior)
- Resultados de análisis de aceite, vibraciones, termografía, END y prueba
  dieléctrica, con su **línea base** y rangos (ISO 4406, zonas de ISO 10816).
- Un resultado fuera de rango → genera una OT predictiva (§8).

### 3.9 Hoja de vida y expediente del activo
- Vista cronológica por equipo: todas sus OT, inspecciones, lecturas,
  repuestos, RCA, análisis y documentos (estos vienen de la ficha técnica).
- Se puede **exportar a PDF** para auditoría. Se reutiliza el renderer de
  PDF del Tracker (`reportRenderer.js`, con Puppeteer y Edge).

### 3.10 Tablero de KPIs (§11)
Disponibilidad de flota (meta ≥ 95% en críticos), cumplimiento del plan PM
(≥ 95%), MTBF, MTTR, % correctivo no planificado (≤ 15%), % predictivo,
costo por hora operada y cierre oportuno de hallazgos críticos (100%).
Reporte mensual. Se conecta con la sección Reportes.

## 4. De dónde salen los datos (integración con lo que ya existe)

| Necesidad | Fuente existente |
|---|---|
| Horas trabajadas por equipo (horómetro) | **Control de Horas**: `hours_daily_entry.executed_hours`, acumulado desde una lectura base |
| Km recorridos (vehículos) | **Tracker GPS** (Recorridos) y odómetro de `fuel_carga` |
| Equipo, categoría, documentos | **Ficha técnica** (`ROADMAP_FLOTA_DETALLE.md`) |
| Técnicos, supervisores, operadores | `person` + perfiles de **Seguridad** |
| Notificaciones | **Bot de Telegram** existente (vencimientos, OT por aprobar, No apto) |
| Cron de vencimientos | `backend/src/tracker/scheduler.js`: mismo patrón con guard de `NODE_APP_INSTANCE` |

**Cruces que aportan valor:**
- **Tracker → Mantenimiento:** si un equipo **Fuera de servicio** aparece
  moviéndose en el GPS, se genera una alerta.
- **Mantenimiento → Control de Horas:** los días con OT abierta explican el
  stand-by. Hoy eso se escribe a mano en la nota ("fuera de servicio por
  falla mecánica").

## 5. Encaje técnico en el sistema actual

- **Subsystem nuevo** `Maintenance` en el dispatcher, con clases BO
  (`plan.js`, `ordenTrabajo.js`, `inspeccion.js`, `criticidad.js`…),
  queries en `queries.yaml` y transacciones al final de `permission.csv`.
- **Roles (RACI, §9.5):** Operador, Técnico, Supervisor de Mtto., Gerencia
  de Mtto./HSE y Confiabilidad pasan a ser **perfiles**. Hoy los permisos
  son "qué funciones puede llamar" cada perfil (`method_profile`), y eso
  alcanza para crear o ver. Pero la **aprobación depende del tipo de OT y
  de la criticidad**, así que hace falta una regla de negocio en el BO,
  además del permiso.
- **Tablas tentativas:** `mnt_task_template`, `mnt_unit_plan`,
  `mnt_work_order`, `mnt_work_order_task`, `mnt_work_order_part`,
  `mnt_work_order_approval` (historial de quién aprobó qué),
  `mnt_downtime`, `mnt_inspection` + `mnt_inspection_item`,
  `mnt_criticality`, `mnt_failure_analysis`, y más adelante
  `mnt_predictive_result`.
- **Frontend:** `/maintenance` (tablero), `/maintenance/orders`,
  `/maintenance/plan`, `/maintenance/inspections`,
  `/maintenance/criticality`, `/maintenance/kpis`.

## 6. Fases propuestas

| Fase | Contenido | Por qué en ese orden |
|---|---|---|
| **1 — Base** | OT (manual) + condición operativa + hoja de vida + criticidad por categoría | Sin OT no hay nada; ya reemplaza el formato físico |
| **2 — Preventivo automático** | Plan maestro + motor de vencimientos + alertas por Telegram | Necesita el horómetro de la ficha técnica; es el mayor valor |
| **3 — Control** | Flujos de autorización por nivel + paradas (downtime) + KPIs | Necesita varias semanas de OT reales para que los KPIs digan algo |
| **4 — Campo** | Checklist pre-uso desde móvil | Depende de la app móvil |
| **5 — Avanzado** | Predictivo, RCA, Pareto, conexión con Inventario | Lo más especializado, sobre una base ya estable |

## 7. Preguntas abiertas (definir antes de desarrollar)

1. **Alcance:** la política solo cubre **equipos de izamiento del contrato
   PDVSA-Chevron** (GT, BA, MT, CF, CC: unos 21 equipos en el Anexo A).
   ¿Mantenimiento incluye también la **flota liviana** (camionetas), con
   otro plan más simple por km?
2. **Horómetro:** ¿quién lo lleva y cómo? ¿Una lectura manual diaria, o se
   deriva de `executed_hours` de Control de Horas? Lo segundo evita doble
   captura, pero puede no coincidir con el horómetro físico del equipo.
3. **Montos:** ¿cuál es el monto que separa una correctiva **menor** de una
   **mayor**? La política dice que lo define Gerencia de Mtto. con Finanzas.
4. **¿Quién usa el sistema?** ¿Técnicos y operadores tienen usuario propio,
   o carga todo un coordinador?
5. **Terceros:** la política menciona "cuadrillas propias y de terceros".
   ¿Los talleres externos se registran en la OT (proveedor y costo)?
6. **Numeración de OT:** ¿qué formato? Hay un antecedente: el ID de
   transacción de combustible pasó de texto libre a autogenerado.
7. **Histórico:** ¿se cargan las OT y fallas anteriores (GT-01 sin motor,
   GT-07 y BA-01 en reparación), o se arranca desde cero con una
   evaluación inicial (§4)?
8. **Códigos:** la política usa `GT-02`, y el sistema tiene `FP-GT-02` o
   `FP-GT.02`. Hay que definir el código normalizado junto con la ficha
   técnica.
9. **CC-01 en estado "Conveca":** la propia política pide homologarlo.
   ¿Qué significa?

## 8. Inspiración: demo de PJ System Solutions (revisada 30/09/2026)

Se revisaron 9 pantallas guardadas del demo
`fullpetro.pjsystemsolutions.com` (usuario "Demo Full Petro", datos
referenciales/ficticios, con códigos de flota de Foresight): Panel de
taller, Órdenes de reparación, Incidencias, Inspecciones, Checklists,
Mantenimiento preventivo, Mantenimiento programado, Repuestos y Panel de
almacenes. Es un ERP de **taller que le factura a clientes** (tiene
clientes, facturación, tarifa horaria, bahías, citas, Bs/USD), no un
mantenimiento interno regido por una política.

**Se adopta:**
- **Cadena Inspección → Incidencia → OT.** Cada punto fallado del
  checklist abre una *incidencia* (el problema) y las incidencias se
  resuelven en una *OT* (el trabajo). Separar "problema" de "trabajo"
  encaja con el "reporte de falla" del operador (RACI §9.5). También se
  pueden anotar incidencias a mano.
- **Medidor estimado:** última lectura registrada + lo que la telemetría
  acumuló desde entonces, y **cada OT con su lectura vuelve a anclar la
  estimación**. Aquí sería km del GPS para vehículos y `executed_hours` de
  Control de Horas para equipos. Resuelve la pregunta 2 del §7.
- **Plan "cada X o cada N días, lo que ocurra primero"**, con semáforo
  (vencido / próximo / al día) y "falta N" en la lista de vencimientos.
- **Checklists configurables por sistema** (motor, frenos, hidráulico…),
  con alcance por marca o modelo. Se cargan con los ítems del Anexo C.
- **Estados de OT** Abierta / En proceso / Espera repuesto / Cerrada, más
  *Aprobada* por la política.
- **Panel "Requiere atención":** OT sin técnico, OT estancadas más de 15
  días, repuestos bajo mínimo. Es barato y útil.
- **Catálogo de servicios:** cada tarea (ej. "Servicio de frenos") con su
  sistema, tipo (preventivo/correctivo) y **duración estimada**. Es la base
  de las plantillas del plan maestro y de la carga de trabajo.
- **Proveedores con tipo** (taller externo, certificación de izamiento,
  hidráulica…), para las OT hechas por terceros (pregunta 5 del §7).
- **Pantalla táctil para el taller:** el demo le da al rol taller una
  interfaz grande, pensada para alguien "de pie, con guantes". Aplica al
  checklist y a la OT en campo.
- **Indicadores:** "días medios de cierre" (base del MTTR) y
  **"unidades sin lectura"** (en el demo son 39 de 68: el problema
  principal es la lectura base).

**No se adopta:**
- Todo lo comercial: clientes, facturación, tarifa horaria, bahías y
  citas. FullPetro mantiene su propia flota.
- **Planes solo por km.** El demo mide grúas y montacargas en km ("Hyster
  Montacargas 12.000 km"). Los equipos se miden en **horas**, y la
  política habla de horómetro.
- **Inventario completo por ahora:** almacenes, ubicaciones, traslados,
  mínimos, compatibilidad y equivalencias de piezas. Es un módulo entero
  (la futura sección Inventario). En Mantenimiento fase 1 solo se
  registran los repuestos usados en la OT.

**Lo que el demo no tiene y la política exige** (nuestro diferencial):
flujos de autorización por nivel, criticidad, paradas desglosadas
(diagnóstico / repuesto / reparación), RCA, predictivo y vencimiento de
certificaciones.

## 9. Coordinación con la ficha técnica (desarrollo en paralelo)

Ver `ROADMAP_FLOTA_DETALLE.md` §5: quién es dueño de cada dato, y cómo
evitar choques de **número de migración** y de **números de transacción**
en `permission.csv` (reservar rangos o integrar una rama primero).
