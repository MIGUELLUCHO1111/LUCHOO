# Fullpetro API — notas para Claude Code

## Arrancar a trabajar
Antes de tocar el backend, siempre:
```bash
pm2 resurrect
pm2 list   # confirmar fullpetro-backend y fullpetro-frontend "online"
```
Después de cualquier cambio en código del backend: `pm2 restart fullpetro-backend`.

Zona horaria del negocio: `America/Caracas` (UTC-4 fijo, sin horario de verano).
Turnos: MATUTINO 9am, VESPERTINO 2pm, NOCTURNO 9pm.

## Los dos reportes de Tracker GPS — NO son lo mismo

Hay **dos formatos de reporte completamente distintos** para la misma flota. Cuando Lguerra pide "el reporte", hay que distinguir cuál:

### 1. Reporte de la app ("Reportes de Turno")
- Es el que genera y guarda la propia aplicación (`ReporteArchivo.generarYGuardar`), visible en la pantalla Reportes de Turno.
- Se genera solo al cerrar cada turno, o a mano con "Generar ahora".
- Ordena las unidades **por categoría de ubicación** (Base, Campo, Oficina, Otras).
- Queda guardado permanentemente (Excel, PDF e imagen) y es lo que se manda automáticamente por Telegram al cerrar turno.

### 2. Reporte "modelo interno"
- Es un formato Excel aparte que replica el diseño que ya usaban a mano antes de la app (mismo layout con las mismas leyendas de color).
- **Mantiene el orden natural de las unidades — nunca se ordena por categoría de ubicación** (eso es solo para el reporte de la app). Este punto se pidió explícitamente y se corrigió una vez porque se había ordenado mal.
- **Nunca se guarda ni se comitea** — se genera con un script de un solo uso, se envía, y se borra.
- Se pide con frases como "dame el reporte como el modelo interno" o "el reporte del modelo interno".

**Cómo generarlo** (turno = MATUTINO | VESPERTINO | NOCTURNO, según la hora del pedido; usar `enVivo: true` siempre para datos frescos):

1. Crear `backend/_fetch_reporte.mjs`:
   ```js
   import Reporte from './src/bo/sub_system/classes/reporte.js';
   import fs from 'fs';
   const r = new Reporte();
   const res = await r.generarReporte({ turno: 'MATUTINO', enVivo: true });
   fs.writeFileSync('./_reporte_data.json', JSON.stringify(res.data));
   console.log('OK');
   process.exit(0);
   ```
2. Crear `backend/_build_modelo_interno.mjs` — script ExcelJS que lee `_reporte_data.json` y arma el Excel con el diseño de siempre (encabezado azul marino, KPIs de total/activas/estacionadas, leyenda de colores por categoría de ubicación y por estado, tabla de unidades **sin reordenar**). El archivo de salida va al scratchpad de la sesión, nombrado `Reporte_Tracker_<TURNO>_<DDMMYYYY>_formato_interno_<hhmmss>.xlsx`.
3. Ejecutar ambos: `node _fetch_reporte.mjs && node _build_modelo_interno.mjs`.
4. Enviar el `.xlsx` resultante al usuario (adjunto en el chat).
5. Borrar los dos scripts temporales y el `_reporte_data.json` — nunca deben quedar commiteados.

Si Claude Code no tiene ya este script guardado en la sesión, se puede reconstruir siguiendo esta misma estructura; los detalles exactos de estilo (colores ARGB, leyenda) se pueden ver en el historial de git de sesiones anteriores si hace falta, pero lo esencial es: **mismo diseño que el reporte de la app, pero SIN ordenar por categoría de ubicación, y sin guardar el archivo en ningún lado permanente.**

## Alertas y Telegram

- Las alertas activas se consultan con `Alerta.getRecentAlerts()` (clase en `backend/src/bo/sub_system/classes/alerta.js`) y se filtran por `!x.resolved_at`.
- Cada alerta ya trae su `message` completo — el mismo texto exacto que se mandó (o se hubiera mandado) por Telegram, incluyendo la sección "🛣️ Recorrido de hoy" que se le agregó a cada alerta.
- Cuando Lguerra pide "mándamelas por Telegram" o "como siempre": se reenvía el `message` de cada alerta activa **tal cual, uno por mensaje separado** (nunca combinados en un solo mensaje) usando `TelegramClient.sendMessage(a.message)`.
- El historial de alertas se borra solo después de 8 días (limpieza automática diaria a las 3:30am) — no hace falta limpiarlo a mano.

## Otras cosas que ya se pidieron y quedaron así (no cambiar sin confirmar)

- El reporte del modelo interno **nunca** ordena por categoría de ubicación — eso es exclusivo del reporte de la app.
- `main` no se toca — los cambios van a `feature/gps-tracker` y a `Luis`, y de ahí (si se pide) también al remoto personal del usuario (`personal`).
- Las alertas de "fuera de horario" de la flota PESADA se guardan en el historial pero no se notifican por Telegram (para no saturar); las de "fuera de geocerca" sí se notifican para toda la flota.
