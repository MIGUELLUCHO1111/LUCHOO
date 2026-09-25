# Fullpetro API — notas para Claude Code

Este archivo es la memoria del proyecto **Tracker GPS de Flota**. Cualquier sesión de Claude Code que se abra en esta carpeta —en esta computadora o en cualquier otra donde se haya clonado el repositorio— lo lee automáticamente. El objetivo es que Lguerra (usuario principal, no técnico, dicta sus mensajes) no tenga que volver a explicar nada de esto.

## Quién es el usuario y cómo prefiere trabajar
- Lguerra (aborges@fullpetro.com) no es programador — dicta instrucciones, a veces en mayúsculas, a veces con errores de tipeo. Interpretar la intención, no exigir precisión técnica.
- Cuando algo requiere pasos manuales de su parte (terminal, git, GitHub), dar instrucciones **paso a paso, literales, para copiar y pegar** — no asumir que sabe qué es una terminal, una rama, un commit, etc.
- Prefiere resultados directos: generar, enviar, corregir — sin pedir demasiada confirmación para tareas ya establecidas (reportes, alertas).

## Arrancar a trabajar (SIEMPRE al inicio de una sesión)
```bash
pm2 resurrect
pm2 list   # confirmar fullpetro-backend y fullpetro-frontend "online"
```
Después de cualquier cambio en código del backend: `pm2 restart fullpetro-backend`.

**Laptop Windows de la oficina (desde el 23/09/2026):** PM2 corre backend y frontend sin ventanas con `ecosystem.windows.config.cjs` (1 proceso fork cada uno, autorestart; el nombre DEBE terminar en `.config.cjs` o PM2 lo trata como script). Arranca solo al iniciar sesión en Windows: `scripts/windows/Fullpetro (inicio automatico).vbs` copiado a la carpeta de Inicio (`shell:startup`) hace `pm2 resurrect`. Instalación de una vez: `Instalar inicio automatico.bat`. `Iniciar Fullpetro.bat` solo verifica/abre el navegador si hay PM2. `pm2` está en `%APPDATA%\npm\pm2.cmd`. **Ojo:** los procesos que Claude lanza sueltos (`node main.js`, `Start-Process`) se mueren al terminar la tarea — nunca dejar el backend así; usar `pm2 restart fullpetro-backend`.

**Importante:** la base de datos y el backend corren **localmente en esta computadora** (`DB_HOST=localhost` en `backend/.env`) — no hay un servidor compartido en la nube. Si el proyecto se clona en OTRA computadora, esa copia NO tiene acceso a los datos reales de la flota ni al bot de Telegram a menos que se monte ahí también su propio backend+base de datos+credenciales (trabajo largo), o se use Control Remoto de Claude Code para conectarse a la sesión que corre aquí (mucho más rápido). No asumir que "clonar el repo" es suficiente para que todo funcione en otra máquina.

Zona horaria del negocio: `America/Caracas` (UTC-4 fijo, sin horario de verano).
Turnos: MATUTINO 9am, VESPERTINO 2pm, NOCTURNO 9pm.

## Reglas de Git — no cambiar sin confirmar
- **Regla de Lguerra desde el 24/09/2026: "por cada cambio, que se actualice en todas".** Todo cambio que se guarde se sube a **`feature/gps-tracker`, `Luis` y `main`** en `origin` (fast-forward desde `feature/gps-tracker`), y a `feature/gps-tracker` y `Luis` en `personal`. Antes de empujar a `main`, confirmar que es fast-forward (`git merge-base --is-ancestor origin/main HEAD`); si alguien más subió algo a `main`, traerlo primero y resolver, nunca forzar.
- El trabajo se hace en `feature/gps-tracker`. La rama `Julio` es de otra persona: no se toca (se trae a la nuestra cuando lo pidan).
- Existe además un remoto `personal` (`origin`→`https://github.com/juliomoran10/API-Fullpetro.git`, `personal`→ el GitHub personal del usuario) — cuando se pide subir, se sube a los tres: `feature/gps-tracker`, `Luis` y `personal` (ramas `Luis` y `feature/gps-tracker` en `personal` también).
- El permiso de Bash para `git push personal:*` ya está autorizado en `.claude/settings.local.json` (no versionado) — si aparece bloqueado por el clasificador de auto mode en una sesión nueva, hay que volver a autorizarlo ahí.

