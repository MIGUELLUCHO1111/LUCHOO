import DBMS from '../dbms/dbms.js';
import TelegramClient from '../tracker/telegramClient.js';

// Aviso diario por Telegram de documentos de la flota vencidos o por vencer
// (pedido de Lguerra, 05/10/2026). Mismo criterio que la app (estado de
// documentos de cada ficha): solo el documento MAS RECIENTE de cada tipo y
// aviso con DOC_ALERT_DAYS de anticipacion (Flota -> Mantenimiento, 30 por
// defecto). Si no hay nada vencido ni por vencer, no se manda nada. Los
// documentos que faltan por cargar no entran (serian casi toda la flota).

const DOC_LABEL = {
  RCV: 'RCV',
  INTT: 'Certificado del INTT',
  PERMISO_CIRCULACION: 'Permiso de circulación',
  POLIZA: 'Póliza de seguro',
  IZAMIENTO: 'Certificado de izamiento',
  PRUEBA_CARGA: 'Prueba de carga',
  DIELECTRICA: 'Prueba dieléctrica',
  REVISION: 'Revisión técnica',
  TITULO: 'Título de propiedad',
};
const TELEGRAM_MAX = 3800; // Telegram corta en 4096 caracteres

const fechaVE = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
const hoyVE = () => new Date().toLocaleDateString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric' });
const unidad = (r) => (r.plate && r.plate !== r.code ? `${r.code} (${r.plate})` : r.code);
const nombreDoc = (r) => (r.doc_type === 'OTRO' ? r.name : DOC_LABEL[r.doc_type] || r.name || r.doc_type);
const dias = (n) => (n === 1 ? '1 día' : `${n} días`);

/** Arma el mensaje (o null si no hay nada que avisar). */
export async function armarAvisoDocumentos() {
  const dbms = new DBMS();
  await dbms.init();
  const settings = (await dbms.executeNamedQuery({ nameQuery: 'fleetGetSettings' }))?.rows || [];
  const alertDays = Number(settings.find((s) => s.key === 'DOC_ALERT_DAYS')?.value) || 30;
  const rows = (await dbms.executeNamedQuery({ nameQuery: 'fleetDocsForAlert', params: { alert_days: alertDays } }))?.rows || [];
  if (!rows.length) return { mensajes: [], vencidos: 0, porVencer: 0, alertDays };

  const vencidos = rows.filter((r) => Number(r.days_left) < 0);
  const porVencer = rows.filter((r) => Number(r.days_left) >= 0);
  const lineas = [`📄 Documentos de la flota — ${hoyVE()}`, ''];
  if (vencidos.length) {
    lineas.push(`🔴 Vencidos (${vencidos.length})`);
    vencidos.forEach((r) => lineas.push(`• ${unidad(r)} · ${nombreDoc(r)} · venció hace ${dias(Math.abs(Number(r.days_left)))} (${fechaVE(r.expires_at)})`));
    lineas.push('');
  }
  if (porVencer.length) {
    lineas.push(`🟡 Por vencer en los próximos ${alertDays} días (${porVencer.length})`);
    porVencer.forEach((r) => {
      const n = Number(r.days_left);
      lineas.push(`• ${unidad(r)} · ${nombreDoc(r)} · ${n === 0 ? 'vence HOY' : `vence en ${dias(n)}`} (${fechaVE(r.expires_at)})`);
    });
    lineas.push('');
  }
  lineas.push('Detalle en la app: Flota → Fichas de Vehículos.');

  // Partir en varios mensajes si la lista es muy larga.
  const mensajes = [];
  let actual = '';
  for (const l of lineas) {
    if ((actual + l + '\n').length > TELEGRAM_MAX) { mensajes.push(actual.trimEnd()); actual = ''; }
    actual += `${l}\n`;
  }
  if (actual.trim()) mensajes.push(actual.trimEnd());
  return { mensajes, vencidos: vencidos.length, porVencer: porVencer.length, alertDays };
}

/** Arma y envia el aviso por Telegram (no envia nada si no hay documentos para avisar). */
export async function enviarAvisoDocumentos() {
  const aviso = await armarAvisoDocumentos();
  if (!aviso.mensajes.length) return { ...aviso, enviado: false, motivo: 'Sin documentos vencidos ni por vencer' };
  const telegram = new TelegramClient();
  let enviado = false;
  for (const m of aviso.mensajes) {
    const r = await telegram.sendMessage(m);
    enviado = enviado || !!r?.sent;
  }
  return { ...aviso, enviado };
}
