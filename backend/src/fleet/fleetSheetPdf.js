import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Ficha imprimible en PDF (pedido de Lguerra, 07/10/2026): una hoja A4 con
// los datos de la unidad (o del conductor), su foto, documentos y conductor,
// para imprimir o mandar. Mismo diseño que la app (azul marino para Flota
// Liviana, amarillo Caterpillar para Flota Pesada). Las fotos se incrustan
// en el HTML (data URI) porque el Chrome que arma el PDF no tiene sesion.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS = path.resolve(__dirname, '../../uploads/fleet');
const FILE_URL = /^\/fleet\/(models|units|documents|drivers)\/file\/(\d+)\/([a-zA-Z0-9._-]+)$/;
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const NAVY = '#15324D';
const CAT = '#FFCD11';
const STATUS = {
  OPERATIVO_CONTRATO: { label: 'Operativo en contrato', bg: '#059669' },
  DISPONIBLE: { label: 'Disponible', bg: '#EA580C' },
  FUERA_DE_SERVICIO: { label: 'Fuera de servicio', bg: '#DC2626' },
};
const FLOTA = { LIVIANA: 'Flota Liviana', PESADA: 'Flota Pesada', AMBAS: 'Flota Liviana y Pesada' };
const DOC_ALERT_DAYS = 30;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fecha = (v) => {
  if (!v) return '';
  const s = v instanceof Date ? v.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' }) : String(v).slice(0, 10);
  const [y, m, d] = s.split('-');
  return d ? `${d}/${m}/${y}` : s;
};
const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const num = (v, suf = '') => (v == null || v === '' ? '' : `${Number(v).toLocaleString('es-VE', { maximumFractionDigits: 0 })}${suf}`);
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// Foto guardada por la app (/fleet/<tipo>/file/<id>/<archivo>) -> data URI.
export async function imagenDataUri(url) {
  const m = FILE_URL.exec(String(url || ''));
  if (!m) return null;
  const mime = MIME[path.extname(m[3]).toLowerCase()];
  if (!mime) return null;
  try {
    const buf = await fs.readFile(path.join(UPLOADS, m[1], m[2], m[3]));
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// Estado de un documento segun su vencimiento.
const estadoDoc = (expires, daysLeft, { tieneArchivo = true, sinFecha = 'Cargado' } = {}) => {
  if (!expires) return tieneArchivo ? { txt: sinFecha, cls: 'ok' } : { txt: 'Falta cargar', cls: 'warn' };
  const n = Number(daysLeft);
  if (n < 0) return { txt: `Vencido hace ${Math.abs(n)} d`, cls: 'bad' };
  if (n <= DOC_ALERT_DAYS) return { txt: n === 0 ? 'Vence hoy' : `Vence en ${n} d`, cls: 'warn' };
  return { txt: 'Vigente', cls: 'ok' };
};

const CSS = (pesada) => `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; color: #0f172a; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; padding: 0 0 14mm; position: relative; }
  .hero { background: ${pesada ? `linear-gradient(135deg, #FFD84D, ${CAT} 55%, #E6B400)` : `linear-gradient(135deg, ${NAVY}, #1d4466)`}; color: ${pesada ? '#0f172a' : '#fff'}; padding: 9mm 12mm 8mm; display: flex; gap: 8mm; align-items: center; position: relative; overflow: hidden; }
  .hero::after { content: ''; position: absolute; right: -30mm; top: -30mm; width: 80mm; height: 80mm; border-radius: 50%; background: rgba(255,255,255,.12); }
  .kicker { font-size: 9px; letter-spacing: .22em; font-weight: 800; opacity: .8; text-transform: uppercase; }
  .title { font-size: 26px; font-weight: 900; line-height: 1.1; margin: 1.5mm 0; font-family: Cambria, Georgia, serif; }
  .sub { font-size: 12px; font-weight: 700; opacity: .9; }
  .pills { display: flex; flex-wrap: wrap; gap: 2mm; margin-top: 3mm; }
  .pill { border-radius: 99px; padding: 1.2mm 3.5mm; font-size: 10px; font-weight: 800; background: #fff; color: ${NAVY}; }
  .photo { width: 52mm; height: 40mm; border-radius: 5mm; overflow: hidden; background: rgba(255,255,255,.15); border: 1.2mm solid rgba(255,255,255,.35); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 34px; font-weight: 900; position: relative; z-index: 1; }
  .photo.person { width: 40mm; height: 50mm; }
  .photo img { width: 100%; height: 100%; object-fit: cover; }
  .photo .tag { position: absolute; bottom: 1.5mm; left: 1.5mm; background: rgba(0,0,0,.55); color: #fff; font-size: 8px; padding: .6mm 2mm; border-radius: 99px; font-weight: 700; }
  .plate { display: inline-flex; flex-direction: column; align-items: center; background: #fff; color: #1e3a8a; border: .5mm solid #94a3b8; border-radius: 2mm; padding: .8mm 4mm; margin-top: 2mm; }
  .plate small { font-size: 6px; color: #475569; font-weight: 700; letter-spacing: .05em; }
  .plate b { font-size: 17px; letter-spacing: .12em; font-family: 'Courier New', monospace; }
  .body { padding: 6mm 12mm 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .card { border: .3mm solid #e2e8f0; border-radius: 4mm; padding: 4mm; break-inside: avoid; margin-bottom: 5mm; }
  .card h2 { font-size: 12px; color: ${NAVY}; font-weight: 900; margin-bottom: 3mm; display: flex; align-items: center; gap: 2mm; text-transform: uppercase; letter-spacing: .06em; }
  .card h2::before { content: ''; width: 2.2mm; height: 4mm; border-radius: 1mm; background: ${pesada ? CAT : NAVY}; }
  .kv { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; }
  .kv div { background: #f8fafc; border-radius: 2mm; padding: 1.6mm 2.5mm; min-width: 0; }
  .kv .full { grid-column: span 2; }
  .kv span { display: block; font-size: 7.5px; font-weight: 800; color: #64748b; letter-spacing: .08em; text-transform: uppercase; }
  .kv b { display: block; font-size: 11px; color: ${NAVY}; overflow-wrap: anywhere; }
  .kv b.empty { color: #cbd5e1; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8px; letter-spacing: .08em; text-transform: uppercase; color: #64748b; padding: 1.5mm 2mm; border-bottom: .4mm solid #e2e8f0; }
  td { padding: 1.8mm 2mm; border-bottom: .2mm solid #f1f5f9; font-size: 10.5px; vertical-align: top; }
  .st { display: inline-block; border-radius: 99px; padding: .5mm 2.5mm; font-weight: 800; font-size: 9px; white-space: nowrap; }
  .st.ok { background: #d1fae5; color: #047857; } .st.warn { background: #fef3c7; color: #b45309; } .st.bad { background: #fee2e2; color: #b91c1c; } .st.na { background: #f1f5f9; color: #94a3b8; }
  .person-row { display: flex; gap: 3mm; align-items: center; }
  .avatar { width: 14mm; height: 14mm; border-radius: 3mm; overflow: hidden; background: ${NAVY}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; flex-shrink: 0; }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .muted { color: #64748b; }
  .annex { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
  .annex figure { border: .3mm solid #e2e8f0; border-radius: 3mm; overflow: hidden; break-inside: avoid; }
  .annex img { width: 100%; max-height: 70mm; object-fit: contain; background: #f8fafc; display: block; }
  .annex figcaption { padding: 1.5mm 2.5mm; font-size: 9px; font-weight: 800; color: ${NAVY}; }
  .events li { list-style: none; display: flex; justify-content: space-between; gap: 3mm; padding: 1.3mm 0; border-bottom: .2mm dashed #e2e8f0; }
  .foot { position: fixed; bottom: 5mm; left: 12mm; right: 12mm; display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8; border-top: .3mm solid #e2e8f0; padding-top: 2mm; }
  .brand { font-weight: 900; color: ${NAVY}; letter-spacing: .04em; }
`;

const kv = (label, value, full = false) => `<div${full ? ' class="full"' : ''}><span>${esc(label)}</span><b${value ? '' : ' class="empty"'}>${value ? esc(value) : '—'}</b></div>`;
const st = (e) => `<span class="st ${e.cls}">${esc(e.txt)}</span>`;
const doc = (title, body, pesada, foot) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS(pesada)}</style></head><body><div class="page">${body}<div class="foot"><span><span class="brand">FULL PETRO</span> · Flota · ${esc(title)}</span><span>${esc(foot)}</span></div></div></body></html>`;

// ---------------- Ficha de la unidad ----------------
export async function buildUnitSheetHtml(u, { generadoPor } = {}) {
  const p = u.profile || {};
  const pesada = u.fleet_type === 'PESADA';
  const status = STATUS[p.operational_status] || STATUS.DISPONIBLE;
  const propia = await imagenDataUri(p.photo_url);
  const foto = propia || (await imagenDataUri(u.model_photo));
  const conductorFoto = u.conductor ? await imagenDataUri(u.conductor.photo_url) : null;

  // Solo el documento mas reciente de cada tipo.
  const porTipo = new Map();
  for (const d of [...(u.documentos || [])].sort((a, b) => Number(b.id) - Number(a.id))) if (!porTipo.has(d.doc_type)) porTipo.set(d.doc_type, d);
  const docs = [...porTipo.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const km = u.lecturas?.actual?.KM || (u.odometro ? { valor: u.odometro.km, fecha: u.odometro.fecha, fuente: u.odometro.fuente } : null);
  const horas = u.lecturas?.actual?.HORAS;
  const gps = u.snapshot;
  const parada = u.parada;
  const marcaModelo = [u.brand_name || p.brand, u.model_name || p.model].filter(Boolean).join(' ');
  const c = u.conductor;
  const lic = c ? estadoDoc(c.license_expires_at, c.license_days_left, { tieneArchivo: false }) : null;

  const body = `
  <div class="hero">
    <div class="photo">${foto ? `<img src="${foto}">${propia ? '' : '<span class="tag">Foto del modelo</span>'}` : esc(initials(u.code))}</div>
    <div style="flex:1; position:relative; z-index:1">
      <div class="kicker">Ficha del vehículo · ${esc(FLOTA[u.fleet_type] || 'Flota sin clasificar')}</div>
      <div class="title">${esc(u.code)}</div>
      <div class="sub">${esc([marcaModelo, u.version_name, p.model_year].filter(Boolean).join(' · ') || u.name || '')}</div>
      ${u.plate ? `<div class="plate"><small>REPÚBLICA BOLIVARIANA DE VENEZUELA</small><b>${esc(u.plate)}</b></div>` : ''}
      <div class="pills">
        <span class="pill" style="background:${status.bg}; color:#fff">${esc(status.label)}${p.operational_status === 'FUERA_DE_SERVICIO' && p.status_cause ? ` · ${esc(p.status_cause)}` : ''}</span>
        ${u.frente ? `<span class="pill">Frente: ${esc(u.frente.frente)}</span>` : ''}
        ${parada?.alerta ? `<span class="pill" style="background:#7c3aed; color:#fff">Parada hace ${esc(parada.dias)} días</span>` : ''}
      </div>
    </div>
  </div>
  <div class="body">
    <div class="grid">
      <div class="card"><h2>ADN del vehículo</h2><div class="kv">
        ${kv('Marca', u.brand_name || p.brand)}${kv('Modelo', u.model_name || p.model)}
        ${kv('Versión', u.version_name)}${kv('Año', p.model_year)}
        ${kv('Color', p.color)}${kv('Tipo de motor', p.engine_type)}
        ${kv('Serial de carrocería (VIN)', p.vin, true)}
        ${kv('Serial de motor', p.engine_serial)}${kv('Combustible', p.fuel_type)}
        ${kv('Código corto', p.short_code)}${kv('Tanque', num(u.tank_capacity_liters, ' L'))}
      </div></div>
      <div class="card"><h2>Estado operativo</h2><div class="kv">
        ${kv('Condición', status.label + (p.operational_status === 'FUERA_DE_SERVICIO' && p.status_cause ? ` (${p.status_cause})` : ''), true)}
        ${kv('Frente / asignación', u.frente ? [u.frente.frente, u.frente.contrato && `Contrato ${u.frente.contrato}`].filter(Boolean).join(' · ') : '', true)}
        ${kv('Encargado', u.encargado?.nombre)}${kv('Odómetro', km ? `${num(km.valor, ' km')}` : '')}
        ${horas ? kv('Horómetro', `${num(horas.valor, ' h')}`) : ''}
        ${kv('Último movimiento (GPS)', parada ? (parada.dias === 0 ? 'Se movió hoy' : `Hace ${parada.dias} días`) : '')}
        ${kv('Última posición GPS', gps ? [gps.location_text, gps.last_report_at && fechaHora(gps.last_report_at)].filter(Boolean).join(' · ') : '', true)}
      </div></div>
    </div>
    <div class="card"><h2>Conductor</h2>
      ${c ? `<div class="person-row">
        <div class="avatar">${conductorFoto ? `<img src="${conductorFoto}">` : esc(initials(c.full_name))}</div>
        <div style="flex:1"><b style="font-size:13px; color:${NAVY}">${esc(c.full_name)}</b>
          <div class="muted">${[c.phone && `Tel. ${c.phone}`, c.started_at && `Asignado desde ${fecha(c.started_at)}`].filter(Boolean).map(esc).join(' · ')}</div></div>
        <div>Licencia: ${c.license_expires_at ? `${esc(fecha(c.license_expires_at))} ${st(lic)}` : '<span class="st na">Sin vencimiento</span>'}</div>
      </div>` : `<div class="muted">${u.driver_name ? `${esc(u.driver_name)} (sin conductor del registro)` : 'Sin conductor asignado'}</div>`}
    </div>
    <div class="card"><h2>Documentación</h2>
      ${docs.length ? `<table><thead><tr><th>Documento</th><th>N°</th><th>Emisión</th><th>Vence</th><th>Estado</th></tr></thead><tbody>
        ${docs.map((d) => `<tr><td><b>${esc(d.name)}</b>${d.provider ? `<div class="muted">${esc(d.provider)}</div>` : ''}</td><td>${esc(d.number || '—')}</td><td>${esc(fecha(d.issued_at) || '—')}</td><td>${esc(fecha(d.expires_at) || '—')}</td><td>${st(estadoDoc(d.expires_at, d.days_left, { tieneArchivo: !!d.file_url, sinFecha: 'Sin vencimiento' }))}</td></tr>`).join('')}
      </tbody></table>` : '<div class="muted">Todavía no tiene documentos cargados.</div>'}
    </div>
    ${(u.eventos || []).length ? `<div class="card"><h2>Últimos movimientos de la ficha</h2><ul class="events">
      ${u.eventos.slice(0, 8).map((e) => `<li><span><b>${esc(e.title)}</b>${e.detail ? ` <span class="muted">· ${esc(e.detail)}</span>` : ''}</span><span class="muted">${esc(fechaHora(e.created_at))}</span></li>`).join('')}
    </ul></div>` : ''}
  </div>`;
  return doc(`Ficha ${u.code}`, body, pesada, `Generado el ${fechaHora(new Date())}${generadoPor ? ` por ${generadoPor}` : ''}`);
}

// ---------------- Ficha del conductor ----------------
export async function buildDriverSheetHtml(d, { generadoPor } = {}) {
  const pesada = d.fleet_type === 'PESADA';
  const foto = await imagenDataUri(d.photo_url);
  const exigePesada = d.fleet_type === 'PESADA' || d.fleet_type === 'AMBAS';
  const DOCS = [
    { t: 'Licencia de conducir', url: d.license_file_url, mime: d.license_file_mime, vence: d.license_expires_at, e: estadoDoc(d.license_expires_at, d.license_days_left, { tieneArchivo: !!d.license_file_url }) },
    { t: 'Carta médica', url: d.medical_file_url, mime: d.medical_file_mime, vence: d.medical_expires_at, e: estadoDoc(d.medical_expires_at, d.medical_days_left, { tieneArchivo: !!d.medical_file_url }) },
    { t: 'Política de conducción de vehículo corporativo', url: d.policy_file_url, mime: d.policy_file_mime, vence: null, extra: d.policy_signed_at ? `Firmada el ${fecha(d.policy_signed_at)}` : '', e: d.policy_file_url ? { txt: 'Firmada', cls: 'ok' } : { txt: 'Falta la firma', cls: 'warn' } },
    { t: 'Certificado de conducción de flota pesada', url: d.heavy_cert_file_url, mime: d.heavy_cert_file_mime, vence: d.heavy_cert_expires_at,
      e: !d.heavy_cert_file_url && !d.heavy_cert_expires_at ? (exigePesada ? { txt: 'Falta (Flota Pesada)', cls: 'bad' } : { txt: 'No requerido', cls: 'na' }) : estadoDoc(d.heavy_cert_expires_at, d.heavy_cert_days_left) },
  ];
  const anexos = [];
  for (const x of DOCS) if (x.url && String(x.mime || '').startsWith('image/')) { const img = await imagenDataUri(x.url); if (img) anexos.push({ t: x.t, img }); }
  const lic = DOCS[0].e;

  const body = `
  <div class="hero">
    <div class="photo person">${foto ? `<img src="${foto}">` : esc(initials(d.full_name))}</div>
    <div style="flex:1; position:relative; z-index:1">
      <div class="kicker">Ficha del conductor · ${esc(FLOTA[d.fleet_type] || 'Flota sin definir')}</div>
      <div class="title">${esc(d.full_name)}</div>
      <div class="sub">${[d.cedula && `C.I. ${d.cedula}`, d.phone && `Tel. ${d.phone}`, d.license_category && `Licencia de ${d.license_category}`].filter(Boolean).map(esc).join(' · ')}</div>
      <div class="pills">
        <span class="pill" style="background:${d.is_active ? '#059669' : '#94a3b8'}; color:#fff">${d.is_active ? 'Activo' : 'Inactivo'}</span>
        <span class="pill">Licencia: ${esc(lic.txt)}</span>
        <span class="pill">${d.unidades?.length ? `Maneja ${d.unidades.length} unidad(es)` : 'Sin unidad asignada'}</span>
      </div>
    </div>
  </div>
  <div class="body">
    <div class="grid">
      <div class="card"><h2>Datos del conductor</h2><div class="kv">
        ${kv('Cédula', d.cedula)}${kv('Teléfono', d.phone)}
        ${kv('N° de licencia', d.license_number)}${kv('Grado', d.license_category)}
        ${kv('Vence la licencia', fecha(d.license_expires_at))}${kv('Vence la carta médica', fecha(d.medical_expires_at))}
        ${kv('Política firmada', d.policy_signed_at ? fecha(d.policy_signed_at) : d.policy_file_url ? 'Sí' : '')}${kv('Certificado flota pesada', fecha(d.heavy_cert_expires_at))}
        ${kv('Flota', FLOTA[d.fleet_type], true)}
      </div></div>
      <div class="card"><h2>Unidades que maneja</h2>
        ${d.unidades?.length ? `<table><thead><tr><th>Unidad</th><th>Placa</th><th>Flota</th><th>Desde</th></tr></thead><tbody>
          ${d.unidades.map((x) => `<tr><td><b>${esc(x.code)}</b></td><td>${esc(x.plate || '—')}</td><td>${esc(x.fleet_type === 'PESADA' ? 'Pesada' : x.fleet_type === 'LIVIANA' ? 'Liviana' : '—')}</td><td>${esc(fecha(x.desde))}</td></tr>`).join('')}
        </tbody></table>` : '<div class="muted">Sin unidad asignada.</div>'}
        ${d.notes ? `<div style="margin-top:3mm; background:#fffbeb; border-radius:2mm; padding:2mm 3mm"><b style="font-size:8px; color:#b45309">NOTAS</b><div>${esc(d.notes)}</div></div>` : ''}
      </div>
    </div>
    <div class="card"><h2>Documentos</h2><table><thead><tr><th>Documento</th><th>Vence / firma</th><th>Archivo</th><th>Estado</th></tr></thead><tbody>
      ${DOCS.map((x) => `<tr><td><b>${esc(x.t)}</b></td><td>${esc(x.vence ? fecha(x.vence) : x.extra || '—')}</td><td>${x.url ? (String(x.mime).startsWith('image/') ? 'Imagen (anexa abajo)' : 'PDF (en la app)') : '<span class="muted">Sin archivo</span>'}</td><td>${st(x.e)}</td></tr>`).join('')}
    </tbody></table></div>
    ${(d.historial || []).length ? `<div class="card"><h2>Historial de unidades</h2><ul class="events">
      ${d.historial.slice(0, 10).map((h) => `<li><span><b>${esc(h.code)}</b> <span class="muted">${esc(h.fleet_type === 'PESADA' ? 'Pesada' : h.fleet_type === 'LIVIANA' ? 'Liviana' : '')}</span></span><span class="muted">${esc(fecha(h.started_at))} → ${h.ended_at ? esc(fecha(h.ended_at)) : 'hoy'}</span></li>`).join('')}
    </ul></div>` : ''}
    ${anexos.length ? `<div class="card"><h2>Anexos</h2><div class="annex">${anexos.map((a) => `<figure><img src="${a.img}"><figcaption>${esc(a.t)}</figcaption></figure>`).join('')}</div></div>` : ''}
  </div>`;
  return doc(`Ficha conductor ${d.full_name}`, body, pesada, `Generado el ${fechaHora(new Date())}${generadoPor ? ` por ${generadoPor}` : ''}`);
}

export const sheetFileName = (prefix, name) => `${prefix}_${String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9.-]+/g, '_').replace(/^_+|_+$/g, '')}_${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' }).replace(/-/g, '')}.pdf`;
