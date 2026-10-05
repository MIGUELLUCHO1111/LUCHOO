# Roadmap — Sección Informes (inspecciones pre-uso en tablet)

> **Fecha:** 05/10/2026
> **Estado:** documentado, sin código. **Prioridad: entrega esta semana.**
> **Responsable:** Julio.
> **Fuente:** conversación con Julio + los 9 formatos en papel que usa hoy
> SIAHO (ver §3). Algunos formatos todavía no están al 100%.
> **Es una sección aparte de Mantenimiento.** Más adelante se pueden
> conectar (ver §9), pero Informes no depende de Mantenimiento.

---

## 1. Qué es

Todos los días, antes de que salga cada unidad, se le hace una
**inspección pre-uso** y se llena un informe en papel como soporte. Se
pidió pasar esos informes a **digital**, llenados en **tablet**.

- **Quién llena:** supervisores **SIAHO** y algunos **operadores**, cada
  uno con su usuario.
- **Dispositivos:** al inicio unas **6 tablets**, con **internet**. Más
  adelante la flota liviana lo llenará desde la **app móvil**, contra el
  mismo backend.
- **Firma:** sí, firma en pantalla (en teoría la lleva el papel).
- **Si algo sale mal:** **solo queda reflejado en el informe**. No bloquea
  la unidad ni genera órdenes de trabajo.
- **Destino:** **se le entrega al cliente** (PDVSA-Chevron, contrato
  PB-ISA-2026-PA-402). El PDF tiene que verse como el formato oficial.

## 2. Idea central de la arquitectura

Hay **9 formatos distintos**, con escalas de respuesta distintas. **No se
hacen 9 pantallas:** se hace **un solo motor de formatos**.

- Cada formato es una **plantilla** (datos, no código): encabezado con
  código, revisión y fecha, secciones, ítems y el tipo de respuesta de
  cada ítem.
- Los 9 formatos actuales se cargan como datos iniciales.
- Una sola pantalla de llenado y un solo generador de PDF sirven para
  todos.
- Cuando SIAHO corrija un formato (varios están incompletos), se crea una
  **nueva versión de la plantilla**. Los informes ya llenados **quedan
  ligados a la versión con que se llenaron**, así el PDF histórico que se
  le entregó al cliente no cambia.

Tipos de respuesta encontrados en los formatos:

| Tipo | Opciones | Dónde aparece |
|---|---|---|
| Sí / No / N/A | SI, NO, N/A | Grúas, accesorios, pellizco y EPP, riesgos, transporte |
| Sí / No | SI, NO | Brazo articulado, puntos de pellizco (pesada) |
| Bueno / Malo | BUENO, MALO | Montacargas |
| Bueno / Malo / N/A | B, M, N/A | Flota pesada |
| Bueno / Malo / No posee / N/A | B, M, NP, NA | Flota liviana |
| Cumple / No cumple | C, N/C | Salvaguardas (liviana) |
| Por lado | izquierdo / derecho (y centro en retrovisores) | Luces, bornes, cinturones (pesada) y luces y neumáticos (transporte) |
| Cantidad + Sí/No/N/A | número + SI/NO/N/A | Listas de accesorios |
| Texto / fecha / número | libre | Extintor (tipo, libras, F.V.), póliza (vencimiento), último cambio de aceite, licencia (grado, F.V.) |
| Confirmación por persona | quién realiza + verificador | Conducción (IOGP), izaje con montacargas (persona 1 y 2) |

Todos los ítems llevan además una **observación opcional**. Conviene
**sugerirla** (o pedirla) cuando la respuesta es negativa (NO / M / N/C).

## 3. Inventario de formatos (05/10/2026)

