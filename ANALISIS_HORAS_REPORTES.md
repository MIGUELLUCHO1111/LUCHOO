# Análisis de datos — Control de Horas en Reportes

**Sección:** Reportes → "Control de Horas — Resumen por Día"
**Fecha:** 25/09/2026
**Estado:** propuestas, todavía no se construyó ninguna. El gráfico día por día sí existe.
**Datos de ejemplo:** proyecto Chevron · Izamiento, 01/09 al 08/09/2026, importados del Excel
"REPORTE DE TRABAJO EN HRS REALES SEPTIEMBRE".

---

## 1. Qué hay hoy

El gráfico día por día de Reportes (`frontend/src/components/ui/horasPorDiaChart.jsx`) replica la hoja
"Gráfico" del Excel de referencia:

- Columnas apiladas: **cobro completo** (ejecutadas + disponibles) y **stand-by**.
- Línea de **horas totales** (contratadas).
- Línea punteada de **horas PTO** (plan del proyecto por día, tabla `project_daily_pto`, migración 052).
- Un solo eje de horas. Tooltip por día con todos los valores y el % stand-by.

Fórmulas vigentes (`backend/src/bo/sub_system/classes/horasReporte.js`):

| Indicador | Fórmula |
|---|---|
| Cobro completo | `SUM(executed_hours + pto_hours)` |
| Stand-by | `SUM(standby_hours)` |
| Horas totales | `SUM(contracted_hours)` |
| % stand-by (agregado) | `(1 − cobro completo / horas totales) × 100`, mínimo 0 — fórmula de la hoja "Gráfico" del Excel |
| % stand-by (por equipo, registro diario) | `stand-by × 100 / horas totales` — columna "%HRS. STAND-BY" de las hojas diarias |

Los datos ya disponibles para cualquier análisis: cobro completo, stand-by, horas totales y horas PTO,
por día, por equipo y por proyecto, más las notas de texto de cada registro.

---

## 2. Análisis propuestos

Ninguno necesita datos nuevos, salvo el 6 (motivos estructurados) y el 7 (tarifas).

### 2.1 Cumplimiento del PTO — recomendado

Compara lo contratado y lo cobrado contra el plan del proyecto.

- **Horas totales / PTO:** 1.229 h de 1.312 h (164 × 8 días) → **93,7%**.
- **Cobro completo / PTO:** 963 h de 1.312 h → **73,4% del plan**.
- Por día: marcar los días por debajo del plan (ej. 01/09: 140 de 164).

Presentación: tarjetas de indicadores arriba del gráfico y resaltado de los días bajo el plan.

### 2.2 Horas perdidas por equipo — recomendado

Horas contratadas que no se cobraron completas: `horas totales − cobro completo`, en un ranking de
los equipos que más pierden. Explica **qué equipos** hacen subir el % stand-by, algo que el gráfico por
día no muestra.

| Equipo | Horas perdidas | % de sus horas totales | Nota |
|---|---|---|---|
| FP-CBA-05 | 36,8 h | 43% | |
| FP-CF-05 | 36 h | 43% | fuera de servicio |
| FP-CC.02 | 34,5 h | 43% | |
| FP-GT.05 | 29 h | 45% | |

### 2.3 Acumulado del mes contra la meta

Segundo gráfico, separado del actual (no un segundo eje): cobro completo acumulado día a día contra el
PTO acumulado. Deja ver si el mes va a cerrar por encima o por debajo del plan.

Es lo que el Excel intentaba con las columnas "Acumulado mes", que estaban mal calculadas: copiaban solo
las ejecutadas los días 1 y 2, y luego el acumulado bajaba de un día a otro. El acumulado correcto al
08/09 es **963,07 h de cobro completo y 182,93 h de stand-by**.

### 2.4 Alertas automáticas

- Días con % stand-by alto (umbral a definir; con más de 30%: 03/09 con 30,6% y 07/09 con 41,5%).
- Equipos con varios días seguidos en stand-by o fuera de servicio.

### 2.5 Vista semanal

Totales por semana y comparación con la semana anterior. Tiene sentido cuando haya más de un mes cargado.

### 2.6 Motivos de stand-by

Agrupar las causas ("fuera de servicio", "falla mecánica", "apoyando desarme…") para medir cuánto tiempo
se pierde por cada una. **Requisito:** que la nota pase de texto libre a una lista de opciones (motivo)
más un comentario opcional; con texto libre la agrupación no es confiable.

### 2.7 Rentabilidad en $

Convertir las horas en dinero. **Requisito:** tarifas por hora de cada equipo o proyecto, que el sistema
todavía no tiene (ver `ROADMAP_HORAS_RENTABILIDAD.md`).

---

## 3. Recomendación

Empezar por **2.1 (cumplimiento del PTO)** y **2.2 (horas perdidas por equipo)**: son rápidos de construir
con los datos actuales y responden las dos preguntas principales, si se cumple el plan y qué equipos están
fallando.

---

## 4. Referencia: comparación con el Excel de septiembre

Resultado de importar el Excel (01 al 08/09) al sistema:

- **Coinciden al 100%** el cobro completo, el stand-by, las horas totales y la cantidad de equipos de
  cada día.
- **Errores del Excel**, no del sistema:
  - Hoja "Gráfico": el 01/09 tiene 103,5 de cobro en vez de 109,5.
  - Hoja "Gráfico": las horas totales del 03, 04 y 05/09 están escritas a mano (154/156/158 contra
    152/144/146 reales).
  - Hoja "Gráfico": el 08/09 está vacío.
  - Columnas "Acumulado mes": mal calculadas (ver 2.3).
- **Decisiones de carga:**
  - MT-07 turno día y turno noche se guardaron como un solo registro de FP-MT.07 (24 h), porque el
    sistema permite un registro por equipo por día. No cambia ningún total.
  - FP-BA-05 y FP-BA-06 del Excel corresponden a FP-CBA-05 y FP-CBA-06 del sistema.
  - Se crearon FP-CF-01 y FP-CF-03, que no existían.
  - Horas PTO de Izamiento: 164 h/día del 01 al 15/09, igual que la hoja.
