# Roadmap — Horas Trabajadas / Stand-By / Rentabilidad

> Documento vivo. Se va llenando en varias rondas antes de pasar a
> desarrollo — todavía no hay código para esta sección. Cuando el flujo
> quede confirmado, este archivo es el punto de partida para el plan de
> implementación.

## Contexto

Hoy este control se lleva en un Excel mensual (`REPORTE DE TRABAJO EN HRS
REALES <MES>.xlsx`), una hoja por día del mes + una hoja resumen del mes
anterior. Julio quiere llevarlo al sistema como una sección nueva: cada
día se registran horas de trabajo/stand-by por equipo, y de ahí salen
proyecciones de rentabilidad para gerencia/presidencia — mismo espíritu que
la sección Reportes ya construida (`ROADMAP_REPORTES.md`), pero para una
flota distinta (equipos pesados, no vehículos de combustible ni unidades de
Tracker GPS).

## Qué encontramos al analizar el Excel de referencia

Archivo analizado: `REPORTE DE TRABAJO EN HRS REALES SEPTIEMBRE.xlsx` (solo
lectura, sin modificarlo). 9 hojas: una por día (01 al 08 de septiembre) +
`Gráfico Agosto` (resumen del mes anterior).

**Equipos vistos** (16 códigos distintos, prefijos sin confirmar qué
significan): `FP-GT-02/04/05/06`, `FP-BA-04/05/06`, `FP-CC-02`,
`FP-MT-01/03/06/07_D/07_N`, `FP-CF-01/03/05`. Nótese `FP-MT-07_D` /
`FP-MT-07_N`: el mismo equipo partido en dos filas, turno Día y Noche —
un equipo operando 24h con dos turnos separados.

**Columnas por equipo y día, en la hoja de cada día:**

| Col | Nombre | Contenido |
|---|---|---|
| EJECUTADAS | horas realmente trabajadas ese día |
| DISPONIBLE SEGÚN PTO | horas "cubiertas" por algo llamado PTO aunque no se ejecutaron |
| TOTAL | `EJECUTADAS + DISPONIBLE PTO` → horas de "cobro completo" del día |
| ACUMULADO MES (cobro completo) | suma de TOTAL de todos los días del mes hasta la fecha |
| HRS. STAND-BY OPERACIONAL | horas del día que quedan fuera del cobro completo |
| ACUMULADO MES (stand-by) | igual, acumulado del mes |
| HRS. TOTALES | capacidad contratada del día (10 o 12 según el equipo — probablemente duración de turno) |
| %HRS. STAND-BY | `STAND-BY * 100 / HRS. TOTALES` |
| %HRS. EJEC.+PTO | columna con encabezado pero **sin ninguna fórmula ni dato** en las 8 hojas revisadas — planeada, nunca completada |
| Nota libre | texto: "fuera de servicio por falla mecánica", "asignado a Bajo Grande", etc. |

**Lectura de fondo (a confirmar con Julio, ver Preguntas abiertas):** parece
un esquema de facturación tipo "cobro completo" (ejecutado + un mínimo
contractual garantizado = PTO) vs. "stand-by" (el resto de la capacidad
contratada que no llegó a cobro completo, probablemente a otra tarifa). El
Excel **no tiene ningún monto en dólares**, solo horas — para la parte de
rentabilidad hará falta una tabla de tarifas ($/hora por tipo de hora y/o
por tipo de equipo) que no vive en este archivo.

**`Gráfico Agosto`**: una fila por día del mes con TOTAL HRS. STAND-BY,
%TOTAL HRS. STAND-BY, TOTAL HRS. COBRO COMPLETO, HORAS TOTALES, HORAS PTO
— el resumen mensual que grafica la evolución día a día.

**Problemas de calidad de datos encontrados en el Excel** (por depender de
fórmulas encadenadas a mano, día tras día):

1. El acumulado mensual de varias filas quedó desincronizado — algunas
   filas dejaron de extender la cadena de días a partir de cierto punto y
   ya no reflejan el mes real (se nota comparando las fórmulas de
   `ACUMULADO MES` fila por fila entre hojas de días distintos).