## El origen de los datos: API interna de GEvolution (no la API "oficial" del proveedor)
La API de socio original (`wsuser`/`wspassword`, `ForesightFlexAPIv3`) solo devolvía una fracción de la flota real (~8-28 de ~70 unidades) y se topaba con límites de tasa. La solución fue **capturar el tráfico real del navegador** (Chrome DevTools → Network → "Preserve log" → exportar como `.har`) mientras el usuario navegaba el dashboard web GEvolution (`cloud.ve.trackergps.com`) con su propia cuenta — nunca metiendo Claude una contraseña en ningún navegador. Eso reveló la API interna que usa el propio dashboard:
- Host: `https://flexapi.foresightgps.com/ForesightFlexAPI.ashx` (sin `v3` en la ruta).
- Autenticación con `userid`/`companyid` (identificadores de cuenta, no secretos) en vez de `wsuser`/`wspassword`.
- `usersearchplatform` → lista completa de la flota (70 unidades reales).
- `REPORT_EXECUTE` con `reportid` específico → reportes del dashboard en una sola llamada (ej. `reportid: 134` = "Comportamiento del Conductor", usado por `getComportamientoDelDia`).
- `TRIPSPOINTS_MOD` → viajes/recorridos de una unidad en un rango de fechas (usado por Recorridos).
- `HISTORYSPOINTS` → puntos GPS crudos de un viaje puntual (para dibujar la ruta en el mapa).

**Si en el futuro algún dato de Tracker GPS vuelve a verse incompleto o limitado por tasa**, la solución casi seguro es la misma: pedirle al usuario que reproduzca esa pantalla en el dashboard web con "Preserve log" activo ANTES de navegar/recargar, exportar el HAR, y buscar la llamada única del dashboard en vez de asumir que hace falta un loop por unidad.

## Funcionalidades ya construidas (Tracker GPS de Flota)

### Estado de Flota (`/tracker`)
Vista en vivo: total, activas, estacionadas, sin señal reciente — todo sale de la última lectura guardada por unidad, sin cálculos manuales. Cuatro bloques desplegables (Activas / Estacionadas / Sin señal / Gestión de Unidades, este último en naranja) cada uno con su propio buscador.

### Gestión de Unidades
Registro interno placa–unidad–conductor–tipo de flota (LIVIANA/PESADA), es solo referencia, no participa en los conteos. **Las unidades nuevas se auto-registran solas** apenas aparece su placa por primera vez en la API (usa el código que ya le pone la plataforma, `raw.Name`, y "ROTATIVO" de conductor por defecto) — pedido de Lguerra, 18/09/2026. Ya no queda nada "sin registrar" esperando que alguien lo note.

### Mapa en Vivo (`/tracker/map`)
Mapa Leaflet con un marcador por unidad coloreado por estado, refresco automático cada 30s. El mapa va **primero** en la página, el selector de Recorridos debajo (pedido explícito).

### Recorridos (viajes de una unidad)
Se puede abrir de dos formas simultáneas (pedido explícito, "TERMINA COMO VENIAS HACIENDO DE AMBAS FORMAS"): haciendo clic en una unidad del mapa, o eligiéndola en un selector aparte. Muestra KPIs (número de recorridos, primera salida, última llegada, km, tiempo en movimiento/estacionado) y la lista de viajes, con botón "Ver ruta" que dibuja el viaje real sobre el mapa (polyline + auto-zoom). El mismo panel (`RecorridosPanel.jsx`) se reutiliza también desde Notificaciones/Alertas.