| # | Archivo | Código | A qué unidades aplica | Contenido | Pendiente de completar |
|---|---|---|---|---|---|
| 1 | `INSPECCION DE GRUA.docx` | FP-SIHO-023 | GT | Inspector, conductor, datos del vehículo; 32 ítems SI/NO/N/A con observación | No tiene casillas de firma |
| 2 | `SIHO-024 ACCESORIOS DE GRUAS.docx` | FP-SIHO-024 | GT | 20 accesorios con cantidad + SI/NO/N/A; firma de inspector y supervisor | — |
| 3 | `INSPECCION DE BRAZO.docx` | FP-SIHO-019 | BA / CBA | 28 ítems SI/NO con observación | No tiene casillas de firma ni de inspector |
| 4 | `SIHO-025 ACCESORIOS DE BRAZO ARTICULADO.docx` | FP-SIHO-025 | BA / CBA | 17 accesorios con cantidad + SI/NO/N/A; firma de supervisor | La numeración salta del 12 al 15 |
| 5 | `INSPECIONES MONTACARGAS.docx` | FSIHO-FP-018 | MT (y ¿CF? dice "montacargas y cargador") | 25 ítems Bueno/Malo, izaje (persona 1 y 2), pellizco y EPP, riesgos; 2 páginas | El encabezado dice "Listado de punto de pellizco y salvaguardas"; código con otro formato |
| 6 | `INSPECCION DE FLOTA PESADA.doc` | FSIHO-FP-0015 | Pesada sin formato propio (VEH pesados, CSL, CPS…) | Conductor con licencia, carta médica y manejo defensivo; ~50 aspectos B/M/N/A, varios por lado; puntos de pellizco; extintor | No tiene casillas de firma |
| 7 | `INSPECCION FLOTA LIVIANA.docx` | FP-SIHO-50 | Liviana | Conductor y documentos; ~50 aspectos B/M/NP/NA; pellizco; salvaguardas C/N/C | No tiene casillas de firma |
| 8 | `INSPECCION DE TRANSPORTE PERSONAL.docx` | FP-SIHO (sin número) | TP (transporte de personal) | Documentación; luces y neumáticos por posición; ítems SI/NO/NA; inspeccionado por / verificado por | No tiene número de código |
| 9 | `2 CONDUCCION.pdf` | IOGP (estándar externo) | ¿Todo conductor antes de salir? | 8 confirmaciones "He confirmado", con persona que realiza y verificador; firma del verificador | No es un formato FP; definir cuándo aplica |

**Para SIAHO (no bloquea el desarrollo):** unificar el formato de los
códigos (FP-SIHO-0xx vs FSIHO-FP-0xx), ponerle número al de transporte,
agregar casillas de firma donde faltan y corregir la numeración del 025.
El sistema arranca con los formatos tal como están; cada corrección será
una nueva versión.

## 4. Datos que se llenan solos (no se le piden al inspector)

Todos los formatos repiten el bloque **"Identificación del vehículo"**.
Se llena solo desde lo que ya tiene el sistema:

| Campo del formato | Fuente |
|---|---|
| Sigla de equipo / serial-código, placa | `fleet_unit` |
| Tipo, marca, modelo, año, color, tipo de motor | Ficha técnica de Flota (rama Luis: `fleet_unit_profile` + catálogo de modelos) |
| KM / horómetro | Última lectura (`Flota.Lectura`, rama Luis) o GPS. El inspector **confirma o corrige**, y su lectura se guarda como **nueva lectura con origen INFORME** |
| Póliza vigente / vencimiento | Documentos de la ficha de Flota |
| Inspector | Usuario que inicia sesión |
| Fecha, hora | Automáticas (America/Caracas) |
| Lugar | A elegir de una lista (Boscán, Km 40, Bajo Grande…), sugerido por la ubicación del GPS |
| Contrato | Fijo por plantilla (PB-ISA-2026-PA-402) |

Del **conductor** el sistema hoy no tiene licencia (grado y F.V.), carta
médica ni manejo defensivo. **En la primera entrega se escriben a mano**;
más adelante pueden salir de un expediente del conductor.

## 5. Flujo en la tablet

1. El inspector entra con su usuario y elige la **unidad** (buscador por
   sigla o placa).
