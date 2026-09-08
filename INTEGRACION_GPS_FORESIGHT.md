# Integración GPS — ForesightFlexAPIv3 (hallazgos de pruebas)

> **Fecha:** 08/09/2026
> **Fuente:** especificación técnica compartida por el proveedor
> (`ForesightFlexAPIv3_Consultas_Especificacion_Tecnica (1).docx`, sin
> trackear en git — trae credenciales reales, ver nota de seguridad al
> final) + pruebas reales contra el API en vivo.
> **Para qué sirve este documento:** dejar registrado qué funciona de
> verdad, qué no, y por qué, antes de que se construya la sección de
> Reportes sobre esto — para no repetir las pruebas ni las sorpresas.

---

## 1. Qué es

`ForesightFlexAPIv3` es un servicio `.ashx` (.NET) de la plataforma
Foresight GPS. Un solo endpoint (`POST`, JSON), autenticación doble (Basic
Auth por header + credenciales de plataforma dentro del body), y un
parámetro `method` que decide la operación. El documento del proveedor
describe 5 operaciones de consulta: History, Odometer, Eventos, Viajes y
Posición Actual (ver tabla abajo).

## 2. Limitación del demo (importante)

El proveedor confirmó explícitamente (correo a Sr. Borges, 08/09/2026):
**el acceso hoy está certificado para una sola unidad**, con el fin de
validar la integración. Una vez haya visto bueno del área comercial, se
libera el resto de la flota. Por eso casi todas las placas que se probaron
antes de encontrar la unidad correcta devolvían vacío — **no era un error
de integración**, era la limitación esperada del demo.

- **Única unidad confirmada y funcional:** código interno `FP-VEH.03-02`,
  placa real `A09EN5P`.
- Se probaron sin éxito (vacío en todos los endpoints, sin importar rango de
  fechas): `AH246TD`, `A14ES9P` (el ejemplo del propio documento),
  `FP-VEH.01-01`, `A92BB8R`, `A41EU5P`.

## 3. Estado real verificado por endpoint

| Endpoint | `method` | ¿Funciona hoy? | Notas |
|---|---|---|---|
| Posición Actual | `GetCurrentUnitsStatus` | ✅ Sí | Coordenadas con ~1 minuto de frescura (verificado en vivo). Trae velocidad, rumbo, ubicación en texto, `FuelLevelPercent`, `Odometer`, nivel de batería. |
| History | `wsGetHistoryUnits_V1` | ✅ Sí | Pings de posición (cada ~1h en la unidad de prueba), mismo tipo de campos que Posición Actual. |
| Odometer | `wsGetVehiclesOdometer` | ✅ Sí | Desglose **diario** de km recorridos + odómetro acumulado. Probado hasta 3 meses atrás (desde 09/06/2026) sin problema. |
| Eventos | `GetEventsNotifications` | ❌ Vacío siempre | Probado en un día con movimiento confirmado por Odómetro (48.59 km ese día) y en rango de 3 meses completos — siempre `{"ForesightFlexAPI":{}}`, sin error. Parece **no habilitado** para la unidad de demo, no un problema de fecha/uso. |
| Viajes | `wsGetTripsSummary_v1` | ❌ Vacío siempre | Mismo patrón que Eventos — mismos rangos probados, siempre vacío. |

**Pendiente de confirmar con el proveedor:** si Eventos y Viajes se habilitan
junto con el resto de la flota tras la aprobación comercial, o si requieren
una activación aparte (ej. configuración de umbrales de frenada/aceleración
brusca en el dispositivo).

## 4. Hallazgos técnicos para quien construya la integración

- **Placa ≠ código interno.** El API identifica unidades por `plateno`
  (placa real, ej. `A09EN5P`), pero el campo `Name`/`name` en las
  respuestas trae el código interno de Fullpetro (ej. `FP-VEH.03-02`,
  mismo formato que `vehicle.code` en el modelo de Combustible). Para
  cruzar datos de Reportes con Unidades hace falta un mapeo
  `vehicle.code ↔ plateno` — hoy no existe en el modelo de datos.