### Notificaciones (`/tracker/alerts`) — dos pestañas
1. **Alarmas**: historial de alertas "fuera de horario" y de "entrada/salida de geocerca" (etiquetas: Entrada a geocerca verde, Salida de geocerca roja, Fuera de horario naranja; las viejas "fuera_de_geocerca" salen como "Fuera de zona"). Cada fila tiene DOS botones de Recorridos (Geocerca — agrupa entradas y salidas — y Fuera de horario), cada uno anclado a la alerta más reciente de ESE tipo para esa unidad ese día — al hacer clic, se despliega el panel de Recorridos **directamente debajo de esa fila** (no un panel compartido al final de la tabla), mostrando los viajes **a partir del momento de la alerta** (no el día completo — eso es solo para Mapa en Vivo). Si la unidad no tuvo ese tipo de alerta ese día, el botón queda deshabilitado.
2. **Reporte enviado a Telegram**: historial de los reportes de cierre de turno ya enviados.

### Alertas — reglas de negocio
**Esquema acordado el 22/09/2026 (vale "hasta nueva instrucción" de Lguerra — no cambiarlo sin confirmar):**
- Los **reportes de turno** (9am, 2pm, 9pm) son otra cosa, no son alertas — no se tocan.
- **De día → solo entradas/salidas de geocerca. De noche (desde las 8pm) → solo fuera de horario.** Nada de avisos continuos.

- **Fuera de horario**: unidad reporta encendida/en movimiento después de las 8pm (`TRACKER_CURFEW_HOUR`). Se revisa **solo en tres momentos: 8:00pm, 8:30pm y 9:00pm** (`TRACKER_SYNC_CRON` en `backend/.env`, que también tiene 9am y 2pm porque los usan los reportes de turno). Un aviso por episodio: si la unidad sigue activa en la siguiente revisión no se repite. La flota PESADA se guarda en el historial pero **no se notifica por Telegram** (para no saturar, suele estar autorizada). La LIVIANA sí se notifica.
- **Entrada / salida de geocerca** (reemplazó el 22/09/2026 a la vieja alerta propia de "fuera de geocerca" = perímetro global, que se quitó junto con la excepción de Maracaibo/San Francisco y el `ever_inside`): se toman **tal cual las detecta GEvolution** (panel Notificaciones), no se calculan aquí — el tracker lee las posiciones pocas veces al día y se perdería los cruces de geocercas pequeñas (CORE 3, Puente). Solo cuentan las geocercas que tengan configurada en GEvolution su regla de **"Entrada y salida"** (al 22/09: Boscán y Puente Gral Rafael Urdaneta; faltaba crear Km 60 y CORE 3). Nivel: marcada **crítica** en GEvolution → "🚨 ALARMA"; si no → "⚠️ ATENCIÓN". Mensaje: "🟢 Unidad entrando a geocerca" / "🔴 Unidad saliendo de geocerca", con la hora del evento. Toda la flota. Solo las ocurridas de día (6am–8pm, `TRACKER_GEOFENCE_DAY_START_HOUR`); las de noche se ignoran.
  - Cómo funciona: `Alerta.procesarEventosGeocerca` ← cron `TRACKER_GEOFENCE_EVENTS_CRON` (cada 10 min) ← `ForesightClient.getEventosGenerados` (`TRACKINGPANEL_GetGeneratedAlertsEvents`, capturado por HAR). Esa API **solo devuelve ~la última hora** — por eso se consulta seguido, pero cada evento se avisa **una sola vez** (`tracker_alert.external_event_id`, migración 041). Eventos de hace más de 30 min (ej. al reencender el backend) solo se guardan, no se mandan. `eventType '2'` = geocerca, `inzone 'true'` = entró, `criticality '1'` = crítica; las horas vienen con `-05:00` pero son hora de Caracas.
