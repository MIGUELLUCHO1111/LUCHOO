// Plantilla HTML compartida para el PDF y la imagen del reporte de turno
// (reportRenderer.js renderiza esto dos veces, una como PDF y otra como
// PNG) -- mismos colores y tipografía que ya usa la app (naranja de acento,
// verde/rojo para activo/estacionado) para que se sienta parte del mismo
// producto y no un documento aparte.

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const formatHora = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('es-VE', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatFechaLarga = (fecha) => {
  const [y, m, d] = String(fecha).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
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

// Horas transcurridas desde la última posición conocida hasta que se generó
// el reporte -- para poder priorizar cuáles unidades "sin señal" revisar
// primero en sitio (una con 3 horas no es lo mismo que una con 4 días).
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

// Mismo color por categoria de ubicacion que usa el resto de la app
// (CATEGORY_STYLES en el frontend) -- misma pastilla de color que ya se ve
// en la tabla en vivo, para que el reporte no invente un lenguaje visual
// aparte.
const CATEGORY_COLORS = {
  BASE: { bg: '#eff6ff', text: '#2563eb' },
  CAMPO: { bg: '#fffbeb', text: '#b45309' },
  OFICINA: { bg: '#f0fdfa', text: '#0d9488' },
  OTRAS: { bg: '#faf5ff', text: '#9333ea' },
};
const CATEGORY_ORDER = ['BASE', 'CAMPO', 'OFICINA', 'OTRAS'];

// Mismos iconos (lucide) que usa la app para cada bloque -- SVG en vez de
// emoji: un emoji de color (p.ej. &#9889;) ignora `color` en el render de
// Chromium/Puppeteer y sale con su propio color en vez de blanco.
const ICON_SVG = (path) =>
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const ICONS = {
  activo: ICON_SVG('<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>'),
  estacionado: ICON_SVG('<circle cx="12" cy="12" r="10"/><line x1="10" x2="10" y1="15" y2="9"/><line x1="14" x2="14" y1="15" y2="9"/>'),
  stale: ICON_SVG('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
};

const sortByCategory = (units) =>
  units.slice().sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.location_category);
    const bi = CATEGORY_ORDER.indexOf(b.location_category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

// Un bloque por estado (Activas / Estacionadas), con las filas agrupadas
// visualmente por categoria de ubicacion (mismo orden y color en las tres
// vistas: app, PDF/imagen y Excel) -- pedido de Lguerra, 16/09/2026, en vez
// de una tabla plana mezclada o una mini-tabla por cada categoria.
const buildStatusSection = (title, colorClass, units) => {
  const sorted = sortByCategory(units);
  const rows = sorted
    .map((u, i) => {
      const unitCell = u.unit_code
        ? `<span class="mono strong">${escapeHtml(u.unit_code)}</span>`
        : `<span class="unregistered">sin registrar</span>`;
      const cat = CATEGORY_COLORS[u.location_category] || CATEGORY_COLORS.OTRAS;
      return `
        <tr class="${i % 2 === 0 ? '' : 'alt'}">
          <td>${unitCell}</td>
          <td class="mono">${escapeHtml(u.plate || '-')}</td>
          <td>${escapeHtml(u.driver_name || '-')}</td>
          <td><div class="loc-cell">
            <span class="cat-badge" style="background:${cat.bg};color:${cat.text}">${escapeHtml(u.location_category || 'OTRAS')}</span>
            <span class="loc-text">${escapeHtml(u.location_text || '-')}</span>
          </div></td>
          <td class="mono">${formatHora(u.fetched_at)}</td>
        </tr>`;
    })
    .join('');
  const emptyRow = `<tr><td colspan="5" class="empty">Ninguna unidad en este grupo</td></tr>`;

  const icon = ICONS[colorClass];
  return `
    <div class="status-card ${colorClass}">
      <div class="status-header">
        <span class="status-icon ${colorClass}">${icon}</span>
        <span class="status-header-title">${escapeHtml(title)}</span>
        <span class="status-count ${colorClass}">${units.length}</span>
      </div>
      <table>
        <thead><tr><th>Unidad</th><th>Placa</th><th>Conductor</th><th>Ubicación</th><th>Hora de revisión</th></tr></thead>
        <tbody>${rows || emptyRow}</tbody>
      </table>
    </div>`;
};

export function buildReportHtml(r) {
  const activeUnits = r.unidades.filter((u) => u.status === 'ACTIVO' && !u.is_stale);
  const parkedUnits = r.unidades.filter((u) => u.status === 'ESTACIONADO' && !u.is_stale);
  const activasSection = buildStatusSection('Unidades activas', 'activo', activeUnits);
  const estacionadasSection = buildStatusSection('Unidades estacionadas', 'estacionado', parkedUnits);

  // Unidades "sin señal reciente": aparte de contarlas, se detallan una por
  // una (última conexión + horas sin conexión) para que la revisión en sitio
  // se base en datos reales y no en "está estacionada, no importa".
  const staleUnits = r.unidades.filter((u) => u.is_stale);
  const staleRows = staleUnits
    .slice()
    .sort((a, b) => new Date(a.last_report_at || 0) - new Date(b.last_report_at || 0))
    .map((u, i) => {
      const unitCell = u.unit_code
        ? `<span class="mono strong">${escapeHtml(u.unit_code)}</span>`
        : `<span class="unregistered">sin registrar</span>`;
      return `
        <tr class="${i % 2 === 0 ? '' : 'alt'}">
          <td>${unitCell}</td>
          <td class="mono">${escapeHtml(u.plate || '-')}</td>
          <td class="mono">${formatFechaHora(u.last_report_at)}</td>
          <td><span class="badge stale">${formatHoras(horasSinConexion(u.last_report_at))}</span></td>
        </tr>`;
    })
    .join('');

  const staleSection = staleUnits.length
    ? `
    <div class="stale-card">
      <div class="status-header">
        <span class="status-icon stale">${ICONS.stale}</span>
        <span class="status-header-title stale">Unidades sin señal reciente &mdash; revisar en sitio</span>
        <span class="status-count stale">${staleUnits.length}</span>
      </div>
      <table>
        <thead><tr><th>Unidad</th><th>Placa</th><th>Última conexión</th><th>Horas sin conexión</th></tr></thead>
        <tbody>${staleRows}</tbody>
      </table>
    </div>`
    : '';

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", -apple-system, Roboto, Arial, sans-serif; margin: 0; background: #ffffff; color: #0f172a; }
  .page { padding: 40px 44px 30px; }

  .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #f97316; padding-bottom: 18px; margin-bottom: 24px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand .logo { width: 42px; height: 42px; border-radius: 12px; background: #f97316; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; flex-shrink: 0; }
  .brand h1 { font-size: 19px; margin: 0; font-weight: 800; color: #0f172a; }
  .brand .sub { font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-top: 2px; }
  .meta { text-align: right; font-size: 12px; color: #64748b; line-height: 1.6; }
  .meta b { color: #0f172a; }

  .kpis { display: flex; gap: 14px; margin-bottom: 24px; }
  .kpi { flex: 1; border-radius: 14px; padding: 14px 18px; border: 1px solid #e2e8f0; background: #f8fafc; }
  .kpi .label { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #94a3b8; }
  .kpi .value { font-size: 28px; font-weight: 800; margin-top: 4px; color: #0f172a; }
  .kpi.total { border-color: #fdba74; background: #fff7ed; }
  .kpi.total .value { color: #ea580c; }
  .kpi.activas { border-color: #6ee7b7; background: #ecfdf5; }
  .kpi.activas .value { color: #059669; }
  .kpi.estacionadas { border-color: #fca5a5; background: #fef2f2; }
  .kpi.estacionadas .value { color: #dc2626; }
  .kpi.sinsenal { border-color: #fde68a; background: #fffbeb; }
  .kpi.sinsenal .value { color: #b45309; }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #94a3b8; padding: 0 12px 9px; border-bottom: 2px solid #e2e8f0; }
  td { padding: 10px 12px; font-size: 12px; color: #334155; border-bottom: 1px solid #f1f5f9; }
  tr.alt td { background: #f8fafc; }
  td.empty { text-align: center; color: #94a3b8; padding: 24px; }
  .mono { font-family: "Consolas", "SFMono-Regular", monospace; }
  .strong { font-weight: 700; color: #0f172a; }
  .unregistered { font-style: italic; color: #94a3b8; font-weight: 400; }

  .badge.stale { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 8.5px; font-weight: 700; background: #fef3c7; color: #b45309; }
  .cat-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 8.5px; font-weight: 700; flex-shrink: 0; margin-top: 2px; }
  .loc-cell { display: flex; align-items: flex-start; gap: 6px; }
  .loc-text { flex: 1; min-width: 0; }

  .legend { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 20px; margin-bottom: 22px; }
  .legend-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #94a3b8; }
  .legend-item { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; color: #334155; }

  /* Misma tarjeta blanca con encabezado de icono + titulo + contador
     pastel que usan los bloques desplegables de Estado de Flota en la app
     -- pedido de Lguerra, 16/09/2026, en vez de una barra solida de color. */
  .status-card, .stale-card { margin-bottom: 22px; border-radius: 14px; border: 1px solid; background: #fff; overflow: hidden; }
  .status-card.activo { border-color: #a7f3d0; }
  .status-card.estacionado { border-color: #fecaca; }
  .stale-card { border-color: #fde68a; }
  .status-card table, .stale-card table { margin: 0; }
  .status-card th, .status-card td, .stale-card th, .stale-card td { padding-left: 18px; padding-right: 18px; }

  .status-header { display: flex; align-items: center; gap: 10px; padding: 14px 18px; }
  .status-icon { width: 30px; height: 30px; border-radius: 999px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; flex-shrink: 0; }
  .status-icon svg { display: block; }
  .status-icon.activo { background: #10b981; }
  .status-icon.estacionado { background: #ef4444; }
  .status-icon.stale { background: #f59e0b; }
  .status-header-title { font-size: 14px; font-weight: 800; color: #0f172a; }
  .status-header-title.stale { color: #92400e; font-size: 13px; }
  .status-count { padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; }
  .status-count.activo { background: #d1fae5; color: #059669; }
  .status-count.estacionado { background: #fee2e2; color: #dc2626; }
  .status-count.stale { background: #fef3c7; color: #b45309; }

  .stale-card th { border-bottom-color: #fde68a; }
  .stale-card td { border-bottom-color: #fef3c7; }
  .stale-card tr.alt td { background: #fef9ec; }

  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
</style></head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand">
        <div class="logo">&#128225;</div>
        <div>
          <h1>Reporte de Turno &mdash; ${escapeHtml(r.turno)}</h1>
          <div class="sub">Fullpetro &middot; Tracker GPS de Flota</div>
        </div>
      </div>
      <div class="meta">
        FECHA: <b>${formatFechaLarga(r.fecha)}</b><br>
        CORTE: <b>${escapeHtml(r.turno_label || r.turno)}</b>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi total"><div class="label">Total Unidades</div><div class="value">${r.total}</div></div>
      <div class="kpi activas"><div class="label">Activas</div><div class="value">${r.activas}</div></div>
      <div class="kpi estacionadas"><div class="label">Estacionadas</div><div class="value">${r.estacionadas}</div></div>
      <div class="kpi sinsenal"><div class="label">Sin Señal Reciente</div><div class="value">${r.sin_senal ?? 0}</div></div>
    </div>

    <div class="legend">
      <span class="legend-label">📍 Leyenda de ubicación</span>
      <span class="legend-item"><span class="cat-badge" style="background:${CATEGORY_COLORS.BASE.bg};color:${CATEGORY_COLORS.BASE.text}">BASE</span>Base</span>
      <span class="legend-item"><span class="cat-badge" style="background:${CATEGORY_COLORS.CAMPO.bg};color:${CATEGORY_COLORS.CAMPO.text}">CAMPO</span>Campo</span>
      <span class="legend-item"><span class="cat-badge" style="background:${CATEGORY_COLORS.OFICINA.bg};color:${CATEGORY_COLORS.OFICINA.text}">OFICINA</span>Oficina</span>
      <span class="legend-item"><span class="cat-badge" style="background:${CATEGORY_COLORS.OTRAS.bg};color:${CATEGORY_COLORS.OTRAS.text}">OTRAS</span>Otras</span>
    </div>

    ${activasSection}
    ${estacionadasSection}
    ${staleSection}

    <div class="footer">
      <span>Generado automáticamente por el Tracker GPS de Flota</span>
      <span>${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}</span>
    </div>
  </div>
</body></html>`;
}
