import api, { executeTransaction, getCurrentProfile } from "./api";

import { API_BASE_URL } from "./apiBase";

/** Las evidencias vienen como ruta relativa (/maintenance/files/file/...); se pide con el perfil. */
export const resolveMntFileUrl = (url) => (url ? `${API_BASE_URL}${url}?profile=${encodeURIComponent(getCurrentProfile() || "")}` : null);

// Mantenimiento (062_maintenance.sql). Los números son los ids de
// backend/config/permission.csv (rango reservado 250-299, acordado 30/09/2026).
const TX = {
  LISTAR_ORDENES: 250,
  OBTENER_ORDEN: 251,
  CREAR_ORDEN: 252,
  ACTUALIZAR_ORDEN: 253,
  APROBAR_ORDEN: 254,
  RECHAZAR_ORDEN: 255,
  REGULARIZAR_ORDEN: 256,
  INICIAR_ORDEN: 257,
  PAUSAR_ORDEN: 258,
  REANUDAR_ORDEN: 259,
  EJECUTAR_ORDEN: 260,
  CERRAR_ORDEN: 261,
  ANULAR_ORDEN: 262,
  AGREGAR_TAREA: 263,
  MARCAR_TAREA: 264,
  ELIMINAR_TAREA: 265,
  AGREGAR_REPUESTO: 266,
  ELIMINAR_REPUESTO: 267,
  LISTAR_INCIDENCIAS: 268,
  CREAR_INCIDENCIA: 269,
  ACTUALIZAR_INCIDENCIA: 270,
  DESCARTAR_INCIDENCIA: 271,
  LISTAR_UNIDADES: 272,
  LISTAR_CRITICIDAD: 273,
  GUARDAR_CRITICIDAD: 274,
  GET_AJUSTES: 275,
  GUARDAR_AJUSTES: 276,
  // Segunda entrega (063): plan preventivo y catálogos.
  LISTAR_VENCIMIENTOS: 277,
  LISTAR_PLANES: 278,
  GUARDAR_PLAN: 279,
  ARCHIVAR_PLAN: 280,
  REGISTRAR_ULTIMO_SERVICIO: 281,
  CREAR_ORDEN_PREVENTIVA: 282,
  LISTAR_SERVICIOS: 283,
  GUARDAR_SERVICIO: 284,
  ARCHIVAR_SERVICIO: 285,
  LISTAR_PROVEEDORES: 286,
  GUARDAR_PROVEEDOR: 287,
  ARCHIVAR_PROVEEDOR: 288,
};

const unwrap = (res) => {
  const d = res?.data;
  if (d?.data?.data !== undefined) return d.data.data;
  if (d?.data !== undefined) return d.data;
  return d;
};

// El dispatcher responde 200 aunque el método falle (el código real va en el
// cuerpo): se convierte en error para que la pantalla muestre el mensaje.
const toError = (d) => {
  const err = new Error(d.message || "No se pudo completar la operación");
  err.status = d.statusCode;
  return err;
};

const call = async (tx, data = {}) => {
  let res;
  try {
    res = await executeTransaction(tx, data);
  } catch (e) {
    if (e.response?.data?.message) throw toError(e.response.data);
    throw e;
  }
  const code = res?.data?.statusCode;
  if (code && code >= 400) throw toError(res.data);
  return unwrap(res);
};

