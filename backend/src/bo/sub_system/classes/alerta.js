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

    for (const s of snapshots) {
      if (s.is_stale) continue; // no alertar con datos viejos (trackers desconectados)

      const key = { unit_id: s.unit_id ?? null, plate: s.unit_id ? null : s.plate ?? null };

      await this.checkRule({
        ...key,
        alertType: 'fuera_de_horario',
        isViolation: isCurfew && s.status === 'ACTIVO',
        buildMessage: () => {
          const mapsLink =
            s.latitude != null && s.longitude != null ? `\nVer en mapa: https://www.google.com/maps?q=${s.latitude},${s.longitude}` : '';
          return (
            `⚠ ALERTA - Fuera de horario\n` +
            `Unidad: ${s.unit_code || 'sin registrar'} / Placa: ${s.plate || '(sin placa)'} / Conductor: ${s.driver_name || 'sin registrar'}\n` +
            `Hora: ${new Date(s.last_report_at || Date.now()).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}\n` +
            `Ubicación: ${s.location_text || 'desconocida'}${mapsLink}\n` +
            `Motivo: Unidad circulando después de las ${CURFEW_HOUR}:00`
          );
        },
        snapshotId: s.id,
      });
    }
  };

  checkRule = async ({ unit_id, plate, alertType, isViolation, buildMessage, snapshotId }) => {
    const openResult = await this.dbms.executeNamedQuery({
      nameQuery: 'getOpenTrackerAlert',
      params: { unit_id, plate, alert_type: alertType },
    });
    const openAlert = openResult?.rows?.[0] || null;

    if (isViolation && !openAlert) {
      const message = buildMessage();
      const notifyResult = await this.telegram.sendMessage(message);
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
