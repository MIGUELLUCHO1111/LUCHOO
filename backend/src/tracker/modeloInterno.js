// Reporte "modelo interno" (ver CLAUDE.md -> "El reporte modelo interno"):
// unica fuente del formato. Lo usan la plantilla del chat
// (scripts/modelo_interno/build_modelo_interno.template.mjs) y la descarga
// de la app (GET /tracker/modelo-interno, Excel y PDF), para que salgan
// identicos.
//
// Regla de negocio confirmada varias veces por el usuario: este reporte
// NUNCA se reordena por categoría de ubicacion (BASE/CAMPO/OFICINA/OTRAS)
// -- se listan las unidades en el orden natural que devuelve la consulta.
// Ese ordenamiento por categoria es EXCLUSIVO del reporte de la app
// (reporteArchivo.js / reportHtml.js), no de este.
//
// Formato (30/09/2026): replica el Excel manual de referencia
// Reporte_Tracker_MATUTINO_21092026.xlsx -- leyenda con colores de relleno
// (tema Office 2007-2010 al 80% de aclarado, ya convertidos a RGB), bordes
// medianos blancos en encabezado/indicadores/leyenda, y la tabla como "Tabla
// de Excel" con estilo TableStyleLight16 (bordes azules finos + filtros).
import ExcelJS from 'exceljs';

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
// Rellenos de la leyenda, iguales al modelo manual.
const LEGEND_FILL = {
  OFICINA: 'FFDBEEF4', CAMPO: 'FFFDEADA', BASE: 'FFC6D9F1', OTRAS: 'FFE6E0EC',
  ESTACIONADO: 'FFF2DCDB', ACTIVO: 'FFEBF1DE',
};