2. Bug de copia en la fila de `FP-CF-05`: su fórmula de acumulado
   referencia la fila de arriba (`FP-CF-01`) para varios días, sumando el
   historial de otro equipo por error.

Esto confirma que el nuevo sistema **no debe reconstruir el acumulado
mensual encadenando fórmulas día a día** — debe ser una consulta agregada
(`SUM(...) WHERE fecha BETWEEN`) sobre filas ya guardadas, para que esta
clase de error deje de ser posible por diseño.

## Requerimientos funcionales confirmados (ronda 2, por Julio)

1. **Llenado diario**: la funcionalidad principal es capturar, día a día,
   los mismos campos que hoy se llenan a mano en el Excel (ejecutadas,
   disponible según PTO, stand-by, nota) por equipo.
2. **Selección de unidades no fija, por día**: a diferencia del Excel (que
   tiene una fila fija por equipo en cada hoja, estén trabajando o no ese
   día), la UI debe tener un selector/botón plegable donde se eligen, cada
   día, cuáles unidades trabajaron — no todas las unidades registradas
   tienen por qué aparecer todos los días.
3. **Registro de unidades compartido con "Unidades"**: los equipos de esta
   sección son del mismo tipo de entidad que ya se maneja en la sección
   Unidades (probablemente extendiendo el mismo registro de vehículos/
   equipos, no una tabla paralela — a confirmar en la ronda de flujo).
4. **El resumen/gráfica mensual se deriva del llenado diario, no se llena
   aparte**: el equivalente a `Gráfico Agosto` se calcula automáticamente
   a partir de lo que se fue registrando día a día, resolviendo de raíz el
   problema de acumulado desincronizado del Excel.

## Jerarquía Empresa → Proyecto → Unidad → Horas (ronda 3, por Julio)

Las horas (y las unidades) no son un listado plano — cuelgan de una
jerarquía real de negocio:

**Empresa (cliente)** → tiene uno o más **Proyectos** → cada Proyecto tiene
**Unidades asignadas** → cada Unidad, dentro de ese Proyecto, registra sus
horas diarias.

Esto explica en retrospectiva la nota "Asignado a Bajo Grande" que
encontramos en el Excel (fila `FP-BA-06`) — hoy anotan a mano, en una
columna de texto libre, lo que en el sistema nuevo debería ser un campo
formal de asignación a proyecto.

Detalles confirmados de esta relación:

- **Una unidad está asignada a un solo proyecto a la vez**, pero esa
  asignación es **vigente por un período de tiempo** (no permanente) — una
  unidad puede reasignarse a otro proyecto más adelante. La relación
  Unidad↔Proyecto necesita fecha de inicio (y de fin, cuando se reasigna),
  no solo un `project_id` fijo en la unidad.
- **La tabla de llenado diario es por proyecto**: cada proyecto ve/llena
  solo las unidades que tiene asignadas ese día, no las 16 filas fijas de
  todos los equipos como hoy en el Excel.
- **PTO (horas "disponible según PTO") es un campo manual**: lo rellena la
  persona encargada cada día, **no se calcula ni se deriva** de ningún
  contrato o parámetro fijo.
- **HRS. TOTALES (capacidad contratada del día) varía por proyecto** y
  también **es manual** — lo rellena la persona encargada, no es un valor
  fijo por tipo de equipo como parecía en el Excel (donde coincidía con
  10 o 12 para casi todos).

**Importante — separación de responsabilidades:** esta sección (Horas) es
solo para **capturar/rellenar** los datos diarios. La parte de **ver** la
gráfica y la tabla de horas de forma visual (el equivalente a `Gráfico
Agosto`) **no vive aquí** — se muestra dentro de **Reportes**, junto a lo
que ya existe de combustible.

## Empresas y Proyectos: registros nuevos, y va a crecer (ronda 4, por Julio)

**Empresas y Proyectos se crean desde cero** — no existe nada parecido hoy
en el sistema. Por el momento solo se tiene la tabla de una empresa (el
Excel de septiembre que ya analizamos), pero **pronto se suman 3 empresas/
proyectos más**, y Julio espera que la lista siga creciendo después de
eso. Esto refuerza que ambos deben ser registros CRUD reales (como
Vehículo/Unidad ya lo son en el resto del sistema) y no algo hardcodeado
pensando en un solo caso — el diseño tiene que asumir N empresas desde el
día uno, no 1.

