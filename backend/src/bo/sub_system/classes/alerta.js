import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import TelegramClient from '../../../tracker/telegramClient.js';
import Recorrido from './recorrido.js';
import ForesightClient from '../../../tracker/foresightClient.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Hora (24h, hora de Venezuela) a partir de la cual una unidad en movimiento
// dispara la alerta de "fuera de horario". Configurable sin tocar código.
const CURFEW_HOUR = Number(process.env.TRACKER_CURFEW_HOUR || 20);

// Retención del historial de alertas (pedido de Lguerra, 18/09/2026): son
// datos "solo de revisión", no algo que haya que conservar para siempre --
// dejarlas crecer sin límite es lo que puede terminar colapsando el sistema.
const ALERT_RETENTION_DAYS = Number(process.env.TRACKER_ALERT_RETENTION_DAYS || 8);

const veHour = (date = new Date()) => {
  const hourStr = date.toLocaleString('en-US', { timeZone: 'America/Caracas', hour: '2-digit', hour12: false });
  return parseInt(hourStr, 10) % 24;
};

// Entradas/salidas de geocerca (pedido de Lguerra, 22/09/2026): reemplazan a
// la antigua alerta propia de "fuera de geocerca" (perimetro global). Ahora
// se toman tal cual las detecta GEvolution -- cada geocerca con su regla de
// "Entrada y salida" configurada alla, y su nivel: si en GEvolution esta
// marcada como critica llega como ALARMA, si no como ATENCION. Solo de dia
// (antes de CURFEW_HOUR): de noche lo unico que se notifica es "fuera de
// horario".
const GEOFENCE_EVENT_TYPE = '2';
const GEOFENCE_DAY_START_HOUR = Number(process.env.TRACKER_GEOFENCE_DAY_START_HOUR || 6);
// Al arrancar el backend (o si se cayo un rato), GEvolution todavia devuelve
// la ultima hora de eventos: los mas viejos que esto se guardan en el
// historial pero no se mandan a Telegram, para no llegar tarde y en rafaga.
const GEOFENCE_MAX_DELAY_MIN = Number(process.env.TRACKER_GEOFENCE_MAX_DELAY_MIN || 30);

const veDateISO = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

// "Entrada y salida Puente Gral Rafael Urdaneta" -> "Puente Gral Rafael Urdaneta"
const geofenceNameOf = (eventName) => String(eventName || '').replace(/^\s*entrada\s*(y|\/)\s*salida\s*(de\s*)?/i, '').trim() || eventName;

