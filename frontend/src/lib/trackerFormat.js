// Compartido entre las pantallas de Tracker GPS (tabla, mapa, reporte de turno).

// Mismos colores por categoría de ubicación que usaba el reporte manual en Excel.
export const CATEGORY_STYLES = {
  BASE: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  CAMPO: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  OFICINA: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  OTRAS: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

// Estado de cada unidad frente al total de la flota registrada: ACTIVO/
// ESTACIONADO vienen de una lectura real; SIN_DATOS es una unidad registrada
// que no reportó nada en la ventana consultada (no cuenta como estacionada:
// simplemente no hay información).
export const STATUS_LABELS = {
  ACTIVO: "ACTIVO",
  ESTACIONADO: "ESTACIONADO",
  SIN_DATOS: "SIN DATOS",
};

export const STATUS_BADGE_STYLES = {
  ACTIVO: "bg-emerald-500/10 text-emerald-600",
  ESTACIONADO: "bg-red-500/10 text-red-600",
  SIN_DATOS: "bg-slate-500/10 text-slate-500",
};

export const statusBadgeClass = (status) => STATUS_BADGE_STYLES[status] || STATUS_BADGE_STYLES.SIN_DATOS;
export const statusLabel = (status) => STATUS_LABELS[status] || status;

export const formatHora = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("es-VE", {
      timeZone: "America/Caracas",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

// Mismas 3 ventanas de corte que el Excel manual (hoja "Listas"): matutino,
// vespertino y nocturno. Debe coincidir con TURNOS en el backend
// (backend/src/bo/sub_system/classes/reporte.js).
export const TURNOS = {
  MATUTINO: { startHour: 9, endHour: 10, label: "Matutino", ventana: "9:00 a.m. - 10:00 a.m." },
  VESPERTINO: { startHour: 14, endHour: 15, label: "Vespertino", ventana: "2:00 p.m. - 3:00 p.m." },
  NOCTURNO: { startHour: 21, endHour: 22, label: "Nocturno", ventana: "9:00 p.m. - 10:00 p.m." },
};

const veHour = (date = new Date()) => {
  const hourStr = date.toLocaleString("en-US", { timeZone: "America/Caracas", hour: "2-digit", hour12: false });
  return parseInt(hourStr, 10) % 24;
};

/** Turno actual según la hora de Venezuela, o null si está fuera de las 3 ventanas. */
export function detectTurnoActual(date = new Date()) {
  const h = veHour(date);
  if (h >= 9 && h <= 10) return "MATUTINO";
  if (h >= 14 && h <= 15) return "VESPERTINO";
  if (h >= 21 && h <= 22) return "NOCTURNO";
  return null;
}

/** Fecha de hoy en Venezuela, formato YYYY-MM-DD (para <input type="date">). */
export function veTodayISO(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

/**
 * Formatea una fecha "pura" YYYY-MM-DD (sin hora) a DD/MM/YYYY.
 * A propósito NO usa `new Date(fechaStr)`: eso la interpreta como medianoche
 * UTC y `toLocaleDateString` la vuelve a convertir a la hora local del
 * navegador, lo que puede mostrar el día anterior según la zona horaria de
 * la máquina. Aquí se recorta el texto directamente, sin pasar por Date.
 */
export function formatFechaISO(fechaStr) {
  if (!fechaStr) return "-";
  const [y, m, d] = String(fechaStr).slice(0, 10).split("-");
  if (!y || !m || !d) return fechaStr;
  return `${d}/${m}/${y}`;
}