- Cada mensaje de alerta (el mismo texto que se guarda y el que se manda a Telegram — son idénticos) incluye al final una sección **"🛣️ Recorrido de hoy (hasta ahora)"** con el resumen de viajes/km/tiempo en movimiento del día completo hasta ese momento (no se puede anclar "a partir de la alerta" en Telegram porque se envía justo cuando se dispara, todavía no pasó nada después).
- **Limpieza automática**: el historial de alertas se borra solo, todos los días a las 3:30am, después de 8 días (`TRACKER_ALERT_RETENTION_DAYS`) — son datos "solo de revisión", no se guardan para siempre. Corre independiente del interruptor `TRACKER_AUTO_REPORTS`.

### Reportes de Turno (`/tracker/report`)
Ver la sección siguiente — **hay DOS formatos de reporte, no confundirlos.**

## Los dos reportes de Tracker GPS — NO son lo mismo

### 1. Reporte de la app ("Reportes de Turno")
- Lo genera y guarda la propia aplicación (`ReporteArchivo.generarYGuardar`), visible en la pantalla Reportes de Turno.
- Se genera solo al cerrar cada turno, o a mano con "Generar ahora".
- Ordena las unidades **por categoría de ubicación** (Base, Campo, Oficina, Otras).
- Queda guardado permanentemente (Excel, PDF e imagen) y es lo que se manda automáticamente por Telegram al cerrar turno (`Notificador.notificarCierreDeTurno`).

### 2. Reporte "modelo interno"
- Formato Excel aparte que replica el diseño manual que usaban antes de la app (mismo layout, mismas leyendas de color).
- **Mantiene el orden natural de las unidades — nunca se ordena por categoría de ubicación** (eso es exclusivo del reporte de la app). Se corrigió una vez porque se había ordenado mal por asumir que compartían esa lógica.
- **Solo tiene Activas y Estacionadas, sin casilla "sin señal"** (25/09/2026): las unidades sin señal cuentan según su último estado conocido, así Activas + Estacionadas = Total. El reporte de la app sí las separa en "Sin señal".
- **Nunca se guarda ni se comitea** — se genera con un script de un solo uso, se envía, y se borra.
- Se pide con frases como "dame el reporte como el modelo interno".

**IMPORTANTE — no recrear el script de memoria.** Las plantillas EXACTAS
(byte a byte, ya probadas y aprobadas por el usuario) están versionadas en
el propio repo, en `scripts/modelo_interno/`:
- `scripts/modelo_interno/fetch_reporte.template.mjs`
- `scripts/modelo_interno/build_modelo_interno.template.mjs`

Reconstruirlo "a ojo" a partir de una descripción (colores, layout, etc.)
produce un Excel parecido pero no idéntico — ya pasó una vez y el usuario
lo notó. Usar siempre estas plantillas tal cual.

**Cómo generarlo** (turno = MATUTINO | VESPERTINO | NOCTURNO, según la hora del pedido; `enVivo: true` siempre para datos frescos):

1. Copiar `scripts/modelo_interno/fetch_reporte.template.mjs` a `backend/_fetch_reporte.mjs`, reemplazando `__TURNO__` por el turno que corresponda.
2. Copiar `scripts/modelo_interno/build_modelo_interno.template.mjs` a `backend/_build_modelo_interno.mjs` **sin modificar nada**.
3. Ejecutar ambos desde `backend/`: `node _fetch_reporte.mjs && node _build_modelo_interno.mjs` — el `.xlsx` sale en el mismo directorio (`Reporte_Tracker_<TURNO>_<DDMMYYYY>_formato_interno_<hhmmss>.xlsx`); si se quiere en el scratchpad de la sesión, mover el archivo después en vez de tocar la plantilla.
4. Enviar el `.xlsx` resultante al usuario (adjunto en el chat).
5. Borrar los dos scripts temporales y el `_reporte_data.json` — nunca deben quedar commiteados.

## Alertas y Telegram — cómo responder a pedidos frecuentes