// Regla de la propuesta (Fase 2): fuera del horario de circulación
// permitido, la unidad debería estar ESTACIONADO; si aparece ACTIVO
// (encendida/circulando), esa es la alerta.
class Alerta {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.telegram = new TelegramClient();
    this.recorrido = new Recorrido();
    this.foresight = new ForesightClient();
  }

  // Se llama automáticamente después de cada sincronización (manual o por
  // cron). No se expone como transacción del dispatcher.
  evaluateSnapshots = async (snapshots) => {
    await this.dbmsReady;
    const isCurfew = veHour() >= CURFEW_HOUR;

    for (const s of snapshots) {
      if (s.is_stale) continue; // no alertar con datos viejos (trackers desconectados)

      const key = { unit_id: s.unit_id ?? null, plate: s.unit_id ? null : s.plate ?? null };

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
        gpsUnitId: s.gps_unit_id,
      });
    }
  };

  // Resumen del recorrido del dia (hasta este momento) de la unidad que
  // disparo la alerta, pedido de Lguerra 18/09/2026: "que tambien muestre el
  // recorrido fuera de geocerca y fuera de horario segun aplique" -- se
  // adjunta al mensaje de Telegram (y por lo tanto tambien queda guardado en
  // el historial, es el mismo texto). No se puede anclar "a partir de la
  // alerta" como en la app -- a esta hora, justo cuando se dispara, todavia
  // no paso nada despues -- asi que se usa el dia completo hasta ahora, da
  // contexto de que estuvo haciendo la unidad antes de esta alerta.
  buildRecorridoSection = async (gpsUnitId) => {
    if (gpsUnitId == null) return '';
    try {
      const res = await this.recorrido.listar({ gps_unit_id: gpsUnitId });
      const d = res?.data;
      if (!d) return '';
      if (!d.total_recorridos) {
        return '\n\n🛣️ Recorrido de hoy: sin viajes registrados hasta el momento.';
      }
      const soloHora = (iso) => (iso ? iso.slice(11, 16) : '-');
      const horasTexto = (h) => (h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`);
      return (
        `\n\n🛣️ Recorrido de hoy (hasta ahora):\n` +
        `Viajes: ${d.total_recorridos}\n` +
        `Km recorridos: ${d.km_totales} km\n` +
        `Primera salida: ${soloHora(d.primera_salida)} · Última llegada: ${soloHora(d.ultima_llegada)}\n` +
        `En movimiento: ${horasTexto(d.horas_en_movimiento)} · Estacionado: ${horasTexto(d.horas_estacionado)}`
      );
    } catch (error) {
      console.error('[Tracker] Error obteniendo recorrido para la alerta:', error.message);
      return '';
    }
  };

  checkRule = async ({ unit_id, plate, alertType, isViolation, shouldNotify = true, buildMessage, snapshotId, gpsUnitId }) => {
    const openResult = await this.dbms.executeNamedQuery({
      nameQuery: 'getOpenTrackerAlert',
      params: { unit_id, plate, alert_type: alertType },
    });
    const openAlert = openResult?.rows?.[0] || null;

    if (isViolation && !openAlert) {
      const message = buildMessage() + (await this.buildRecorridoSection(gpsUnitId));
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

  // Entradas/salidas de geocerca detectadas por GEvolution (ver comentario de
  // GEOFENCE_EVENT_TYPE). La llama el cron TRACKER_GEOFENCE_EVENTS_CRON: la
  // API solo devuelve ~la ultima hora, asi que hay que revisarla seguido --
  // pero cada evento se notifica UNA sola vez (external_event_id), y solo los
  // que pasaron de dia. Los de noche se ignoran (ni se guardan).
  procesarEventosGeocerca = async () => {
    await this.dbmsReady;
    const eventos = await this.foresight.getEventosGenerados({ fecha: veDateISO() });
    const deGeocerca = eventos
      .filter((e) => e.eventType === GEOFENCE_EVENT_TYPE && e.startTime && !Number.isNaN(e.startTime.getTime()))
      .filter((e) => {
        const h = veHour(e.startTime);
        return h >= GEOFENCE_DAY_START_HOUR && h < CURFEW_HOUR;
      })
      .sort((a, b) => a.startTime - b.startTime);
    if (deGeocerca.length === 0) return { nuevos: 0, notificados: 0 };

    // Unidad registrada (codigo, placa, flota) por id del GPS, desde la
    // ultima lectura guardada -- misma fuente que el resto de alertas.
    const latest = await this.dbms.executeNamedQuery({ nameQuery: 'getLatestSnapshots' });
    const porGps = new Map((latest?.rows || []).map((s) => [String(s.gps_unit_id), s]));

    let nuevos = 0;
    let notificados = 0;
    for (const e of deGeocerca) {
      const existe = await this.dbms.executeNamedQuery({
        nameQuery: 'existsTrackerAlertExternalEvent',
        params: { external_event_id: e.id },
      });
      if (existe?.rows?.length) continue;

      const s = porGps.get(e.gpsUnitId) || {};
      const alertType = e.inZone ? 'entrada_geocerca' : 'salida_geocerca';
      const mensaje = this.buildGeofenceEventMessage(e, s) + (await this.buildRecorridoSection(e.gpsUnitId));
      const tarde = Date.now() - e.startTime.getTime() > GEOFENCE_MAX_DELAY_MIN * 60 * 1000;
      const notifyResult = tarde
        ? { sent: false, reason: `Evento de hace mas de ${GEOFENCE_MAX_DELAY_MIN} min al revisarlo -- solo se guarda en el historial` }
        : await this.telegram.sendMessage(mensaje);

      await this.dbms.executeNamedQuery({
        nameQuery: 'createTrackerGeofenceEventAlert',
        params: {
          unit_id: s.unit_id ?? null,
          plate: s.unit_id ? null : s.plate ?? null,
          alert_type: alertType,
          message: mensaje,
          snapshot_id: s.id ?? null,
          notified: notifyResult.sent,
          notify_error: notifyResult.sent ? null : notifyResult.reason || 'error desconocido',
          triggered_at: e.startTime.toISOString(),
          external_event_id: e.id,
        },
      });
      nuevos += 1;
      if (notifyResult.sent) notificados += 1;
    }
    return { nuevos, notificados };
  };

  // Mismo formato que las demas alertas (y mismo texto en Telegram y en el
  // historial). Fecha/hora = las del evento en GEvolution, no las de la
  // revision -- entre una revision y otra pueden pasar varios minutos.
  buildGeofenceEventMessage = (e, s) => {
    const fecha = e.startTime.toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
    const hora = e.startTime.toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const nivel = e.critical ? '🚨 ALARMA' : '⚠️ ATENCIÓN';
    const accion = e.inZone ? '🟢 Unidad entrando a geocerca' : '🔴 Unidad saliendo de geocerca';
    const mapa = e.lat != null && e.lng != null ? `https://www.google.com/maps?q=${e.lat},${e.lng}` : 'no disponible';
    return (
      `${nivel} - ${accion}\n` +
      `Geocerca: ${geofenceNameOf(e.name)}\n` +
      `Unidad: ${s.unit_code || e.unitName || 'sin registrar'}\n` +
      `Tipo de flota: ${s.fleet_type || 'LIVIANA'}\n` +
      `Placa: ${s.plate || '(sin placa)'}\n` +
      `Fecha: ${fecha}\n` +
      `Hora: ${hora}\n` +
      `Ubicación: ${e.location || 'desconocida'}\n` +
      (e.speed != null ? `Velocidad: ${e.speed} km/h\n` : '') +
      `Mapa: ${mapa}`
    );
  };

  getRecentAlerts = async () => {
    await this.dbmsReady;
    const result = await this.dbms.executeNamedQuery({ nameQuery: 'getRecentTrackerAlerts' });
    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  // Borra el historial de alertas mas viejo que ALERT_RETENTION_DAYS
  // (8 dias por defecto). Corre solo (ver scheduler.js) todos los dias --
  // asi ninguna alerta llega a acumular mas de esos dias, sin depender de
  // que alguien entre a la pantalla de Reportes a limpiarla a mano.
  limpiarAntiguas = async () => {
    await this.dbmsReady;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ALERT_RETENTION_DAYS);
    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'deleteOldTrackerAlerts',
      params: { cutoff: cutoff.toISOString() },
    });
    return {
      statusCode: STATUS_CODES.OK,
      data: { eliminadas: result?.rowCount ?? 0, limite_retencion: cutoff.toISOString() },
      message: `${result?.rowCount ?? 0} alerta(s) mayores a ${ALERT_RETENTION_DAYS} dia(s) eliminadas`,
    };
  };
}

export default Alerta;