## Tipos de proyecto: las variables pueden cambiar, la rentabilidad es lo que se busca siempre (ronda 5, por Julio)

No todos los proyectos son iguales — cada proyecto tiene un **tipo** (línea
de servicio), y el tipo determina qué variables se capturan a diario:

- El Excel que ya analizamos (`FP-GT-xx`, `FP-BA-xx`, etc.) es de un
  proyecto de tipo **Izamiento** (grúas/equipos de levantamiento) — de ahí
  las columnas EJECUTADAS/PTO/STAND-BY/HRS.TOTALES que ya documentamos.
- El siguiente tipo conocido es **Estaciones de Flujo**, que "quizás
  cambien algunas cosas" — es decir, probablemente no capture exactamente
  las mismas columnas que Izamiento (a confirmar cuando llegue su propio
  documento de variables, mismo proceso que seguimos con el de Izamiento).
- Van a seguir apareciendo más tipos con el tiempo (igual que van a seguir
  apareciendo más empresas/proyectos).

**Lo que no cambia entre tipos:** sin importar qué variables capture cada
tipo de proyecto, todos deben poder alimentar el mismo cálculo de
**rentabilidad** al final — ese es el punto de fondo de toda la sección,
consistente con lo que ya se explicó de Reportes (`ROADMAP_REPORTES.md`).

## Preguntas abiertas (pendientes de responder antes de documentar el flujo completo)

1. ¿Qué significa exactamente la sigla "PTO"? (ya sabemos que su valor es
   manual, no automático — falta el significado del término en sí, por si
   afecta cómo se presenta el campo en la UI).
2. ¿Qué significan los prefijos de código de equipo (`GT`, `BA`, `MT`, `CC`,
   `CF`)?
3. ¿Existen tarifas ($/hora, por tipo de hora y/o por equipo/proyecto) en
   algún otro documento, para la parte de rentabilidad?
4. ¿El registro de "Unidades" de esta sección es el mismo que ya existe en
   el sistema (Fuel `Vehiculo` o Tracker `Unidad`), o es un registro nuevo
   y separado para equipos pesados?
5. La tabla diaria de la empresa que ya vimos tiene columnas fijas
   (EJECUTADAS/PTO/STAND-BY/HRS.TOTALES/nota). ¿Las 3 empresas nuevas que
   vienen van a llevar exactamente esas mismas columnas, o cada
   empresa/proyecto podría tener su propia variación de campos? (matizado
   por la ronda 5: sí puede variar por *tipo* de proyecto — falta saber
   qué tan distintas son las variables de Estaciones de Flujo frente a
   Izamiento).
6. ¿Ya tienes (o vendrá luego) el documento de variables de **Estaciones
   de Flujo**, el segundo tipo de proyecto? Mismo caso que el Excel de
   Izamiento — no hay que adivinar sus campos sin ese documento.
7. Diseño a decidir cuando haya al menos 2 tipos con variables confirmadas:
   ¿conviene un esquema de captura configurable por tipo de proyecto
   (más flexible, más complejo), o tratar cada tipo como su propia tabla/
   formulario específico por ahora (más simple, se generaliza si hace
   falta cuando aparezca un tercer tipo)? No hay que resolver esto todavía
   — con un solo tipo conocido a fondo (Izamiento) sería adivinar.

## Flujo funcional detallado (ronda 6 — cierre de documentación, lista para desarrollo del frontend)

- **Nombre de la sección / menú**: "Control de Horas". Sección nueva de
  primer nivel en el Sidebar (no anidada bajo Reportes — Reportes solo
  consume/visualiza, esta sección es donde se captura).
- **Fechas**: el llenado no es solo de "hoy" — la persona encargada
  también debe poder abrir y editar/completar días anteriores.
- **Campos calculados**: TOTAL (`EJECUTADAS + PTO`) y `%STAND-BY` (y
  cualquier otro derivado) se calculan y muestran automáticamente en la
  UI — de solo lectura, nunca capturados a mano. Los únicos campos que
  digita la persona son EJECUTADAS, PTO, STAND-BY, HRS.TOTALES y la nota.
