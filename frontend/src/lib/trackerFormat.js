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

// Flota pesada (campo) vs liviana -- ver alerta.js: una unidad pesada activa
// fuera de horario no dispara Telegram (suele estar autorizada), la liviana sí.
export const FLEET_TYPE_STYLES = {
  LIVIANA: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  PESADA: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

export const fleetTypeLabel = (fleetType) => fleetType || "SIN CLASIFICAR";
export const fleetTypeBadgeClass = (fleetType) => FLEET_TYPE_STYLES[fleetType] || "bg-slate-500/10 text-slate-500";

// Horas transcurridas desde la ultima posicion conocida hasta ahora -- para
// poder priorizar cuales unidades "sin señal" revisar primero en sitio (una
// con 3 horas no es lo mismo que una con 4 dias). Misma logica que usa el
// reporte de turno (backend/src/tracker/reportHtml.js).
export const horasSinConexion = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / (1000 * 60 * 60);
};

export const formatHoras = (horas) => {
  if (horas == null) return "sin datos";
  if (horas < 48) return `${horas.toFixed(1)} h`;
  return `${(horas / 24).toFixed(1)} días`;
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

// Motivo probable de que una unidad este "sin senal", con los datos que manda
// el GPS en su ultima lectura (pedido de Lguerra, 30/09/2026): evento del
// equipo, bateria del vehiculo (V), bateria interna del equipo (%), satelites
// y dias sin reportar. Es una estimacion para orientar la revision en sitio.
export function motivoSinSenal(s) {
  const evento = String(s.gps_status_name || "").toLowerCase();
  const vVehiculo = s.vehicle_battery != null && s.vehicle_battery !== "" ? Number(s.vehicle_battery) : null;
  const bEquipo = s.battery_level != null && s.battery_level !== "" ? Number(s.battery_level) : null;
  const sat = s.num_satellite != null && s.num_satellite !== "" ? Number(s.num_satellite) : null;
  const horas = horasSinConexion(s.last_report_at);
  if (evento.includes("desconex")) return { texto: "Alimentación del GPS desconectada", detalle: `Último evento del equipo${vVehiculo != null ? ` · batería del vehículo ${vVehiculo} V` : ""}`, tono: "red" };
  if (vVehiculo === 0) return { texto: "Sin alimentación del vehículo (0 V)", detalle: "Batería desconectada o descargada", tono: "red" };
  if (vVehiculo != null && vVehiculo < 10) return { texto: `Batería del vehículo baja (${vVehiculo} V)`, detalle: "Revisar batería y conexión del equipo", tono: "red" };
  if (bEquipo != null && bEquipo <= 15) return { texto: `Batería del equipo GPS agotada (${bEquipo}%)`, detalle: "El equipo se apaga al quedarse sin su batería interna", tono: "red" };
  if (s.valid_gps === "false" || (sat != null && sat < 4)) return { texto: "Sin cobertura de satélites", detalle: sat != null ? `${sat} satélite(s) en la última lectura` : "Última posición no válida", tono: "amber" };
  if (horas != null && horas > 7 * 24) return { texto: "Equipo apagado o retirado", detalle: "Más de 7 días sin reportar con batería normal", tono: "amber" };
  return { texto: "Posible zona sin cobertura", detalle: "La última señal fue normal", tono: "slate" };
}
