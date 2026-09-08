import api, { executeTransaction, getCurrentProfile } from "./api";

// Ids reales verificados contra la BD compartida tras mezclar con Fuel.Reporte
// (tx 118, ya existente) -- todo se corrió +1 respecto a la rama original
// (ver INTEGRACION_GPS_FORESIGHT.md / notas de merge del 08/09/2026).
const TX = {
  CREATE_UNIDAD: 119,
  GET_ALL_UNIDADES: 120,
  GET_UNIDAD_BY_ID: 121,
  UPDATE_UNIDAD: 122,
  DELETE_UNIDAD: 123,
  GET_LATEST_SNAPSHOTS: 124,
  SYNC_NOW: 125,
  GET_RECENT_ALERTS: 126,
  GENERAR_REPORTE: 127,
  ARCHIVAR_AHORA: 128,
  GET_ANALISIS_DEL_DIA: 129,
  NOTIFICAR_CIERRE_DE_TURNO: 130,
  VERIFICAR_ANEXO_SEGURIDAD: 131,
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/** Los anexos vienen como ruta relativa (`/tracker/attachments/file/...`); arma la URL completa. */
export const resolveAttachmentUrl = (url) => (url ? `${API_BASE_URL}${url}` : null);

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

  /** Envía por Telegram el resumen de cierre de un turno (esto ya corre solo, este método es para probarlo a mano). */
  notificarCierreDeTurno: async ({ fecha, turno }) => unwrap(await executeTransaction(TX.NOTIFICAR_CIERRE_DE_TURNO, { fecha, turno })),

  /** Envía por Telegram un recordatorio si falta subir el PDF de seguridad del día. */
  verificarAnexoSeguridad: async ({ fecha } = {}) => unwrap(await executeTransaction(TX.VERIFICAR_ANEXO_SEGURIDAD, { fecha })),

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