- **"¿Hay alertas activas?"**: consultar `Alerta.getRecentAlerts()` (`backend/src/bo/sub_system/classes/alerta.js`) y filtrar `!x.resolved_at`. Responder con unidad, tipo y hora. Las entradas/salidas de geocerca son eventos puntuales y se guardan ya resueltas — nunca aparecen como "activas"; si preguntan por ellas, filtrar por `alert_type` `entrada_geocerca`/`salida_geocerca` del día.
- **"Mándamelas por Telegram" / "como siempre"**: reenviar el `message` completo de cada alerta activa **tal cual, uno por mensaje separado** (nunca combinados en un solo mensaje resumido) usando `TelegramClient.sendMessage(a.message)` (`backend/src/tracker/telegramClient.js`). No inventar un resumen propio — el campo `message` ya trae el texto exacto que se manda normalmente, incluida la sección de Recorrido.
- El bot de Telegram tiene actualmente 2 suscriptores registrados (cuentas propias del usuario) — enviar mensajes de prueba no llega a terceros.
- **Suscriptores con aprobación (24/09/2026):** quien le escribe al bot queda **PENDIENTE** y no recibe nada; al registrarse se le avisa a él y a los activos (una sola vez). Se aprueba o se le quita el acceso en **Notificaciones → pestaña "Suscriptores de Telegram"** (`Suscriptor.listar/aprobar/quitarAcceso`, transacciones 164-166, `tracker_telegram_subscriber.status` PENDIENTE/ACTIVO/BLOQUEADO, migración 042; `is_active` sigue siendo lo que lee `TelegramClient`). Un BLOQUEADO que vuelve a escribir no se reactiva solo. Ojo: los chat_id de `TELEGRAM_CHAT_ID` en `backend/.env` reciben siempre y no se pueden quitar desde la app.
- **Números de transacción (24/09/2026, al traer la rama Julio):** el frontend llama a cada función por número (`TX` en `frontend/src/services/*Service.js`) y ese número es `transaction.id`. **El id de `backend/config/permission.csv` es la única fuente de verdad**: al arrancar, `Security.alignTransactionIds` mueve cada transacción de la base a su id del CSV. Para agregar una función nueva: **siempre al final del CSV con el número siguiente** (nunca insertar en medio ni renumerar), y usar ese mismo número en el `TX` del frontend.
- La base de datos de esta laptop se restauró desde la vieja: si al arrancar el backend falla `insertPermission` con "duplicate key ... transaction_pkey", es una secuencia atrasada — resincronizar con `setval(seq, MAX(id))` (el 24/09 ya se revisaron las 32 y quedaron al día).

## Diapositivas (`informes/Tracker_GPS_de_Flota.pptx` + `.pdf`)
Deck de 6 diapositivas (Portada, Índice interactivo con hipervínculos a cada sección, Estado+Gestión, Mapa+Recorridos, Notificaciones con Alertas+Telegram+Reporte enviado+limpieza automática, Reportes+Cierre). Construido con `pptxgenjs` (no hay LibreOffice en esta máquina — usar PowerPoint vía COM/PowerShell para exportar a imágenes/PDF para QA visual: `New-Object -ComObject PowerPoint.Application`). Paleta: navy `0E2438`/`15324D`, dorado `D99B0A`, fuente títulos Cambria, cuerpo Calibri. Reutiliza capturas reales de pantalla para las vistas sin cambios; los paneles nuevos (Recorridos, mensaje de Telegram, Reporte enviado) se construyen como formas nativas de PowerPoint, no capturas.

## Otras cosas que ya se pidieron y quedaron así (no cambiar sin confirmar)
- El reporte del modelo interno **nunca** ordena por categoría de ubicación — eso es exclusivo del reporte de la app.
- El mapa va antes que el selector de Recorridos en Mapa en Vivo.
- Recorridos se abre de las dos formas (clic en mapa Y selector aparte), no solo una.
- En Alertas, el panel de Recorridos se despliega inline bajo la fila, no en un panel compartido al final.
- Las alertas de "fuera de horario" de la flota PESADA no se notifican por Telegram; las de entrada/salida de geocerca sí, para toda la flota.
- De día solo entradas/salidas de geocerca; de noche solo fuera de horario a las 8:00, 8:30 y 9:00pm (22/09/2026).
