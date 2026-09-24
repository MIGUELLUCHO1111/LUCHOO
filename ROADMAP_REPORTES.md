# Roadmap — Sección Reportes

**Subsystem:** `reports` (aún no existe backend; hoy `reportes.jsx` es 100% mock)
**Fecha:** 08/09/2026
**Fuente:** conversación con el usuario (visión del producto).

---

## 1. Por qué existe esta sección

Reportes no es una sección más — es la razón principal del proyecto. Cada
sección que se construye (Combustible, y las que sigan) genera datos y
estadísticas operativas; Reportes es la capa que **agrega esos datos y los
convierte en indicadores** para que gerencia y presidencia puedan ver, de
un vistazo, cómo está la empresa.

Es una sección que **crece con el sistema**: hoy solo existe Combustible,
así que Reportes hoy solo puede mostrar lo que Combustible (+ el tracker
GPS) puede darle. Cuando se agreguen más secciones (Inventario,
Mantenimiento, Operaciones, etc. — ver `ANALISIS_ARQUITECTURA.md` §11.2),
cada una debería sumar sus propias métricas a Reportes, no reemplazar las
que ya existen.

## 2. Alcance actual (fase 1 — solo Combustible existe)

Con lo que hay construido hasta ahora, gerencia/presidencia deberían poder
ver, para un rango de fechas y por unidad/flota:

| # | Métrica | Unidad | Fuente de datos |
|---|---|---|---|
| 1 | Combustible gastado | Litros/galones **y** dólares | `fuel_carga` (Liviana) + `fuel_pesada` (Pesada) |
| 2 | Infracciones | Conteo por tipo (exceso de velocidad, frenada/aceleración/giro brusco) | GPS Foresight — endpoint `Eventos` |
| 3 | Kilómetros recorridos | Km por unidad | GPS Foresight — endpoint `Odometer` |

## 3. Estado real de cada fuente de datos (lo que ya se verificó)

### 3.1 Combustible gastado — dato propio, ya existe, con un matiz de modelo de negocio

- **Litros** (Liviana, `fuel_carga.liters`) y **galones** (Pesada,
  `fuel_pesada.gallons`): ya se registran hoy, backend real, sin nada
  pendiente.
- **Dólares — solo aplica a Liviana.** Liviana compra combustible por
  transacción en una estación (por eso `fuel_carga.amount` existe y tiene
  sentido). **Pesada no compra combustible por carga**: descuenta del
  tanque de gasoil propio de la empresa (`fuel_tank`/`fuel_tank_movement`,
  ver `roadmap.md` §4.5), por eso `fuel_pesada` correctamente **no** tiene
  columna de monto — no hay una transacción en dólares por cada llenado de
  un camión.
  - Si en algún momento se quiere un "$ gastado en gasoil", ese costo vive
    en el **abastecimiento del tanque** (los movimientos `'in'` de
    `fuel_tank_movement`, que hoy tampoco tienen un campo de costo), no en
    cada carga de Pesada individual — es una métrica distinta ("cuánto
    costó llenar el tanque") a "cuánto consumió cada camión" (que se mide
    en galones/litros, no en dólares).
  - Para el reporte de gerencia: el total en **dólares** de Combustible es
    solo el de Liviana; el total en **litros/galones** sí suma ambas
    flotas.
- No depende del GPS ni de ninguna sección nueva — se puede construir la
  parte de litros/galones/dólares de Liviana **ya mismo**.

### 3.2 Infracciones y kilómetros — dependen del GPS, parcialmente listos

Ver `INTEGRACION_GPS_FORESIGHT.md` para el detalle completo de las pruebas.
Resumen para esta sección:

- **Kilómetros recorridos**: el endpoint `Odometer` de Foresight **ya
  funciona** (probado, trae desglose diario de km + odómetro acumulado).
  Lo único que falta es (a) que se liberen todas las unidades de la flota
  (hoy solo hay 1 certificada para el demo) y (b) el mapeo
  `vehicle.code ↔ plateno` para poder cruzar cada unidad de Combustible con
  su placa real en Foresight.
- **Infracciones**: dependen del endpoint `Eventos`, que **hoy no devuelve
  nada** para la unidad de demo (se probó exhaustivamente, no es tema de
  fechas). Falta confirmar con el proveedor si se habilita junto con el
  resto de la flota o necesita activación aparte.

## 4. Lo que falta para cerrar la fase 1 de Reportes

1. Confirmar con Foresight la liberación completa de unidades + si Eventos
   se habilita.
2. Definir y construir el mapeo `vehicle.code ↔ plateno` (dónde vive: nueva
   columna en `vehicle`, o tabla aparte).
3. Backend nuevo: subsistema `Reports` con BOs que agreguen
   `fuel_carga`/`fuel_pesada` (para combustible — dólares solo de Liviana,
   litros/galones de ambas) y que consuman el API de Foresight desde el
   backend (nunca desde el frontend, para no exponer las credenciales del
   proveedor) para infracciones/km.
4. Reemplazar el mock de `reportes.jsx` por estos datos reales, manteniendo
   el mismo espíritu visual (donas + tabla) pero con las métricas reales de
   arriba en vez de los datos de ejemplo actuales.

## 5. Visión a futuro (más allá de la fase 1)

A medida que se agreguen nuevas secciones al sistema (inventario,
mantenimiento, operaciones, etc.), cada una debería definir qué métricas le
aporta a Reportes — este documento se debe ir ampliando con una sección
nueva por cada aporte, en vez de reemplazar lo que ya está aquí. La idea es
que Reportes termine siendo el tablero único de gerencia/presidencia sobre
toda la operación, no solo sobre Combustible.
