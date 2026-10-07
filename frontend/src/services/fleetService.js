import { API_BASE_URL } from "./apiBase";
import api, { executeTransaction, getCurrentProfile } from "./api";

// Flota -> Fichas de Vehiculos. Los numeros son los ids de
// backend/config/permission.csv (unica fuente de verdad, 167-176).
const TX = {
  LISTAR: 167,
  OBTENER: 168,
  GUARDAR: 169,
  GUARDAR_DOCUMENTO: 170,
  ELIMINAR_DOCUMENTO: 171,
  REGISTRAR_SERVICIO: 172,
  ELIMINAR_SERVICIO: 173,
  AGREGAR_NOTA: 174,
  GET_AJUSTES: 175,
  GUARDAR_AJUSTES: 176,
  CATALOGO_LISTAR: 177,
  CATALOGO_GUARDAR_MODELO: 178,
  CATALOGO_ARCHIVAR_MODELO: 179,
  CATALOGO_ASIGNAR_UNIDADES: 180,
  CATALOGO_QUITAR_UNIDAD: 181,
  CATALOGO_GUARDAR_FAMILIA: 182,
  CATALOGO_ELIMINAR_FAMILIA: 183,
  // Rango reservado para Flota: 200-249 (acordado con Julio, 30/09/2026).
  ENCARGADOS_LISTAR: 200,
  ENCARGADO_ASIGNAR: 201,
  ENCARGADO_QUITAR: 202,
  MODELO_PROPONER: 203,
  MODELO_APROBAR: 204,
  MODELO_RECHAZAR: 205,
  LECTURA_REGISTRAR: 206,
  LECTURA_REEMPLAZO: 207,
  LECTURA_ANULAR: 208,
  CREAR_UNIDAD: 209,
  ASIGNAR_FRENTE: 210,
  LISTAR_FRENTES: 211,
  CONDUCTORES_LISTAR: 212,
  CONDUCTOR_GUARDAR: 213,
  CONDUCTOR_ELIMINAR: 214,
  CONDUCTOR_ASIGNAR: 215,
  CONDUCTOR_OBTENER: 216,
};

// Direccion del backend: ver apiBase.js (red de la oficina, 07/10/2026).

/** Las fotos del catálogo vienen como ruta relativa (/fleet/models/file/...). */
export const resolveFleetFileUrl = (url) => (url ? `${API_BASE_URL}${url}` : null);

const unwrap = (res) => {
  const d = res?.data;
  if (d?.data?.data !== undefined) return d.data.data;
  if (d?.data !== undefined) return d.data;
  return d;
};

// El dispatcher responde 200 aunque el metodo falle (el codigo real va en el
// cuerpo): se convierte en error para que la pantalla lo muestre.
const toError = (d) => {
  const err = new Error(d.message || "No se pudo completar la operación");
  err.status = d.statusCode;
  err.detail = d.error; // ej. { duplicado_id } cuando el modelo ya existe
  return err;
};

const call = async (tx, data = {}) => {
  let res;
  try {
    res = await executeTransaction(tx, data);
  } catch (e) {
    // El backend responde 4xx con el mensaje real del error de negocio.
    if (e.response?.data?.message) throw toError(e.response.data);
    throw e;
  }
  const code = res?.data?.statusCode;
  if (code && code >= 400) throw toError(res.data);
  return unwrap(res);
};

