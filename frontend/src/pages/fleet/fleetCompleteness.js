// Que le falta a la ficha de una unidad (bloque "Fichas incompletas",
// respuestas de Julio 30/09/2026):
//   * Ficha basica (flota liviana y equipos fuera del contrato): encargado,
//     lectura de km y sus documentos obligatorios con archivo.
//   * Ficha completa (GT, BA, MT, CF, CC del contrato PDVSA-Chevron): lo
//     anterior + modelo del catalogo, ano, serial de carroceria y codigo
//     corto de la politica.
// Sirve igual para la lista (docs_resumen) y para la ficha (documentos).
import { isFullSheet } from "./fleetParts";
import { requiredFor, docLabel } from "./fleetDocuments";

export const CHECK_LABELS = {
  encargado: "Encargado",
  km: "Lectura de km u horas",
  documentos: "Documentos",
  modelo: "Modelo del catálogo",
  anio: "Año",
  serial: "Serial de carrocería",
  codigo: "Código corto",
};

export function fichaChecklist(unit) {
  const p = unit.profile || {};
  const docs = unit.docs_resumen || (unit.documentos || []).map((d) => ({ doc_type: d.doc_type, has_file: !!d.file_url, days_left: d.days_left }));
  const conArchivo = new Set(docs.filter((d) => d.has_file).map((d) => d.doc_type));
  const faltanDocs = requiredFor(unit).filter((t) => !conArchivo.has(t));
  // Lectura de km u horas: alguna lectura en el historial (o la del GPS ya consultada).
  const km = !!unit.tiene_lectura || Object.keys(unit.lecturas?.actual || {}).length > 0 || unit.odometro?.km != null || unit.odometro_gps != null;

  const items = [
    { key: "encargado", ok: !!unit.encargado },
    { key: "km", ok: km },
    { key: "documentos", ok: faltanDocs.length === 0, detail: faltanDocs.length ? `Faltan: ${faltanDocs.map(docLabel).join(", ")}` : null },
  ];
  if (isFullSheet(unit)) {
    items.push(
      { key: "modelo", ok: !!p.model_id },
      { key: "anio", ok: !!p.model_year },
      { key: "serial", ok: !!p.vin },
      { key: "codigo", ok: !!p.short_code },
    );
  }
  const done = items.filter((i) => i.ok).length;
  return { items: items.map((i) => ({ ...i, label: CHECK_LABELS[i.key] })), done, total: items.length, pct: Math.round((done / items.length) * 100), complete: done === items.length };
}

// Detalle por tipo de documento: el MAS RECIENTE de cada tipo (un documento
// renovado deja al anterior como historial; el vencido viejo ya no cuenta).
// Sirve para la lista (docs_resumen) y para la ficha (documentos).
const ALERT_DAYS = 30;
export function docsDetalle(unit) {
  const docs = unit.docs_resumen || (unit.documentos || []).map((d) => ({ doc_type: d.doc_type, has_file: !!d.file_url, days_left: d.days_left }));
  const required = requiredFor(unit);
  const latest = {};
  docs.forEach((d) => {
    const cur = latest[d.doc_type];
    const dl = d.days_left == null ? Infinity : Number(d.days_left);
    const cdl = cur ? (cur.days_left == null ? Infinity : Number(cur.days_left)) : -Infinity;
    if (!cur || dl > cdl) latest[d.doc_type] = d;
  });
  const types = [...required, ...Object.keys(latest).filter((t) => !required.includes(t))];
  return types.map((t) => {
    const d = latest[t];
    const dl = d?.days_left == null ? null : Number(d.days_left);
    const state = !d ? "falta" : dl != null && dl < 0 ? "vencido" : dl != null && dl <= ALERT_DAYS ? "por_vencer" : !d.has_file ? "sin_archivo" : "vigente";
    return { type: t, label: docLabel(t), required: required.includes(t), state, days_left: d ? dl : null };
  });
}

// Estado general para mostrarlo en grande (pedido de Lguerra, 05/10/2026):
// rojo vencido, amarillo por vencer, verde al dia; si todavia faltan
// obligatorios por cargar (o su archivo), gris. Automatico segun las fechas.
export function docsState(unit) {
  const det = docsDetalle(unit);
  const expired = det.filter((d) => d.state === "vencido").length;
  const expiring = det.filter((d) => d.state === "por_vencer").length;
  const faltan = det.filter((d) => d.required && (d.state === "falta" || d.state === "sin_archivo")).length;
  if (expired > 0) return { key: "vencido", label: expired === 1 ? "1 documento vencido" : `${expired} documentos vencidos`, cls: "bg-red-600 text-white", ring: "shadow-red-600/25" };
  if (expiring > 0) return { key: "por_vencer", label: expiring === 1 ? "1 documento por vencer" : `${expiring} documentos por vencer`, cls: "bg-[#FFCD11] text-slate-900", ring: "shadow-amber-400/30" };
  if (faltan > 0) return { key: "faltan", label: faltan === 1 ? "1 documento por cargar" : `${faltan} documentos por cargar`, cls: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300 border border-dashed border-slate-300 dark:border-white/15", ring: "" };
  const label = det.length === 0 ? "Sin documentos obligatorios" : "Documentos al día";
  return { key: "al_dia", label, cls: "bg-emerald-600 text-white", ring: "shadow-emerald-600/25" };
}
