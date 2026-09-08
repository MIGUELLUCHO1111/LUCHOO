import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import Reporte from './reporte.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_ROOT = path.resolve(__dirname, '../../../../uploads/tracker/reports');
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const formatHora = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('es-VE', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Genera y guarda en disco el mismo Excel que "Exportar a Excel" arma en el
 * navegador, pero del lado del servidor y por cada cierre de turno -- así
 * queda un archivo por fecha+turno (tracker_report_file) listo para
 * descargar en un clic desde el historial, y disponible para adjuntarlo a
 * la notificación de Telegram, sin que nadie tenga que entrar a la app y
 * generarlo a mano.
 */
class ReporteArchivo {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.reporte = new Reporte();
  }

  buildBuffer(r) {
    const headers = ['Unidad', 'Placa', 'Conductor', 'Ubicación', 'Categoría', 'Hora', 'Estado'];
    const rows = r.unidades.map((u) => [
      u.unit_code || 'sin registrar',
      u.plate || '-',
      u.driver_name || '-',
      u.location_text || '-',
      u.location_category || '-',
      formatHora(u.last_report_at),
      u.status,
    ]);
    rows.push(['', '', '', '', '', 'Total:', `${r.total} (${r.activas} activas / ${r.estacionadas} estacionadas)`]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 6) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, r.turno);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  generarYGuardar = async ({ fecha, turno } = {}) => {
    await this.dbmsReady;

    const resultado = await this.reporte.generarReporte({ fecha, turno });
    const r = resultado.data;
    const buffer = this.buildBuffer(r);

    const dir = path.join(REPORTS_ROOT, r.fecha);
    await fs.mkdir(dir, { recursive: true });
    const filename = `Reporte_Tracker_${r.turno}_${r.fecha}.xlsx`;
    await fs.writeFile(path.join(dir, filename), buffer);
    const url = `/tracker/reports/file/${r.fecha}/${filename}`;

    const insertResult = await this.dbms.executeNamedQuery({
      nameQuery: 'upsertTrackerReportFile',
      params: {
        fecha: r.fecha,
        turno: r.turno,
        filename,
        url,
        mime_type: XLSX_MIME,
        size_bytes: buffer.length,
        total: r.total,
        activas: r.activas,
        estacionadas: r.estacionadas,
        telegram_sent: false,
      },
    });

    return { archivo: insertResult?.rows?.[0], reporte: r, buffer };
  };

  // Historial para la vista "Reportes generados": expuesto por el
  // dispatcher para poder listarlo desde la app.
  listar = async ({ limit } = {}) => {
    await this.dbmsReady;
    const resolvedLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 60;
    const result = await this.dbms.executeNamedQuery({ nameQuery: 'getTrackerReportFiles', params: { limit: resolvedLimit } });
    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };
}

export default ReporteArchivo;
export { REPORTS_ROOT };
