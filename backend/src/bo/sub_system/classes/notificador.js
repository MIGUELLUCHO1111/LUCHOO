import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import TelegramClient from '../../../tracker/telegramClient.js';
import Reporte from './reporte.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

const veDateISO = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

// Cierra el círculo de "todo pasivo": hasta ahora había que entrar a la app a
// ver el reporte y acordarse de subir el PDF de seguridad. Este avisa solo.
class Notificador {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.telegram = new TelegramClient();
    this.reporte = new Reporte();
  }

  // Se llama al cierre de cada ventana de turno (10:05am, 3:05pm, 10:05pm
  // hora Venezuela, ver scheduler.js). También expuesta por el dispatcher
  // para poder probarla a mano sin esperar al horario real.
  notificarCierreDeTurno = async ({ turno, fecha } = {}) => {
    await this.dbmsReady;

    const resolvedFecha = fecha || veDateISO();
    const resultado = await this.reporte.generarReporte({ fecha: resolvedFecha, turno });
    const r = resultado.data;

    const mensaje =
      `📋 Reporte ${r.turno} listo (${r.fecha})\n` +
      `Total: ${r.total} · Activas: ${r.activas} · Estacionadas: ${r.estacionadas}\n` +
      `Corte: ${r.turno_label}\n` +
      `Ábrelo en la app para el detalle completo.`;

    const notifyResult = await this.telegram.sendMessage(mensaje);

    return {
      statusCode: STATUS_CODES.OK,
      data: { ...notifyResult, mensaje },
      message: notifyResult.sent ? 'Notificación de cierre de turno enviada' : 'No se pudo enviar la notificación',
    };
  };

  // Se llama una vez al final del día (10:15pm hora Venezuela) y también
  // queda expuesta para probarla a mano.
  verificarAnexoSeguridad = async ({ fecha } = {}) => {
    await this.dbmsReady;

    const resolvedFecha = fecha || veDateISO();
    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'getTrackerAttachmentsByFecha',
      params: { fecha: resolvedFecha },
    });
    const yaSubido = (result?.rows || []).some((a) => a.tipo === 'seguridad');

    if (yaSubido) {
      return { statusCode: STATUS_CODES.OK, data: { yaSubido: true }, message: 'El PDF de seguridad ya estaba subido, no se envió recordatorio' };
    }

    const mensaje =
      `⚠ Recordatorio — Dashboard de Seguridad\n` +
      `Todavía no se ha subido el PDF del Dashboard de Seguridad de hoy (${resolvedFecha}).\n` +
      `Súbelo en Reporte de Turno → Nocturno → Anexos del día.`;

    const notifyResult = await this.telegram.sendMessage(mensaje);

    return {
      statusCode: STATUS_CODES.OK,
      data: { yaSubido: false, ...notifyResult, mensaje },
      message: notifyResult.sent ? 'Recordatorio de anexo enviado' : 'No se pudo enviar el recordatorio',
    };
  };
}

export default Notificador;
