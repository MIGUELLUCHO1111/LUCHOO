import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import TelegramClient from '../../../tracker/telegramClient.js';
import ReporteArchivo from './reporteArchivo.js';

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
    this.reporteArchivo = new ReporteArchivo();
  }

  // Se llama al cierre de cada ventana de turno (9:05am, 2:05pm, 9:05pm
  // hora Venezuela, ver scheduler.js). También expuesta por el dispatcher
  // para poder probarla a mano sin esperar al horario real. Genera y guarda
  // el reporte en sus tres formatos (Excel/PDF/imagen -- queda en el
  // historial, ver ReporteArchivo) y manda solo el PDF adjunto por
  // Telegram, para no saturar el chat con los tres archivos.
  notificarCierreDeTurno = async ({ turno, fecha } = {}) => {
    await this.dbmsReady;

    const resolvedFecha = fecha || veDateISO();
    const { archivo, reporte: r, pdfBuffer } = await this.reporteArchivo.generarYGuardar({ fecha: resolvedFecha, turno });

    const mensaje =
      `📋 Reporte ${r.turno} listo (${r.fecha})\n` +
      `Total: ${r.total} · Activas: ${r.activas} · Estacionadas: ${r.estacionadas} · Sin señal: ${r.sin_senal}\n` +
      `Corte: ${r.turno_label}\n` +
      `El PDF va adjunto -- también queda en Excel e imagen en Reportes de Turno Generados.`;

    const notifyResult = await this.telegram.sendDocument({ buffer: pdfBuffer, filename: archivo?.filename_pdf, caption: mensaje });

    if (notifyResult.sent && archivo?.id) {
      await this.dbms.executeNamedQuery({ nameQuery: 'markTrackerReportFileNotified', params: { id: archivo.id } });
    }

    return {
      statusCode: STATUS_CODES.OK,
      data: { ...notifyResult, mensaje, archivo },
      message: notifyResult.sent ? 'Notificación de cierre de turno enviada (con el reporte adjunto)' : 'No se pudo enviar la notificación',
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
