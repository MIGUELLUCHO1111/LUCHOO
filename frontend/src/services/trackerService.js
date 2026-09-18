import api, { executeTransaction, getCurrentProfile } from "./api";

const TX = {
  CREATE_UNIDAD: 118,
  GET_ALL_UNIDADES: 119,
  GET_UNIDAD_BY_ID: 120,
  UPDATE_UNIDAD: 121,
  DELETE_UNIDAD: 122,
  GET_LATEST_SNAPSHOTS: 123,
  SYNC_NOW: 124,
  GET_RECENT_ALERTS: 125,
  GENERAR_REPORTE: 126,
  ARCHIVAR_AHORA: 127,
  GET_ANALISIS_DEL_DIA: 128,
  NOTIFICAR_CIERRE_DE_TURNO: 129,
  VERIFICAR_ANEXO_SEGURIDAD: 130,
  LISTAR_REPORTES_GENERADOS: 131,
  GET_ANALISIS_GUARDADO: 132,
  GET_RECORRIDOS: 133,
  GET_RUTA: 134,
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/** Los anexos vienen como ruta relativa (`/tracker/attachments/file/...`); arma la URL completa. */
export const resolveAttachmentUrl = (url) => (url ? `${API_BASE_URL}${url}` : null);

/** Igual que resolveAttachmentUrl, para los Excel de reporte ya generados. */
export const resolveReportFileUrl = (url) => (url ? `${API_BASE_URL}${url}` : null);

const unwrap = (res) => {
  const d = res?.data;
  if (d?.data?.data !== undefined) return d.data.data;
  if (Array.isArray(d?.data)) return d.data;
  return d;
};

const trackerService = {
  getAllUnidades: async () => unwrap(await executeTransaction(TX.GET_ALL_UNIDADES, {})),
  createUnidad: async (data) => unwrap(await executeTransaction(TX.CREATE_UNIDAD, data)),
  updateUnidad: async (id, data) => unwrap(await executeTransaction(TX.UPDATE_UNIDAD, { id, ...data })),
  deleteUnidad: async (id) => unwrap(await executeTransaction(TX.DELETE_UNIDAD, { id })),

  /** Última lectura conocida por unidad (tabla que alimenta el reporte de turno). */
  getLatestSnapshots: async () => unwrap(await executeTransaction(TX.GET_LATEST_SNAPSHOTS, {})),

  /** Dispara una consulta real a la API de Foresight GPS y guarda el resultado. */
  syncNow: async () => unwrap(await executeTransaction(TX.SYNC_NOW, {})),

  /** Historial de alertas (fuera de horario / fuera de zona). */
  getRecentAlerts: async () => unwrap(await executeTransaction(TX.GET_RECENT_ALERTS, {})),

  /**
   * Reporte de turno (mismo formato del Excel manual): toma la última
   * lectura de cada unidad dentro de la ventana del turno.
   * @param {{fecha?: string, turno: 'MATUTINO'|'VESPERTINO'|'NOCTURNO'}} params
   */
  generarReporte: async ({ fecha, turno }) => unwrap(await executeTransaction(TX.GENERAR_REPORTE, { fecha, turno })),

  /** Resume a permanente y purga el detalle crudo más viejo que la retención configurada. */
  archivarAhora: async () => unwrap(await executeTransaction(TX.ARCHIVAR_AHORA, {})),

  /**
   * Análisis operativo y comportamiento de conductores del día (viajes,
   * distancia, ralentí) -- llama a la API de Foresight por cada unidad
   * registrada, puede tardar 1-2 minutos con toda la flota.
   */
  getAnalisisDelDia: async ({ fecha } = {}) => unwrap(await executeTransaction(TX.GET_ANALISIS_DEL_DIA, { fecha })),

  /** Trae el análisis ya calculado y guardado de una fecha (sin volver a consultar la API). Devuelve null si aún no se ha generado. */
  getAnalisisGuardado: async ({ fecha } = {}) => unwrap(await executeTransaction(TX.GET_ANALISIS_GUARDADO, { fecha })),

  /**
   * Envía por Telegram el resumen de cierre de un turno (esto ya corre solo
   * a las 9:05am/2:05pm/9:05pm). `enVivo: true` es lo que usa el botón
   * "Generar ahora": sincroniza primero y usa la última lectura de cada
   * unidad, para poder generarlo a cualquier hora del día (no solo dentro
   * de la ventana fija de 1 hora del turno).
   */
  notificarCierreDeTurno: async ({ fecha, turno, enVivo }) => unwrap(await executeTransaction(TX.NOTIFICAR_CIERRE_DE_TURNO, { fecha, turno, enVivo })),

  /** Envía por Telegram un recordatorio si falta subir el PDF de seguridad del día. */
  verificarAnexoSeguridad: async ({ fecha } = {}) => unwrap(await executeTransaction(TX.VERIFICAR_ANEXO_SEGURIDAD, { fecha })),

  /**
   * Historial de reportes de turno generados automáticamente (uno por
   * fecha+turno al cerrarse cada turno), listos para descargar en un clic.
   */
  listarReportesGenerados: async ({ limit } = {}) => unwrap(await executeTransaction(TX.LISTAR_REPORTES_GENERADOS, { limit })),

  /**
   * Recorridos (viajes) de una unidad en un día: lista de viajes con
   * salida/llegada/duración/distancia, más los totales del día (número de
   * recorridos, primera salida, última llegada, km y horas en
   * movimiento/estacionado). `gps_unit_id` es el ID interno de la
   * plataforma GPS (snapshot.gps_unit_id), no el id de tracker_unit.
   * `desde` (opcional, ISO con offset) acota el inicio a partir de ese
   * momento en vez del inicio del día -- se usa al abrir Recorridos desde
   * una alerta, para ver solo lo que pasó después de que se disparó.
   */
  getRecorridos: async ({ gps_unit_id, fecha, desde } = {}) => unwrap(await executeTransaction(TX.GET_RECORRIDOS, { gps_unit_id, fecha, desde })),

  /** Puntos GPS de un viaje puntual, para dibujar la ruta en el mapa. */
  getRuta: async ({ gps_unit_id, startdate, enddate } = {}) => unwrap(await executeTransaction(TX.GET_RUTA, { gps_unit_id, startdate, enddate })),

  // ---------- Anexos del reporte diario (fuera del dispatcher, multipart real) ----------

  getAttachments(fecha) {
    return api.get("/tracker/attachments", { params: { fecha, profile: getCurrentProfile() } }).then((res) => res?.data?.data || []);
  },
  uploadAttachment({ fecha, tipo, file }) {
    const formData = new FormData();
    formData.append("fecha", fecha);
    formData.append("tipo", tipo);
    formData.append("profile", getCurrentProfile());
    formData.append("file", file);
    return api
      .post("/tracker/attachments", formData, { headers: { "Content-Type": undefined } })
      .then((res) => res?.data?.data);
  },
  deleteAttachment(id) {
    return api.delete(`/tracker/attachments/${id}`, { params: { profile: getCurrentProfile() } });
  },
};

export default trackerService;
