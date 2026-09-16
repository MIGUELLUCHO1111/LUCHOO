import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import TelegramClient from '../../../tracker/telegramClient.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Hora (24h, hora de Venezuela) a partir de la cual una unidad en movimiento
// dispara la alerta de "fuera de horario". Configurable sin tocar código.
const CURFEW_HOUR = Number(process.env.TRACKER_CURFEW_HOUR || 20);

const veHour = (date = new Date()) => {
  const hourStr = date.toLocaleString('en-US', { timeZone: 'America/Caracas', hour: '2-digit', hour12: false });
  return parseInt(hourStr, 10) % 24;
};

// Ray casting clasico: ¿el punto [lng, lat] cae dentro del poligono? (mismo
// algoritmo que usan Leaflet/Google Maps internamente; suficiente para
// geocercas de este tamaño, no hace falta geometria geodesica).
const pointInPolygon = ([lng, lat], polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const isInsideAnyGeofence = (lng, lat, geofences) => geofences.some((g) => pointInPolygon([lng, lat], g.polygon));

// Regla de la propuesta (Fase 2): fuera del horario de circulación
// permitido, la unidad debería estar ESTACIONADO; si aparece ACTIVO
// (encendida/circulando), esa es la alerta.
class Alerta {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.telegram = new TelegramClient();
  }

  // Se llama automáticamente después de cada sincronización (manual o por
  // cron). No se expone como transacción del dispatcher.
  evaluateSnapshots = async (snapshots) => {
    await this.dbmsReady;
    const isCurfew = veHour() >= CURFEW_HOUR;

    // Perimetro permitido (Fase 3, pedido de Lguerra 16/09/2026): una sola
    // zona permitida global, formada por la union de todas las geocercas
    // sincronizadas desde GEvolution -- no hay una geocerca especifica por
    // unidad. Si todavia no se sincronizo ninguna, se omite la regla en vez
    // de alertar a toda la flota por falta de configuracion.
    const geofenceResult = await this.dbms.executeNamedQuery({ nameQuery: 'getTrackerGeofences' });
    const geofences = (geofenceResult?.rows || []).map((g) => ({
      ...g,
      polygon: typeof g.polygon === 'string' ? JSON.parse(g.polygon) : g.polygon,
    }));

    for (const s of snapshots) {
      if (s.is_stale) continue; // no alertar con datos viejos (trackers desconectados)

      const key = { unit_id: s.unit_id ?? null, plate: s.unit_id ? null : s.plate ?? null };

      // Solo se vigilan las unidades que YA se vieron dentro de alguna
      // geocerca alguna vez (ever_inside) -- unidades sin unit_id (no
      // registradas) no tienen donde guardar ese estado, se omiten. Pedido
      // de Lguerra 16/09/2026: con solo 8 geocercas dibujadas todavia, ~35
      // unidades (oficina, refineria, taller...) nunca han estado dentro de
      // ninguna -- avisar que estan "fuera" desde el primer momento no tiene
      // sentido para ellas. La alerta real es "se alejo de su geocerca", no
      // "nunca ha estado cerca de una conocida". Segun se agreguen mas
      // geocercas en GEvolution, mas unidades entraran solas a este control.
      if (geofences.length > 0 && s.unit_id != null && s.latitude != null && s.longitude != null) {
        const dentro = isInsideAnyGeofence(Number(s.longitude), Number(s.latitude), geofences);

        if (dentro) {
          await this.dbms.executeNamedQuery({ nameQuery: 'markGeofenceEverInside', params: { unit_id: s.unit_id } });
        }
        const stateResult = await this.dbms.executeNamedQuery({ nameQuery: 'getGeofenceState', params: { unit_id: s.unit_id } });
        const everInside = dentro || stateResult?.rows?.[0]?.ever_inside === true;

        await this.checkRule({
          ...key,
          alertType: 'fuera_de_geocerca',
          isViolation: everInside && !dentro,
          // A diferencia de fuera_de_horario, aqui SI se notifica a toda la
          // flota (pedido explicito: "todas aquellas" unidades) -- salir del
          // perimetro operativo es una alerta de seguridad, no algo que la
          // flota pesada suela tener autorizado.
          buildMessage: () => {
            const ahora = new Date();
            const fecha = ahora.toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
            const hora = ahora.toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const mapa = `https://www.google.com/maps?q=${s.latitude},${s.longitude}`;
            return (
              `🚨 ALERTA - Fuera de geocerca\n` +
              `Unidad: ${s.unit_code || 'sin registrar'}\n` +
              `Tipo de flota: ${s.fleet_type || 'LIVIANA'}\n` +
              `Placa: ${s.plate || '(sin placa)'}\n` +
              `Fecha: ${fecha}\n` +
              `Hora: ${hora}\n` +
              `Ubicación: ${s.location_text || 'desconocida'}\n` +
              `Mapa: ${mapa}\n` +
              `Motivo: Unidad fuera del perímetro permitido`
            );
          },
          snapshotId: s.id,
        });
      }

      await this.checkRule({
        ...key,
        alertType: 'fuera_de_horario',
        isViolation: isCurfew && s.status === 'ACTIVO',
        // La flota pesada esta casi siempre en campo, y si aparece activa
        // fuera de horario suele ser autorizado -- por eso se registra la
        // alerta (queda en el historial) pero no se manda a Telegram, para
        // no saturar con ruido lo que si necesita revision inmediata: la
        // flota liviana. Sin clasificar (unidad no registrada o sin
        // fleet_type) se trata como liviana, para no esconder una alerta
        // real por falta de dato.
        shouldNotify: s.fleet_type !== 'PESADA',
        // Un solo momento (el de la deteccion, "ahora") para fecha y hora --
        // antes se mezclaba con la hora del ultimo reporte del GPS
        // (s.last_report_at), que casi nunca coincide con el momento real
        // de la revision y confundia mostrando dos horas distintas.
        buildMessage: () => {
          const ahora = new Date();
          const fecha = ahora.toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
          const hora = ahora.toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const mapa = s.latitude != null && s.longitude != null ? `https://www.google.com/maps?q=${s.latitude},${s.longitude}` : 'no disponible';
          return (
            `⚠ ALERTA - Fuera de horario\n` +
            `Unidad: ${s.unit_code || 'sin registrar'}\n` +
            `Tipo de flota: ${s.fleet_type || 'LIVIANA'}\n` +
            `Placa: ${s.plate || '(sin placa)'}\n` +
            `Fecha: ${fecha}\n` +
            `Hora: ${hora}\n` +
            `Ubicación: ${s.location_text || 'desconocida'}\n` +
            `Mapa: ${mapa}\n` +
            `Motivo: Unidad circulando fuera de horario`
          );
        },
        snapshotId: s.id,
      });
    }
  };

  checkRule = async ({ unit_id, plate, alertType, isViolation, shouldNotify = true, buildMessage, snapshotId }) => {
    const openResult = await this.dbms.executeNamedQuery({
      nameQuery: 'getOpenTrackerAlert',
      params: { unit_id, plate, alert_type: alertType },
    });
    const openAlert = openResult?.rows?.[0] || null;

    if (isViolation && !openAlert) {
      const message = buildMessage();
      // Flota pesada: se guarda igual en el historial, pero no se dispara
      // Telegram (ver evaluateSnapshots) -- por eso no se ejecuta el envio.
      const notifyResult = shouldNotify
        ? await this.telegram.sendMessage(message)
        : { sent: false, reason: 'Flota pesada -- no se notifica por Telegram (posible autorizada)' };
      await this.dbms.executeNamedQuery({
        nameQuery: 'createTrackerAlert',
        params: {
          unit_id,
          plate,
          alert_type: alertType,
          message,
          snapshot_id: snapshotId,
          notified: notifyResult.sent,
          notify_error: notifyResult.sent ? null : notifyResult.reason || 'error desconocido',
        },
      });
    } else if (!isViolation && openAlert) {
      await this.dbms.executeNamedQuery({
        nameQuery: 'resolveOpenTrackerAlerts',
        params: { unit_id, plate, alert_type: alertType },
      });
    }
  };

  getRecentAlerts = async () => {
    await this.dbmsReady;
    const result = await this.dbms.executeNamedQuery({ nameQuery: 'getRecentTrackerAlerts' });
    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };
}

export default Alerta;