const fleetService = {
  listar: () => call(TX.LISTAR),
  obtener: (id) => call(TX.OBTENER, { id }),
  guardar: (id, campos) => call(TX.GUARDAR, { id, ...campos }),
  guardarDocumento: (unit_id, doc) => call(TX.GUARDAR_DOCUMENTO, { unit_id, ...doc }),
  eliminarDocumento: (id) => call(TX.ELIMINAR_DOCUMENTO, { id }),
  registrarServicio: (unit_id, svc) => call(TX.REGISTRAR_SERVICIO, { unit_id, ...svc }),
  eliminarServicio: (id) => call(TX.ELIMINAR_SERVICIO, { id }),
  agregarNota: (unit_id, texto) => call(TX.AGREGAR_NOTA, { unit_id, texto }),
  getAjustes: () => call(TX.GET_AJUSTES),
  guardarAjustes: (ajustes) => call(TX.GUARDAR_AJUSTES, ajustes),

  /** Adjunta el archivo (PDF o foto) de un documento ya creado. */
  subirArchivoDocumento: async (documentId, file) => {
    const formData = new FormData();
    formData.append("document_id", documentId);
    formData.append("profile", getCurrentProfile());
    formData.append("file", file);
    const res = await api.post("/fleet/documents/file", formData, { headers: { "Content-Type": undefined } });
    return res?.data?.data;
  },

  // Catálogo de modelos (marca -> modelo -> versión, con foto)
  catalogo: () => call(TX.CATALOGO_LISTAR),
  guardarModelo: (modelo) => call(TX.CATALOGO_GUARDAR_MODELO, modelo),
  archivarModelo: (id) => call(TX.CATALOGO_ARCHIVAR_MODELO, { id }),
  asignarUnidades: (model_id, unit_ids, version_id = null) => call(TX.CATALOGO_ASIGNAR_UNIDADES, { model_id, unit_ids, version_id }),
  quitarModeloDeUnidad: (unit_id) => call(TX.CATALOGO_QUITAR_UNIDAD, { unit_id }),
  guardarFamilia: (familia) => call(TX.CATALOGO_GUARDAR_FAMILIA, familia),
  eliminarFamilia: (code) => call(TX.CATALOGO_ELIMINAR_FAMILIA, { code }),

  // Encargados de unidad (solo admin)
  listarEncargados: () => call(TX.ENCARGADOS_LISTAR),
  asignarEncargado: (unit_ids, user_id) => call(TX.ENCARGADO_ASIGNAR, { unit_ids, user_id }),
  quitarEncargado: (unit_id) => call(TX.ENCARGADO_QUITAR, { unit_id }),

  // Modelos propuestos por los encargados (quedan pendientes hasta que un admin los revisa)
  proponerModelo: (modelo) => call(TX.MODELO_PROPONER, modelo),
  aprobarModelo: (id) => call(TX.MODELO_APROBAR, { id }),
  rechazarModelo: (id, { nota, fusionar_con_id } = {}) => call(TX.MODELO_RECHAZAR, { id, nota, fusionar_con_id }),

  // Historial de lecturas de odometro/horometro (no se editan, se vuelven a leer)
  registrarLectura: (unit_id, lectura) => call(TX.LECTURA_REGISTRAR, { unit_id, ...lectura }),
  reemplazarMedidor: (unit_id, lectura) => call(TX.LECTURA_REEMPLAZO, { unit_id, ...lectura }),
  anularLectura: (id, reason) => call(TX.LECTURA_ANULAR, { id, reason }),
  /** Alta manual de una unidad (solo admin): unico lugar donde se crean a mano. */
  crearUnidad: (unidad) => call(TX.CREAR_UNIDAD, unidad),

  // Frente / contrato / sitio de la unidad (frente vacio = quitar)
  asignarFrente: (unit_id, datos) => call(TX.ASIGNAR_FRENTE, { unit_id, ...datos }),
  listarFrentes: () => call(TX.LISTAR_FRENTES),

  // Conductores (registro y asignacion a unidades)
  listarConductores: () => call(TX.CONDUCTORES_LISTAR),
  obtenerConductor: (id) => call(TX.CONDUCTOR_OBTENER, { id }),
  guardarConductor: (conductor) => call(TX.CONDUCTOR_GUARDAR, conductor),
  eliminarConductor: (id) => call(TX.CONDUCTOR_ELIMINAR, { id }),
  asignarConductor: (unit_id, driver_id) => call(TX.CONDUCTOR_ASIGNAR, { unit_id, driver_id: driver_id || null }),
  /** Licencia de conducir o carta medica (kind = "licencia" | "medico"): foto o PDF. */
  subirDocumentoConductor: async (driverId, kind, file) => {
    const formData = new FormData();
    formData.append("driver_id", driverId);
    formData.append("kind", kind);
    formData.append("profile", getCurrentProfile());
    formData.append("file", file);
    const res = await api.post("/fleet/drivers/document", formData, { headers: { "Content-Type": undefined } });
    return res?.data?.data;
  },
  subirFotoConductor: async (driverId, file) => {
    const formData = new FormData();
    formData.append("driver_id", driverId);
    formData.append("profile", getCurrentProfile());
    formData.append("photo", file);
    const res = await api.post("/fleet/drivers/photo", formData, { headers: { "Content-Type": undefined } });
    return res?.data?.data;
  },
  /** Foto propia de una unidad (se ve en su ficha y en la lista). */
  subirFotoUnidad: async (unitId, file) => {
    const formData = new FormData();
    formData.append("unit_id", unitId);
    formData.append("profile", getCurrentProfile());
    formData.append("photo", file);
    const res = await api.post("/fleet/units/photo", formData, { headers: { "Content-Type": undefined } });
    return res?.data?.data;
  },
  quitarFotoUnidad: async (unitId) => {
    const res = await api.delete("/fleet/units/photo", { params: { unit_id: unitId, profile: getCurrentProfile() } });
    return res?.data?.data;
  },
  subirFotoModelo: async (modelId, file) => {
    const formData = new FormData();
    formData.append("model_id", modelId);
    formData.append("profile", getCurrentProfile());
    formData.append("photo", file);
    const res = await api.post("/fleet/models/photo", formData, { headers: { "Content-Type": undefined } });
    return res?.data?.data;
  },
};

export default fleetService;