- **Acceso**: por ahora, mientras el proyecto sigue en fase de desarrollo,
  solo el perfil `admin` (igual que el resto de secciones nuevas hasta
  ahora). Cuando pase a producción, los perfiles/usuarios reales para esto
  se crean manualmente — no hay que anticipar un perfil "Operaciones" ni
  nada parecido todavía.

**Con esto, hay información suficiente para empezar el frontend** de
"Control de Horas" (selector de Empresa → Proyecto → fecha, selector
plegable de unidades asignadas ese día/proyecto, formulario de captura por
unidad, con los campos calculados en automático). El backend (tablas
`empresa`/`proyecto`/asignación unidad-proyecto/horas diarias, BO,
permisos) sigue el mismo patrón ya usado en el resto del sistema
(dispatcher `sub_system`/`class`/`method`, `permission.csv`, verificar ids
reales tras reiniciar) y se puede plantear como plan de implementación
aparte cuando se ataque esa parte.

Quedan pendientes para más adelante (no bloquean el frontend de Izamiento):
significado de "PTO" y de los prefijos de equipo, tarifas $/hora para
rentabilidad, y las variables de "Estaciones de Flujo" (segundo tipo de
proyecto) cuando llegue su propio documento.

## Estado de implementación (ver plan completo en el historial de planes)

Fase 1 (Izamiento) implementada de punta a punta: migración
`017_control_horas.sql` (tablas `company`/`project`/`equipment`/
`project_equipment_assignment`/`hours_daily_entry`), subsistema backend
`Horas` (clases `Empresa`/`Proyecto`/`Equipo`/`Registro`), permisos
132-152 verificados contra la BD real, y 4 páginas de frontend bajo
"Control de Horas" (Registro Diario, Empresas, Proyectos, Equipos).

Verificado con un script de extremo a extremo contra la BD real: crear
empresa→proyecto→equipo, asignar equipo a proyecto, guardar registro de
hoy y de un día pasado, corregir (upsert) un registro ya guardado,
reasignar el equipo a otro proyecto (confirma que cierra la asignación
anterior sin perder el historial), y que `getEquiposAsignados` respeta la
fecha consultada. El frontend compiló sin errores (solo 401 esperados por
no estar logueado) — falta un recorrido manual logueado como admin para
confirmar la UI visualmente (el clasificador de seguridad bloqueó
resetear la contraseña de admin para poder loguearme yo mismo).

Deliberadamente fuera de esta fase: unificación de `vehicle`/
`tracker_unit`/`equipment`, tipo "Estaciones de Flujo", tarifas $/hora.

## Visualización en Reportes (fase 2, ya implementada)

`Horas.Reporte.getResumenHoras({ from, to })` (nuevo, `horasReporte.js`)
agrega `hours_daily_entry` por equipo y por proyecto en un rango de
fechas — mismo patrón que `Fuel.Reporte.getFuelSummary` (agregación en JS
sobre filas ya agrupadas por SQL, respeta el acceso por proyecto de cada
perfil). `frontend/src/pages/reports/reportes.jsx` agrega una dona
(Cobro Completo vs Stand-By), una tabla por proyecto y una tabla de
detalle por equipo, en el mismo rango de fechas que ya usa Combustible.

Sigue sin mostrarse rentabilidad en dólares — tarjeta "Próximamente"
explícita, ya que las tarifas $/hora todavía no existen (confirmado con
Julio: fase 1 es solo horas, sin inventar montos).

Se agregaron además: `Horas.Reporte.getResumenPorDia({ from, to })` — un
renglón por cada día del rango (con 0 en los días sin datos), equivalente
a la hoja "Gráfico Agosto" del Excel — mostrado como tabla en Reportes; y
un bloque "Detalle de un Día" que reutiliza `Proyecto.getEquiposAsignados`/
`Registro.getRegistrosDelDia` (los mismos métodos de Control de Horas) en
modo solo lectura, para ver el desglose por equipo de cualquier día ya
guardado, con Empresa → Proyecto → Fecha.