2. El sistema le muestra **qué formato(s) le tocan** según la familia de
   la unidad. Por ejemplo, una grúa = inspección de grúa + accesorios de
   grúa.
3. Llena **sección por sección**, con botones grandes (pensado para usarse
   de pie, con guantes). Cada respuesta **se guarda al instante en el
   servidor** (borrador), así no se pierde nada si se corta la señal o se
   cierra la tablet.
4. Al terminar ve un **resumen**: cuántos ítems quedaron en Malo / No /
   No cumple, y cuáles.
5. **Firma** en pantalla (inspector y, si el formato lo pide, supervisor o
   verificador). Al firmar, el informe queda **cerrado**: ya no se edita.
   Si hay un error, un supervisor lo **anula** con motivo y se llena otro.
6. Se genera el **PDF** con el diseño del formato (encabezado con código,
   revisión y fecha).

**Decisión para SIAHO:** ¿se permite un botón "marcar todo como Bueno" y
después cambiar solo lo que falla? Agiliza mucho, pero en una inspección
de seguridad puede verse como no haber revisado de verdad. Lo seguro es
no ponerlo.

## 6. Consulta y entrega al cliente

- **Lista de informes** filtrable por fecha, unidad, formato, inspector y
  "con hallazgos".
- **PDF por informe**, y **descarga en lote** (rango de fechas / unidad)
  para entregarle al cliente.
- Indicador del día: **unidades sin inspección hoy**. Es barato y útil para
  el supervisor; se cruza con el GPS (unidad que se movió sin informe).

## 7. Encaje técnico

- **Subsystem nuevo** `Informes` en el dispatcher, con clases BO
  (`plantilla.js`, `informe.js`).
- **Tablas tentativas:** `inf_template` (código, nombre, revisión,
  versión, familias a las que aplica, activo), `inf_template_section`,
  `inf_template_item` (texto, tipo de respuesta, opciones, orden),
  `inf_report` (versión de plantilla, unidad, inspector, conductor, lugar,
  fecha, lectura de km/horómetro, estado BORRADOR/FIRMADO/ANULADO),
  `inf_report_answer`, `inf_report_signature` (rol, nombre, imagen de la
  firma, fecha) y, opcional, `inf_report_photo`.
- **Firma:** un canvas en el navegador que la guarda como imagen PNG.
  Va al disco igual que las fotos de combustible (multer, `backend/uploads/`).
- **PDF:** el mismo renderer del Tracker (`reportRenderer.js`, Puppeteer +
  Edge), con una plantilla HTML genérica que dibuja cualquier formato.
- **Perfiles:** `siaho` (llena, ve todos, firma como supervisor, anula,
  exporta) y `operador_inspeccion` (llena y ve los suyos).
  ⚠️ Los permisos se asignan **por nombre de método** y se expanden a
  todas las clases con ese nombre. Los métodos que usen perfiles no-admin
  deben tener **nombres únicos** (ej. `listarInformes`, no `listar`).
- **Números de transacción:** reservar **300-349** para Informes (Flota
  200-249, Mantenimiento 250-299). Las migraciones se coordinan con la
  rama Luis, que hoy llega hasta la 050.
- **Frontend:** `/informes` (lista y "sin inspección hoy"),
  `/informes/nuevo` (llenado en tablet), `/informes/:id` (ver, firmar,
  PDF). Más adelante, `/informes/plantillas` (editor de formatos para
  SIAHO).

## 8. Alcance de esta semana vs. después

| Esta semana (MVP) | Después |
|---|---|
| Motor de plantillas + los 9 formatos cargados como datos | Editor de formatos para SIAHO (por ahora los cambia TI) |
| Llenado en tablet con guardado automático | App móvil para la flota liviana |
| Datos del vehículo automáticos (con lo que haya en la ficha) | Expediente del conductor (licencia, carta médica) |
| Firma en pantalla, informe cerrado al firmar | Fotos de hallazgos |
| PDF por informe con el diseño del formato | Descarga en lote para el cliente |
| Lista con filtros + "sin inspección hoy" | Aviso por Telegram si hay hallazgos; enlace con Mantenimiento |