export const formatHora = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: true });
};
export const formatFecha = (fecha) => {
  const [y, m, d] = String(fecha).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

// "Otras direcciones" largas (no caben en la columna) o las que arma el GPS
// con "CERCA DE..." se resumen en calle o avenida, municipio y estado, sin
// escribir las palabras "Municipio" ni "Estado" (pedido de Lguerra,
// 30/09/2026). Las cortas se dejan tal cual. Municipio y estado salen de la
// direccion completa del GPS (location_raw).
const LARGA = 40;
const STREET = /^(calle|avenida|av\.?|avda\.?|carretera|v[ií]a|autopista|prolongaci[oó]n|troncal)\b/i;
const ROUTE = /^[A-Z]{1,2}-\d+$/i; // rutas tipo R-90, T-3
const kmEntre = (a, b) => {
  const rad = (x) => (Number(x) * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};
// Sitio conocido mas cercano (Base, Campo u Oficina donde hay otra unidad), hasta 10 km.
const sitioCercano = (u, todas) => {
  if (u.latitude == null || u.longitude == null) return '';
  let best = null;
  for (const o of todas || []) {
    if (o === u || o.location_category === 'OTRAS' || !o.location_text || o.latitude == null || o.longitude == null) continue;
    const km = kmEntre(u, o);
    if (km <= 10 && (!best || km < best.km)) best = { km, text: o.location_text.split(/ - |,/)[0].trim() };
  }
  if (!best) return '';
  return best.km < 1 ? `CERCA DE ${best.text}` : `A ${Math.round(best.km)} KM DE ${best.text}`;
};

// Sin calle ni avenida (pedido de Lguerra, 01/10/2026): al menos un punto de
// referencia -- carretera o ruta del GPS, un sitio con nombre, el sitio
// conocido mas cercano o, si no, la parroquia. `todas` = unidades del reporte.
export const resumirDireccion = (u, todas) => {
  const texto = String(u.location_text || '');
  if (u.location_category !== 'OTRAS' || !u.location_raw) return texto;
  if (texto.length <= LARGA && !/CERCA DE|^\s*,/i.test(texto)) return texto;
  const partes = String(u.location_raw).split(/[~=]/)[0].split(',').map((p) => p.trim()).filter(Boolean);
  const iMun = partes.findIndex((p) => /^municipio\s+/i.test(p));
  if (iMun < 0) return texto;
  const municipio = partes[iMun].replace(/^municipio\s+/i, '');
  const estado = partes.slice(iMun + 1).find((p) => !/^\d+$/.test(p) && !/^venezuela$/i.test(p)) || '';
  const antes = partes.slice(0, iMun).filter((p) => !/^parroquia\s+/i.test(p));
  const parroquia = (partes.find((p) => /^parroquia\s+/i.test(p)) || '').replace(/^parroquia\s+/i, '');
  const igual = (a, b) => a.toLowerCase() === b.toLowerCase();
  // Calle o avenida: primero la del texto que se muestra, si no la del GPS.
  // (el punto de "AV. 14A" no separa: es abreviatura)
  const delTexto = texto.split(/,| - |(?<!\bAVDA|\bAV)\.\s/i).map((p) => p.trim()).filter(Boolean);
  let calle = delTexto.find((p) => STREET.test(p)) || antes.find((p) => STREET.test(p) || ROUTE.test(p)) || '';
  if (calle && ROUTE.test(calle)) calle = `CARRETERA ${calle}`;
  if (!calle) {
    const sitio = antes.find((p) => !igual(p, municipio) && !igual(p, estado) && !igual(p, parroquia));
    calle = sitio ? `CERCA DE ${sitio}`
      : sitioCercano(u, todas) || (parroquia && !igual(parroquia, municipio) ? `CERCA DE ${parroquia}` : '');
  }
  const piezas = [calle, municipio, estado].filter(Boolean).filter((p, i, arr) => arr.findIndex((x) => x.toLowerCase() === p.toLowerCase()) === i);
  return piezas.length ? piezas.join(', ').toUpperCase() : texto;
};


/** Activas / estacionadas del modelo interno: las sin senal cuentan por su ultimo estado. */
export const contarModeloInterno = (r) => {
  const activas = r.unidades.filter((u) => u.status === 'ACTIVO').length;
  return { total: r.total, activas, estacionadas: r.unidades.length - activas };
};

/** Nombre del archivo, igual al que usa el chat. */
export const modeloInternoFileName = (r, ext = 'xlsx', now = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  const hhmmss = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `Reporte_Tracker_${r.turno}_${formatFecha(r.fecha).replace(/\//g, '')}_formato_interno_${hhmmss}.${ext}`;
};

/** Libro de Excel del modelo interno (r = data de Reporte.generarReporte). */
export function buildModeloInternoWorkbook(r) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Tracker ${r.turno}`, {
    properties: { defaultRowHeight: 15 },
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } },
  });

  ws.columns = [{ width: 16 }, { width: 14 }, { width: 20 }, { width: 42 }, { width: 14 }, { width: 14 }];

  const CENTER = { horizontal: 'center', vertical: 'middle' };
  // Bordes blancos en encabezado, indicadores y leyenda (pedido de Lguerra, 30/09/2026).
  const MED = { style: 'medium', color: { argb: 'FFFFFFFF' } };
  const fillCell = (cell, { fill, fontColor, bold = false, size = 10, align } = {}) => {
    if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.font = { name: 'Calibri', bold, size, color: { argb: fontColor || 'FF000000' } };
    if (align) cell.alignment = align;
  };
  // Borde mediano alrededor de un rango (combinado o no), como en el modelo.
  const boxBorder = (range) => {
    const [a, b] = range.split(':');
    const c0 = ws.getCell(a), c1 = ws.getCell(b || a);
    for (let row = c0.row; row <= c1.row; row++) {
      for (let col = c0.col; col <= c1.col; col++) {
        const cell = ws.getRow(row).getCell(col);
        cell.border = {
          ...(row === c0.row ? { top: MED } : {}), ...(row === c1.row ? { bottom: MED } : {}),
          ...(col === c0.col ? { left: MED } : {}), ...(col === c1.col ? { right: MED } : {}),
        };
      }
    }
  };

  // ---------- Encabezado ----------
  ws.mergeCells('A1:F1');
  ws.getRow(1).height = 26;
  fillCell(ws.getCell('A1'), { fill: NAVY, fontColor: WHITE, bold: true, size: 18, align: CENTER });
  ws.getCell('A1').value = `🚚  TRACKER DE FLOTA — REPORTE ${r.turno}`;
  boxBorder('A1:F1');

  ws.mergeCells('A2:F2');
  const ahora = new Date();
  ws.getCell('A2').value = `FECHA: ${formatFecha(r.fecha)}     •     CORTE: TURNO ${r.turno}     •     ÚLTIMA ACTUALIZACIÓN: ${formatHora(ahora.toISOString())}`;
  fillCell(ws.getCell('A2'), { fill: NAVY_BAND, fontColor: NAVY_TEXT, size: 10, align: CENTER });
  boxBorder('A2:F2');

  // ---------- Indicadores ----------
  ws.mergeCells('A4:B4'); ws.mergeCells('C4:D4'); ws.mergeCells('E4:F4');
  ws.mergeCells('A5:B5'); ws.mergeCells('C5:D5'); ws.mergeCells('E5:F5');
  ws.getRow(5).height = 24;
  // Este formato no tiene casilla "sin señal" (pedido de Lguerra, 25/09/2026):
  // cada unidad cuenta como activa o estacionada segun su ultimo estado
  // conocido -- el mismo que muestra su fila --, para que sumen el total.
  // r.activas/r.estacionadas de la app excluyen las sin senal; aqui no se usan.
  const activas = r.unidades.filter((u) => u.status === 'ACTIVO').length;
  const estacionadas = r.unidades.length - activas;
  const kpis = [
    { addr: 'A4', val: 'A5', label: 'TOTAL DE UNIDADES', value: r.total, fill: NAVY, range: 'A4:B5' },
    { addr: 'C4', val: 'C5', label: 'UNIDADES ACTIVAS', value: activas, fill: GREEN, range: 'C4:D5' },
    { addr: 'E4', val: 'E5', label: 'UNIDADES ESTACIONADAS', value: estacionadas, fill: RED, range: 'E4:F5' },
  ];
  for (const k of kpis) {
    fillCell(ws.getCell(k.addr), { fill: k.fill, fontColor: WHITE, bold: true, size: 9, align: CENTER });
    ws.getCell(k.addr).value = k.label;
    fillCell(ws.getCell(k.val), { fill: k.fill, fontColor: WHITE, bold: true, size: 20, align: CENTER });
    ws.getCell(k.val).value = k.value;
    boxBorder(k.range);
  }

  // ---------- Leyenda ----------
  ws.mergeCells('A7:C7'); ws.mergeCells('D7:F7');
  ws.getRow(7).height = 18;
  fillCell(ws.getCell('A7'), { fill: NAVY, fontColor: WHITE, bold: true, size: 9, align: CENTER });
  ws.getCell('A7').value = '📍  LEYENDA DE COLORES: UBICACIÓN';
  fillCell(ws.getCell('D7'), { fill: NAVY, fontColor: WHITE, bold: true, size: 9, align: CENTER });
  ws.getCell('D7').value = '⚡  LEYENDA DE COLORES: ESTADO';
  boxBorder('A7:C7'); boxBorder('D7:F7');

  ws.mergeCells('A8:B8'); ws.mergeCells('A9:B9');
  ws.mergeCells('D8:D9'); ws.mergeCells('E8:F9');
  ws.getRow(8).height = 16;
  ws.getRow(9).height = 16;

  const legendCell = (addr, range, text, color, fill) => {
    fillCell(ws.getCell(addr), { fill, fontColor: color, bold: true, size: 8, align: CENTER });
    ws.getCell(addr).value = text;
    boxBorder(range);
  };
  legendCell('A8', 'A8:B8', 'OFICINAS Y TALLER LOCAL', CATEGORY_FONT.OFICINA, LEGEND_FILL.OFICINA);
  legendCell('A9', 'A9:B9', 'BASE CAMPO BOSCÁN', CATEGORY_FONT.BASE, LEGEND_FILL.BASE);
  legendCell('C8', 'C8', 'CAMPO BOSCÁN', CATEGORY_FONT.CAMPO, LEGEND_FILL.CAMPO);
  legendCell('C9', 'C9', 'OTRAS DIRECCIONES', CATEGORY_FONT.OTRAS, LEGEND_FILL.OTRAS);
  legendCell('D8', 'D8:D9', 'ESTACIONADO', ESTADO_FONT.ESTACIONADO, LEGEND_FILL.ESTACIONADO);
  legendCell('E8', 'E8:F9', 'ACTIVO', ESTADO_FONT.ACTIVO, LEGEND_FILL.ACTIVO);

  // ---------- Tabla de unidades (Tabla de Excel, estilo Claro 16) ----------
  const headers = ['🚚 UNIDAD', '🔖 PLACA', '👤 CONDUCTOR', '📍 UBICACIÓN', '🕒 HORA', '⚡ ESTADO'];
  const filas = r.unidades.map((u) => [
    u.unit_code || 'sin registrar',
    u.plate || '-',
    u.driver_name || '-',
    resumirDireccion(u, r.unidades) || '-',
    formatHora(u.fetched_at),
    u.status || '-',
  ]);
  ws.addTable({
    name: 'Tabla1',
    ref: 'A11',
    headerRow: true,
    style: { theme: 'TableStyleLight16', showRowStripes: false, showColumnStripes: false, showFirstColumn: false, showLastColumn: false },
    columns: headers.map((name) => ({ name, filterButton: true })),
    rows: filas.length ? filas : [['-', '-', '-', '-', '-', '-']],
  });

  headers.forEach((_, i) => fillCell(ws.getRow(11).getCell(i + 1), { fill: NAVY, fontColor: WHITE, bold: true, size: 11, align: CENTER }));

  r.unidades.forEach((u, i) => {
    const row = ws.getRow(12 + i);
    [1, 2, 3, 5].forEach((c) => {
      row.getCell(c).font = { name: 'Calibri', size: 10, color: { argb: 'FF344054' } };
    });

    const catColor = CATEGORY_FONT[u.location_category] || CATEGORY_FONT.OTRAS;
    const catBorder = CATEGORY_BORDER[u.location_category] || CATEGORY_BORDER.OTRAS;
    row.getCell(4).font = { name: 'Calibri', bold: true, size: 10, color: { argb: catColor } };
    row.getCell(4).border = { left: { style: 'thick', color: { argb: catBorder } } };
    // Si una ubicacion no cabe, Excel achica la letra solo en esa celda (Reducir hasta ajustar).
    row.getCell(4).alignment = { vertical: 'middle', shrinkToFit: true };

    const estFont = ESTADO_FONT[u.status] || 'FF344054';
    const estBorder = ESTADO_BORDER[u.status];
    row.getCell(6).font = { name: 'Calibri', bold: true, size: 10, color: { argb: estFont } };
    if (estBorder) row.getCell(6).border = { right: { style: 'thick', color: { argb: estBorder } } };
  });


  return wb;
}

// ---------- Version PDF (misma apariencia que el Excel) ----------
const hex = (argb) => `#${String(argb).slice(2)}`;
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** HTML del modelo interno para imprimir a PDF (reportRenderer.renderReportOutputs). */
export function buildModeloInternoHtml(r, now = new Date()) {
  const { total, activas, estacionadas } = contarModeloInterno(r);
  const W = [16, 14, 20, 42, 14, 14];
  const sum = W.reduce((a, b) => a + b, 0);
  const cols = W.map((w) => `<col style="width:${((w / sum) * 100).toFixed(2)}%">`).join('');
  const filas = r.unidades.map((u) => {
    const cat = CATEGORY_FONT[u.location_category] || CATEGORY_FONT.OTRAS;
    const catB = CATEGORY_BORDER[u.location_category] || CATEGORY_BORDER.OTRAS;
    const est = ESTADO_FONT[u.status] || 'FF344054';
    const estB = ESTADO_BORDER[u.status];
    return `<tr>
      <td>${esc(u.unit_code || 'sin registrar')}</td><td>${esc(u.plate || '-')}</td><td>${esc(u.driver_name || '-')}</td>
      <td class="b" style="color:${hex(cat)};border-left:3px solid ${hex(catB)}${String(resumirDireccion(u, r.unidades)).length > 44 ? ';font-size:10px' : ''}">${esc(resumirDireccion(u, r.unidades) || '-')}</td>
      <td>${esc(formatHora(u.fetched_at))}</td>
      <td class="b" style="color:${hex(est)};${estB ? `border-right:3px solid ${hex(estB)}` : ''}">${esc(u.status || '-')}</td>
    </tr>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 14px; background: #fff; font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; color: #344054; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .top td { border: 2px solid #fff; text-align: center; vertical-align: middle; }
    .title { background: ${hex(NAVY)}; color: #fff; font-size: 24px; font-weight: 700; height: 38px; }
    .band { background: ${hex(NAVY_BAND)}; color: ${hex(NAVY_TEXT)}; font-size: 12px; height: 22px; }
    .gap td { border: 0; height: 12px; }
    .kl { color: #fff; font-size: 11px; font-weight: 700; height: 20px; }
    .kv { color: #fff; font-size: 28px; font-weight: 700; height: 34px; }
    .lh { background: ${hex(NAVY)}; color: #fff; font-size: 11px; font-weight: 700; height: 20px; }
    .lg { font-size: 10px; font-weight: 700; height: 20px; }
    .data th { background: ${hex(NAVY)}; color: #fff; font-size: 13px; font-weight: 700; padding: 5px 4px; border: 1px solid #4F81BD; }
    .data td { font-size: 12px; padding: 3px 5px; border: 1px solid #4F81BD; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .data td.b { font-weight: 700; }
  </style></head><body>
  <table class="top"><colgroup>${cols}</colgroup>
    <tr><td colspan="6" class="title">🚚&nbsp; TRACKER DE FLOTA — REPORTE ${esc(r.turno)}</td></tr>
    <tr><td colspan="6" class="band">FECHA: ${esc(formatFecha(r.fecha))} &nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp; CORTE: TURNO ${esc(r.turno)} &nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp; ÚLTIMA ACTUALIZACIÓN: ${esc(formatHora(now.toISOString()))}</td></tr>
    <tr class="gap"><td colspan="6"></td></tr>
    <tr>
      <td colspan="2" class="kl" style="background:${hex(NAVY)};border-bottom:0">TOTAL DE UNIDADES</td>
      <td colspan="2" class="kl" style="background:${hex(GREEN)};border-bottom:0">UNIDADES ACTIVAS</td>
      <td colspan="2" class="kl" style="background:${hex(RED)};border-bottom:0">UNIDADES ESTACIONADAS</td>
    </tr>
    <tr>
      <td colspan="2" class="kv" style="background:${hex(NAVY)};border-top:0">${total}</td>
      <td colspan="2" class="kv" style="background:${hex(GREEN)};border-top:0">${activas}</td>
      <td colspan="2" class="kv" style="background:${hex(RED)};border-top:0">${estacionadas}</td>
    </tr>
    <tr class="gap"><td colspan="6"></td></tr>
    <tr><td colspan="3" class="lh">📍&nbsp; LEYENDA DE COLORES: UBICACIÓN</td><td colspan="3" class="lh">⚡&nbsp; LEYENDA DE COLORES: ESTADO</td></tr>
    <tr>
      <td colspan="2" class="lg" style="background:${hex(LEGEND_FILL.OFICINA)};color:${hex(CATEGORY_FONT.OFICINA)}">OFICINAS Y TALLER LOCAL</td>
      <td class="lg" style="background:${hex(LEGEND_FILL.CAMPO)};color:${hex(CATEGORY_FONT.CAMPO)}">CAMPO BOSCÁN</td>
      <td rowspan="2" class="lg" style="background:${hex(LEGEND_FILL.ESTACIONADO)};color:${hex(ESTADO_FONT.ESTACIONADO)}">ESTACIONADO</td>
      <td colspan="2" rowspan="2" class="lg" style="background:${hex(LEGEND_FILL.ACTIVO)};color:${hex(ESTADO_FONT.ACTIVO)}">ACTIVO</td>
    </tr>
    <tr>
      <td colspan="2" class="lg" style="background:${hex(LEGEND_FILL.BASE)};color:${hex(CATEGORY_FONT.BASE)}">BASE CAMPO BOSCÁN</td>
      <td class="lg" style="background:${hex(LEGEND_FILL.OTRAS)};color:${hex(CATEGORY_FONT.OTRAS)}">OTRAS DIRECCIONES</td>
    </tr>
    <tr class="gap"><td colspan="6"></td></tr>
  </table>
  <table class="data"><colgroup>${cols}</colgroup>
    <thead><tr><th>🚚 UNIDAD</th><th>🔖 PLACA</th><th>👤 CONDUCTOR</th><th>📍 UBICACIÓN</th><th>🕒 HORA</th><th>⚡ ESTADO</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
  </body></html>`;
}