- **Los nombres de campo NO son consistentes entre endpoints.**
  `GetCurrentUnitsStatus` devuelve PascalCase (`PlateNo`, `Speed`, `xLong`,
  `FuelLevelPercent`, `LastReported`); `History` devuelve minúsculas
  (`plateno`, `speed`, `xlong`, `fuellevelpercent`, `truetime`). Hay que
  normalizar al parsear cada endpoint por separado, no asumir un solo
  esquema común.

- **Truco para listar unidades:** omitir `plateno` en `GetCurrentUnitsStatus`
  devuelve las unidades visibles para la cuenta en vez de fallar (con la
  cuenta demo, devolvió solo la unidad certificada). El mismo truco
  **no funciona** en `History` (sigue pidiendo una unidad puntual).

- **Los errores tienen esquemas distintos según el nivel que falle:**
  - Basic Auth incorrecto → `{"responseCode":-400,"ForesightFlexAPI":{"ForesightFlexAPI":{"error":"invalid credentials"}}}`
  - Credenciales de plataforma (`wspassword` del body) incorrectas →
    `{"responseCode":100,"ForesightFlexAPI":{"DATA":[{"ErrorMessage":"Credenciales inválidas"}]}}`
  - Consulta válida sin resultados → `{"responseCode":200,"ForesightFlexAPI":{"ForesightFlexAPI":{}}}`
  - Consulta válida con resultados → `{"responseCode":100,"ForesightFlexAPI":{"DATA":[...]}}`

  Ojo: un `responseCode:200` **no** significa "hay datos" — solo significa
  que la petición fue válida. Hay que revisar si `DATA` viene poblado.

- **Coordenadas confirmadas visualmente**: se tomaron las coordenadas de
  una respuesta real (`10.436140, -72.029470`) y se verificaron en Google
  Maps — resuelven a un punto real y coherente ("Zulia, Venezuela, km 48"),
  que coincide con el campo `Location` que ya trae la propia respuesta del
  API en texto. Sirven tal cual para plotear en un mapa (Google Maps
  embebido, Leaflet, etc.), no hace falta geocodificación aparte.

## 5. Comparación contra lo que ya está mockeado en `reportes.jsx`

El mock actual (`frontend/src/pages/reports/reportes.jsx`) anticipa: donas
de "Horas de Trabajo" y "Anormalidades", y una tabla con
ubicación/tiempo/tipo de reporte (exceso de velocidad, paradas bruscas,
aceleraciones bruscas, giros bruscos, ralentí).

- **Horas de Trabajo / Ralentí** → cubierto por **Viajes**, hoy vacío.
- **Exceso de velocidad / paradas bruscas / aceleraciones bruscas / giros
  bruscos** → cubierto por **Eventos**, hoy vacío.
- **Ubicación** → cubierto por **History**/**Posición Actual**, funcionando.

Es decir: con lo que hay habilitado hoy se puede construir la parte de
posición/ruta/kilometraje de Reportes, pero **no** las donas de horas
trabajadas ni la tabla de eventos de conducción — esas dependen de que
Foresight habilite Eventos y Viajes.

## 6. Próximos pasos

1. Confirmar con el proveedor (Sr. Borges / Foresight) si Eventos y Viajes
   se habilitan junto con el resto de la flota, o necesitan activación
   aparte.
2. Cuando se libere el resto de las unidades: pedir la lista completa de
   placas reales asociadas a cada `vehicle.code` para poder armar el mapeo.
3. Definir dónde vive ese mapeo en el modelo de datos (¿columna
   `plate_gps`/`gps_unit_id` en `vehicle`? ¿tabla aparte?).
4. Cuando se implemente de verdad: las credenciales van a `backend/.env`
   (nunca al repo) y las llamadas al API de Foresight se hacen desde el
   backend, no desde el frontend (evita exponer las credenciales del
   proveedor en el navegador).

---

**Nota de seguridad:** este documento no repite las credenciales reales del
API. Viven en
`ForesightFlexAPIv3_Consultas_Especificacion_Tecnica (1).docx`, agregado a
`.gitignore` para que no se suba nunca al repo por accidente.