## 9. Dependencias y riesgos (revisar antes de empezar)

1. ⚠️ **Las tablets tienen que llegar al servidor.** Hoy el backend y la
   base corren **en una laptop de la oficina** (`DB_HOST=localhost`).
   Las tablets en campo solo podrán usar el sistema si **ya está
   desplegado en un servidor accesible por internet**, o si están en la
   misma red de la oficina. **El deploy de la primera versión (aún
   pendiente) pasa a ser requisito de Informes.**
2. ⚠️ **Seguridad antes de exponerlo a internet.** De la revisión del
   30/09 hay que corregir primero: (a) usuarios borrados o desactivados
   que todavía pueden iniciar sesión, (b) el registro público
   `/user/register` abierto, y (c) las descargas de archivos que solo
   piden sesión y no permiso. Con tablets en campo, esto deja de ser
   teórico.
3. **Ficha técnica (rama Luis):** marca, modelo, año y color salen de
   ahí. Si una unidad no tiene la ficha completa, el campo sale vacío y
   el inspector lo ve. No bloquea.
4. **Lecturas:** la lectura de km/horómetro del informe se guarda en
   `Flota.Lectura` con origen INFORME. Hay que coordinarlo con Luis.
5. **Mantenimiento (futuro):** un ítem en Malo podría abrir una
   *incidencia* (la cadena Inspección → Incidencia → OT de
   `ROADMAP_MANTENIMIENTO.md` §8). **Hoy no**: el informe solo lo
   registra.

## 10. Decisiones tomadas (Julio, 05/10/2026)

- **Frecuencia: diaria.** Un informe por formato, por unidad y por día.
  Si ya existe uno ese día, el sistema avisa y abre el existente en vez
  de crear otro (un supervisor puede anular y rehacer).
- **Firmas: las que trae cada formato en papel**, ni más ni menos:
  - Accesorios de grúa (024): inspector y supervisor.
  - Accesorios de brazo (025): supervisor.
  - Transporte de personal: inspeccionado por y verificado por.
  - Conducción (IOGP): verificador de inicio del trabajo.
  - Grúa (023), Brazo (019), Montacargas (018), Pesada (0015) y Liviana
    (50) **no tienen firma** en el papel, así que en digital tampoco.
    Igual queda registrado **quién lo llenó** (su usuario) y a qué hora.
    Si SIAHO agrega la firma, se activa con la nueva versión del formato.
- **"Marcar todo como Bueno": NO.** Cada ítem se responde uno por uno.
- **Las tablets entran a la web cuando esté desplegada.** No hay versión
  en red local: **el deploy es el camino crítico de esta sección** (§9.1).
- **Qué formato le toca a cada unidad: aún no se sabe.** Primera entrega:
  el inspector **elige el formato** al iniciar, sin restricción. La
  relación formato ↔ familia queda como dato configurable (una tabla),
  para activarla cuando se defina, sin cambiar código.
- **Conducción (IOGP): no se sabe a quién aplica.** Se carga como un
  formato más, elegible para cualquier unidad, hasta que se defina.

## 11. Preguntas abiertas

1. **¿Qué formato(s) le tocan a cada familia?** (No bloquea: por ahora se
   elige a mano.) Propuesta para validar con SIAHO: GT → 1 + 2;
   BA/CBA → 3 + 4; MT → 5; liviana (VEH, TP de pasajeros) → 7 u 8; el
   resto de la pesada → 6. ¿CF usa el de montacargas o el de pesada?
   ¿CSL, CPS, MDS, RE, VA, CH qué usan?
2. **Conducción (IOGP):** ¿a quién aplica? (No bloquea.)
3. **Lugares:** ¿cuál es la lista oficial de lugares de inspección?
4. **¿Dónde se despliega y cuándo?** Es el requisito para que las tablets
   entren (§9.1).
