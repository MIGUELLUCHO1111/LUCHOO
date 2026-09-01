import * as XLSX from "xlsx";

/**
 * Exporta un arreglo de filas a un archivo .xlsx desde el navegador.
 *
 * `xlsx` se carga dinámicamente (solo pese e import completa tarda en cargar).
 *
 * @param {object} options
 * @param {string} options.fileName    - Nombre del archivo (sin extensión)
 * @param {string} [options.sheetName] - Nombre de la hoja
 * @param {string[]} options.headers   - Encabezados de columnas
 * @param {Array<Array<any>>} options.rows - Filas de datos (valores planos)
 * @param {Array<any>} [options.totals]     - Fila opcional de totales al final
 */
export async function exportToExcel({
  fileName,
  sheetName = "Datos",
  headers,
  rows,
  totals,
}) {
  const XLSX = await import("xlsx");

  const wsData = [headers, ...rows];
  if (totals) wsData.push(totals);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = headers.map((h) => ({
    wch: Math.max(14, String(h).length + 6),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/** Fecha local a marca de tiempo corta (YYYY-MM-DD HH:mm) */
export const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-VE");
};

export const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Hora en formato 24h "HH:mm", el único que acepta <input type="time">. */
export const fmtTimeInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};