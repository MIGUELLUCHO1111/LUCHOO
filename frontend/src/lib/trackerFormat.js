// Compartido entre las pantallas de Tracker GPS (tabla, mapa, reporte de turno).

// Mismos colores por categoría de ubicación que usaba el reporte manual en Excel.
export const CATEGORY_STYLES = {
  BASE: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  CAMPO: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  OFICINA: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  OTRAS: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

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