const maintenanceService = {
  // Órdenes de trabajo
  listarOrdenes: (unit_id) => call(TX.LISTAR_ORDENES, unit_id ? { unit_id } : {}),
  obtenerOrden: (id) => call(TX.OBTENER_ORDEN, { id }),
  crearOrden: (data) => call(TX.CREAR_ORDEN, data),
  actualizarOrden: (id, campos) => call(TX.ACTUALIZAR_ORDEN, { id, ...campos }),
  aprobarOrden: (id, role, note) => call(TX.APROBAR_ORDEN, { id, role, note }),
  rechazarOrden: (id, reason) => call(TX.RECHAZAR_ORDEN, { id, reason }),
  regularizarOrden: (id, note) => call(TX.REGULARIZAR_ORDEN, { id, note }),
  iniciarOrden: (id, technician) => call(TX.INICIAR_ORDEN, { id, technician }),
  pausarOrden: (id, note) => call(TX.PAUSAR_ORDEN, { id, note }),
  reanudarOrden: (id, note) => call(TX.REANUDAR_ORDEN, { id, note }),
  ejecutarOrden: (id, campos) => call(TX.EJECUTAR_ORDEN, { id, ...campos }),
  cerrarOrden: (id, campos) => call(TX.CERRAR_ORDEN, { id, ...campos }),
  anularOrden: (id, reason) => call(TX.ANULAR_ORDEN, { id, reason }),
  agregarTarea: (id, description) => call(TX.AGREGAR_TAREA, { id, description }),
  marcarTarea: (id, task_id, done) => call(TX.MARCAR_TAREA, { id, task_id, done }),
  eliminarTarea: (id, task_id) => call(TX.ELIMINAR_TAREA, { id, task_id }),
  agregarRepuesto: (id, repuesto) => call(TX.AGREGAR_REPUESTO, { id, ...repuesto }),
  eliminarRepuesto: (id, part_id) => call(TX.ELIMINAR_REPUESTO, { id, part_id }),
  // Incidencias
  listarIncidencias: (unit_id) => call(TX.LISTAR_INCIDENCIAS, unit_id ? { unit_id } : {}),
  crearIncidencia: (data) => call(TX.CREAR_INCIDENCIA, data),
  actualizarIncidencia: (id, campos) => call(TX.ACTUALIZAR_INCIDENCIA, { id, ...campos }),
  descartarIncidencia: (id, reason) => call(TX.DESCARTAR_INCIDENCIA, { id, reason }),
  listarUnidades: () => call(TX.LISTAR_UNIDADES),
  // Criticidad y ajustes
  listarCriticidad: () => call(TX.LISTAR_CRITICIDAD),
  guardarCriticidad: (unit_id, level, note) => call(TX.GUARDAR_CRITICIDAD, { unit_id, level, note }),
  getAjustes: () => call(TX.GET_AJUSTES),
  guardarAjustes: (ajustes) => call(TX.GUARDAR_AJUSTES, { ajustes }),
  // Plan preventivo
  listarVencimientos: () => call(TX.LISTAR_VENCIMIENTOS),
  listarPlanes: () => call(TX.LISTAR_PLANES),
  guardarPlan: (plan) => call(TX.GUARDAR_PLAN, plan),
  archivarPlan: (id, active) => call(TX.ARCHIVAR_PLAN, { id, active }),
  registrarUltimoServicio: (data) => call(TX.REGISTRAR_ULTIMO_SERVICIO, data),
  crearOrdenPreventiva: (unit_id, plan_id) => call(TX.CREAR_ORDEN_PREVENTIVA, { unit_id, plan_id }),
  // Catálogos
  listarServicios: () => call(TX.LISTAR_SERVICIOS),
  guardarServicio: (s) => call(TX.GUARDAR_SERVICIO, s),
  archivarServicio: (id, active) => call(TX.ARCHIVAR_SERVICIO, { id, active }),
  listarProveedores: () => call(TX.LISTAR_PROVEEDORES),
  guardarProveedor: (p) => call(TX.GUARDAR_PROVEEDOR, p),
  archivarProveedor: (id, active) => call(TX.ARCHIVAR_PROVEEDOR, { id, active }),
  // Evidencias (ruta multipart fuera del dispatcher)
  async subirEvidencia(work_order_id, file) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("work_order_id", String(work_order_id));
    fd.append("profile", getCurrentProfile() || "");
    try {
      const res = await api.post("/maintenance/files", fd, { headers: { "Content-Type": "multipart/form-data" } });
      return res.data?.data;
    } catch (e) {
      throw new Error(e.response?.data?.message || e.message);
    }
  },
  async eliminarEvidencia(id) {
    try {
      await api.delete(`/maintenance/files/${id}`, { params: { profile: getCurrentProfile() } });
    } catch (e) {
      throw new Error(e.response?.data?.message || e.message);
    }
  },
};

export default maintenanceService;
