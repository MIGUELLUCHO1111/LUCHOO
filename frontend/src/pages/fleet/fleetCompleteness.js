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
