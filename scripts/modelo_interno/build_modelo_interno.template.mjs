// PLANTILLA -- copiar tal cual a backend/_build_modelo_interno.mjs, sin
// modificar nada (lee ./_reporte_data.json, que deja fetch_reporte.template
// ya ejecutado). Ver CLAUDE.md -> "El reporte modelo interno".
//
// Regla de negocio confirmada varias veces por el usuario: este reporte
// NUNCA se reordena por categoría de ubicacion (BASE/CAMPO/OFICINA/OTRAS)
// -- se listan las unidades en el orden natural que devuelve la consulta.
// Ese ordenamiento por categoria es EXCLUSIVO del reporte de la app
// (reporteArchivo.js / reportHtml.js), no de este.
import ExcelJS from 'exceljs';
import fs from 'fs';

const r = JSON.parse(fs.readFileSync('./_reporte_data.json', 'utf8'));

const NAVY = 'FF1F3864';
const NAVY_BAND = 'FF2E5395';
const NAVY_TEXT = 'FFD6E4F0';
const GREEN = 'FF38761D';
const RED = 'FFC0392B';
const WHITE = 'FFFFFFFF';

const CATEGORY_FONT = { BASE: 'FF1F3864', CAMPO: 'FF7F5B00', OFICINA: 'FF0B5345', OTRAS: 'FF5B2A6E' };
const CATEGORY_BORDER = { BASE: 'FF2E75B6', CAMPO: 'FFC9971A', OFICINA: 'FF16A085', OTRAS: 'FF8E44AD' };
const ESTADO_FONT = { ACTIVO: 'FF274E13', ESTACIONADO: 'FF7C1E17' };
const ESTADO_BORDER = { ACTIVO: 'FF38761D', ESTACIONADO: 'FFC0392B' };

