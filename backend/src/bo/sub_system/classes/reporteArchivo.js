import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import Reporte from './reporte.js';
import { buildReportHtml } from '../../../tracker/reportHtml.js';
import { renderReportOutputs } from '../../../tracker/reportRenderer.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_ROOT = path.resolve(__dirname, '../../../../uploads/tracker/reports');

const formatHora = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('es-VE', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatFechaHora = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const horasSinConexion = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / (1000 * 60 * 60);
};

const formatHoras = (horas) => {
  if (horas == null) return 'sin datos';
  if (horas < 48) return `${horas.toFixed(1)} h`;
  return `${(horas / 24).toFixed(1)} días`;
};

const FILL = {
  total: 'FFFFF7ED',
  activas: 'FFECFDF5',
  estacionadas: 'FFFEF2F2',
  sinSenal: 'FFF1F5F9',
};
const TEXT = {
  total: 'FFEA580C',
  activas: 'FF059669',
  estacionadas: 'FFDC2626',
  sinSenal: 'FF64748B',
};

// Mismo color por categoria que usa el resto de la app (CATEGORY_STYLES) --
// aqui solo en la letra de la Ubicacion, ya que las filas de cada bloque
// van ordenadas por categoria en vez de repartidas en una tabla por cada una.
const CATEGORY_FONT = {
  BASE: 'FF1F3864',
  CAMPO: 'FF7F5B00',
  OFICINA: 'FF0B5345',
  OTRAS: 'FF5B2A6E',
};
const CATEGORY_ORDER = ['BASE', 'CAMPO', 'OFICINA', 'OTRAS'];
const sortByCategory = (units) =>
  units.slice().sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.location_category);
    const bi = CATEGORY_ORDER.indexOf(b.location_category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

/**
 * Genera y guarda en disco el reporte de turno en sus tres formatos de
 * descarga (Excel, PDF, imagen -- mismo diseño moderno acorde a la app,
 * con Total/Activas/Estacionadas siempre visibles arriba) por cada cierre
 * de turno -- así queda un juego de archivos por fecha+turno
 * (tracker_report_file) listo para descargar en un clic desde el
 * historial, y el PDF disponible para adjuntarlo a la notificación de
 * Telegram, sin que nadie tenga que entrar a la app y generarlo a mano.
 */
class ReporteArchivo {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.reporte = new Reporte();
  }

  // Un bloque por estado (Activas / Estacionadas), filas ordenadas por
  // categoria de ubicacion y coloreadas igual que el resto de la app --
  // mismo criterio que buildReportHtml (PDF/imagen), para que las tres
  // salidas del reporte se vean consistentes entre si (pedido de Lguerra,
  // 16/09/2026).
  addStatusSection(ws, { startRow, title, fill, textColor, units }) {
    let rowIdx = startRow;

    ws.mergeCells(`A${rowIdx}:E${rowIdx}`);
    const titleCell = ws.getCell(`A${rowIdx}`);
    titleCell.value = `${title}  (${units.length})`;
    titleCell.font = { bold: true, size: 11, color: { argb: textColor } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    rowIdx += 1;

    const headerRow = ws.getRow(rowIdx);
    headerRow.values = ['Unidad', 'Placa', 'Conductor', 'Ubicación', 'Hora de revisión'];
    headerRow.font = { bold: true, size: 10, color: { argb: 'FF64748B' } };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    });
    rowIdx += 1;

    if (units.length === 0) {
      ws.mergeCells(`A${rowIdx}:E${rowIdx}`);
      const emptyCell = ws.getCell(`A${rowIdx}`);
      emptyCell.value = 'Ninguna unidad en este grupo';
      emptyCell.alignment = { horizontal: 'center' };
      emptyCell.font = { italic: true, color: { argb: 'FF94A3B8' } };
      rowIdx += 1;
    } else {
      sortByCategory(units).forEach((u, i) => {
        const row = ws.getRow(rowIdx);
        row.values = [
          u.unit_code || 'sin registrar',
          u.plate || '-',
          u.driver_name || '-',
          u.location_text || '-',
          formatHora(u.fetched_at),
        ];
        if (i % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          });
        }
        row.getCell(4).font = { bold: true, color: { argb: CATEGORY_FONT[u.location_category] || CATEGORY_FONT.OTRAS } };
        rowIdx += 1;
      });
    }

    return rowIdx + 1; // fila en blanco antes del siguiente bloque
  }

  async buildExcelBuffer(r) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(r.turno.slice(0, 31));

    ws.columns = [{ width: 16 }, { width: 14 }, { width: 20 }, { width: 34 }, { width: 16 }];

    ws.mergeCells('A1:E1');
    ws.getCell('A1').value = `Reporte de Turno — ${r.turno}`;
    ws.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };
    ws.getRow(1).height = 26;

    ws.mergeCells('A2:E2');
    ws.getCell('A2').value = `Fecha: ${r.fecha}   ·   Corte: ${r.turno_label}`;
    ws.getCell('A2').font = { size: 11, color: { argb: 'FF64748B' } };

    const kpis = [
      { col: 'A', label: 'TOTAL UNIDADES', value: r.total, key: 'total' },
      { col: 'B', label: 'ACTIVAS', value: r.activas, key: 'activas' },
      { col: 'C', label: 'ESTACIONADAS', value: r.estacionadas, key: 'estacionadas' },
      { col: 'D', label: 'SIN SEÑAL RECIENTE', value: r.sin_senal, key: 'sinSenal' },
    ];
    for (const k of kpis) {
      const labelCell = ws.getCell(`${k.col}4`);
      labelCell.value = k.label;
      labelCell.font = { bold: true, size: 9, color: { argb: 'FF94A3B8' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[k.key] } };

      const valueCell = ws.getCell(`${k.col}5`);
      valueCell.value = k.value;
      valueCell.font = { bold: true, size: 18, color: { argb: TEXT[k.key] } };
      valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[k.key] } };
    }

    const activeUnits = r.unidades.filter((u) => u.status === 'ACTIVO' && !u.is_stale);
    const parkedUnits = r.unidades.filter((u) => u.status === 'ESTACIONADO' && !u.is_stale);
    const staleUnits = r.unidades
      .filter((u) => u.is_stale)
      .sort((a, b) => new Date(a.last_report_at || 0) - new Date(b.last_report_at || 0));

    let rowIdx = 7;
    rowIdx = this.addStatusSection(ws, {
      startRow: rowIdx, title: 'UNIDADES ACTIVAS', fill: FILL.activas, textColor: TEXT.activas, units: activeUnits,
    });
    rowIdx = this.addStatusSection(ws, {
      startRow: rowIdx, title: 'UNIDADES ESTACIONADAS', fill: FILL.estacionadas, textColor: TEXT.estacionadas, units: parkedUnits,
    });

    if (staleUnits.length > 0) {
      ws.mergeCells(`A${rowIdx}:E${rowIdx}`);
      const staleTitleCell = ws.getCell(`A${rowIdx}`);
      staleTitleCell.value = `⚠ UNIDADES SIN SEÑAL RECIENTE — revisar en sitio  (${staleUnits.length})`;
      staleTitleCell.font = { bold: true, size: 11, color: { argb: 'FFB45309' } };
      staleTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
      rowIdx += 1;

      const staleHeaderRow = ws.getRow(rowIdx);
      staleHeaderRow.values = ['Unidad', 'Placa', 'Última conexión', 'Horas sin conexión'];
      staleHeaderRow.font = { bold: true, size: 10, color: { argb: 'FFB45309' } };
      staleHeaderRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      });
      rowIdx += 1;

      staleUnits.forEach((u, i) => {
        const row = ws.getRow(rowIdx);
        row.values = [
          u.unit_code || 'sin registrar',
          u.plate || '-',
          formatFechaHora(u.last_report_at),
          formatHoras(horasSinConexion(u.last_report_at)),
        ];
        if (i % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9EC' } };
          });
        }
        row.getCell(4).font = { bold: true, color: { argb: 'FFB45309' } };
        rowIdx += 1;
      });
    }

    return wb.xlsx.writeBuffer();
  }

  async generarYGuardar({ fecha, turno, enVivo = false } = {}) {
    await this.dbmsReady;

    const resultado = await this.reporte.generarReporte({ fecha, turno, enVivo });
    const r = resultado.data;

    const [xlsxBuffer, html] = [await this.buildExcelBuffer(r), buildReportHtml(r)];
    const { pdfBuffer, pngBuffer } = await renderReportOutputs(html);

    const dir = path.join(REPORTS_ROOT, r.fecha);
    await fs.mkdir(dir, { recursive: true });

    const baseName = `Reporte_Tracker_${r.turno}_${r.fecha}`;
    const files = {
      xlsx: { buffer: xlsxBuffer, filename: `${baseName}.xlsx` },
      pdf: { buffer: pdfBuffer, filename: `${baseName}.pdf` },
      png: { buffer: pngBuffer, filename: `${baseName}.png` },
    };
    await Promise.all(
      Object.values(files).map((f) => fs.writeFile(path.join(dir, f.filename), f.buffer)),
    );

    const insertResult = await this.dbms.executeNamedQuery({
      nameQuery: 'upsertTrackerReportFile',
      params: {
        fecha: r.fecha,
        turno: r.turno,
        filename_xlsx: files.xlsx.filename,
        url_xlsx: `/tracker/reports/file/${r.fecha}/${files.xlsx.filename}`,
        size_bytes_xlsx: files.xlsx.buffer.length,
        filename_pdf: files.pdf.filename,
        url_pdf: `/tracker/reports/file/${r.fecha}/${files.pdf.filename}`,
        size_bytes_pdf: files.pdf.buffer.length,
        filename_png: files.png.filename,
        url_png: `/tracker/reports/file/${r.fecha}/${files.png.filename}`,
        size_bytes_png: files.png.buffer.length,
        total: r.total,
        activas: r.activas,
        estacionadas: r.estacionadas,
        sin_senal: r.sin_senal,
        telegram_sent: false,
      },
    });

    return { archivo: insertResult?.rows?.[0], reporte: r, pdfBuffer };
  }

  // Historial para la vista "Reportes de Turno Generados": expuesto por el
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
