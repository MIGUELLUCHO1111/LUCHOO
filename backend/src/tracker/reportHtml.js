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

export function buildReportHtml(r) {
  const rows = r.unidades
    .map((u, i) => {
      const statusClass = u.status === 'ACTIVO' ? 'activo' : 'estacionado';
      const statusLabel = u.status === 'ACTIVO' ? 'Activo' : 'Estacionado';
      const unitCell = u.unit_code
        ? `<span class="mono strong">${escapeHtml(u.unit_code)}</span>`
        : `<span class="unregistered">sin registrar</span>`;
      const staleTag = u.is_stale ? `<br><span class="badge stale">SIN SEÑAL RECIENTE</span>` : '';
      return `
        <tr class="${i % 2 === 0 ? '' : 'alt'}">
          <td>${unitCell}</td>
          <td class="mono">${escapeHtml(u.plate || '-')}</td>
          <td>${escapeHtml(u.driver_name || '-')}</td>
          <td>${escapeHtml(u.location_text || '-')}</td>
          <td class="mono">${formatHora(u.last_report_at)}${staleTag}</td>
          <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        </tr>`;
    })
    .join('');

  const emptyRow = `<tr><td colspan="6" class="empty">Sin lecturas registradas en esta ventana de turno</td></tr>`;

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
    <div class="stale-section">
      <div class="stale-title">&#9888; Unidades sin señal reciente &mdash; revisar en sitio</div>
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

  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; }
  .badge.activo { background: #d1fae5; color: #059669; }
  .badge.estacionado { background: #fee2e2; color: #dc2626; }
  .badge.stale { background: #fef3c7; color: #b45309; font-size: 8.5px; }

  .stale-section { margin-top: 22px; padding: 16px 18px; border-radius: 14px; border: 1px solid #fde68a; background: #fffbeb; }
  .stale-title { font-size: 12px; font-weight: 800; color: #b45309; margin-bottom: 10px; }
  .stale-section th { border-bottom-color: #fde68a; }
  .stale-section td { border-bottom-color: #fef3c7; }
  .stale-section tr.alt td { background: #fef9ec; }

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

    <table>
      <thead><tr><th>Unidad</th><th>Placa</th><th>Conductor</th><th>Ubicación</th><th>Hora</th><th>Estado</th></tr></thead>
      <tbody>${rows || emptyRow}</tbody>
    </table>
    ${staleSection}

    <div class="footer">
      <span>Generado automáticamente por el Tracker GPS de Flota</span>
      <span>${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}</span>
    </div>
  </div>
</body></html>`;
}