const formatHora = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: true });
};
const formatFecha = (fecha) => {
  const [y, m, d] = String(fecha).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet(`Tracker ${r.turno}`, { properties: { defaultRowHeight: 15 } });

ws.columns = [{ width: 16 }, { width: 14 }, { width: 20 }, { width: 42 }, { width: 14 }, { width: 14 }];

const fillCell = (cell, { fill, fontColor, bold = false, size = 10, align } = {}) => {
  if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  cell.font = { bold, size, color: { argb: fontColor || 'FF000000' } };
  if (align) cell.alignment = align;
};

ws.mergeCells('A1:F1');
ws.getRow(1).height = 26;
fillCell(ws.getCell('A1'), { fill: NAVY, fontColor: WHITE, bold: true, size: 18, align: { vertical: 'middle' } });
ws.getCell('A1').value = `🚚  TRACKER DE FLOTA — REPORTE ${r.turno}`;

ws.mergeCells('A2:F2');
const ahora = new Date();
ws.getCell('A2').value = `FECHA: ${formatFecha(r.fecha)}     •     CORTE: TURNO ${r.turno}     •     ÚLTIMA ACTUALIZACIÓN: ${formatHora(ahora.toISOString())}`;
fillCell(ws.getCell('A2'), { fill: NAVY_BAND, fontColor: NAVY_TEXT, size: 10, align: { vertical: 'middle' } });

ws.mergeCells('A4:B4'); ws.mergeCells('C4:D4'); ws.mergeCells('E4:F4');
ws.mergeCells('A5:B5'); ws.mergeCells('C5:D5'); ws.mergeCells('E5:F5');
ws.getRow(5).height = 24;
const kpis = [
  { addr: 'A4', val: 'A5', label: 'TOTAL DE UNIDADES', value: r.total, fill: NAVY },
  { addr: 'C4', val: 'C5', label: 'UNIDADES ACTIVAS', value: r.activas, fill: GREEN },
  { addr: 'E4', val: 'E5', label: 'UNIDADES ESTACIONADAS', value: r.estacionadas, fill: RED },
];
for (const k of kpis) {
  fillCell(ws.getCell(k.addr), { fill: k.fill, fontColor: WHITE, bold: true, size: 9, align: { vertical: 'middle' } });
  ws.getCell(k.addr).value = k.label;
  fillCell(ws.getCell(k.val), { fill: k.fill, fontColor: WHITE, bold: true, size: 20, align: { vertical: 'middle' } });
  ws.getCell(k.val).value = k.value;
}

ws.mergeCells('A7:C7'); ws.mergeCells('D7:F7');
ws.getRow(7).height = 18;
fillCell(ws.getCell('A7'), { fill: NAVY, fontColor: WHITE, bold: true, size: 9, align: { horizontal: 'center', vertical: 'middle' } });
ws.getCell('A7').value = '📍  LEYENDA DE COLORES: UBICACIÓN';
fillCell(ws.getCell('D7'), { fill: NAVY, fontColor: WHITE, bold: true, size: 9, align: { horizontal: 'center', vertical: 'middle' } });
ws.getCell('D7').value = '⚡  LEYENDA DE COLORES: ESTADO';

ws.mergeCells('A8:B8'); ws.mergeCells('A9:B9');
ws.mergeCells('D8:E9'); ws.mergeCells('F8:F9');
ws.getRow(8).height = 16;
ws.getRow(9).height = 16;

const legendCell = (addr, text, color) => {
  fillCell(ws.getCell(addr), { fontColor: color, bold: true, size: 8, align: { horizontal: 'center', vertical: 'middle' } });
  ws.getCell(addr).value = text;
};
legendCell('A8', 'OFICINAS Y TALLER LOCAL', CATEGORY_FONT.OFICINA);
legendCell('A9', 'BASE CAMPO BOSCÁN', CATEGORY_FONT.BASE);
legendCell('C8', 'CAMPO BOSCÁN', CATEGORY_FONT.CAMPO);
legendCell('C9', 'OTRAS DIRECCIONES', CATEGORY_FONT.OTRAS);
legendCell('D8', 'ESTACIONADO', ESTADO_FONT.ESTACIONADO);
legendCell('F8', 'ACTIVO', ESTADO_FONT.ACTIVO);

const headers = ['🚚 UNIDAD', '🔖 PLACA', '👤 CONDUCTOR', '📍 UBICACIÓN', '🕒 HORA', '⚡ ESTADO'];
headers.forEach((h, i) => {
  const cell = ws.getRow(11).getCell(i + 1);
  cell.value = h;
  fillCell(cell, { fill: NAVY, fontColor: WHITE, bold: true, size: 11 });
});
ws.autoFilter = 'A11:F11';

let rowIdx = 12;
for (const u of r.unidades) {
  const row = ws.getRow(rowIdx);
  row.getCell(1).value = u.unit_code || 'sin registrar';
  row.getCell(2).value = u.plate || '-';
  row.getCell(3).value = u.driver_name || '-';
  row.getCell(4).value = u.location_text || '-';
  row.getCell(5).value = formatHora(u.fetched_at);
  row.getCell(6).value = u.status || '-';

  [1, 2, 3, 5].forEach((c) => {
    row.getCell(c).font = { size: 10, color: { argb: 'FF344054' } };
  });

  const catColor = CATEGORY_FONT[u.location_category] || CATEGORY_FONT.OTRAS;
  const catBorder = CATEGORY_BORDER[u.location_category] || CATEGORY_BORDER.OTRAS;
  row.getCell(4).font = { bold: true, size: 10, color: { argb: catColor } };
  row.getCell(4).border = { left: { style: 'thick', color: { argb: catBorder } } };

  const estFont = ESTADO_FONT[u.status] || 'FF344054';
  const estBorder = ESTADO_BORDER[u.status];
  row.getCell(6).font = { bold: true, size: 10, color: { argb: estFont } };
  if (estBorder) row.getCell(6).border = { right: { style: 'thick', color: { argb: estBorder } } };

  rowIdx += 1;
}

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const hhmmss = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const outPath = `./Reporte_Tracker_${r.turno}_${formatFecha(r.fecha).replace(/\//g, '')}_formato_interno_${hhmmss}.xlsx`;

await wb.xlsx.writeFile(outPath);
console.log('WRITTEN:', outPath);
