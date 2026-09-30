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
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

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
const call = async (tx, data = {}) => {
  const res = await executeTransaction(tx, data);
  const code = res?.data?.statusCode;
  if (code && code >= 400) throw new Error(res.data.message || "No se pudo completar la operación");
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

  // Catálogo de modelos (marca -> modelo -> versión, con foto)
  catalogo: () => call(TX.CATALOGO_LISTAR),
  guardarModelo: (modelo) => call(TX.CATALOGO_GUARDAR_MODELO, modelo),
  archivarModelo: (id) => call(TX.CATALOGO_ARCHIVAR_MODELO, { id }),
  asignarUnidades: (model_id, unit_ids, version_id = null) => call(TX.CATALOGO_ASIGNAR_UNIDADES, { model_id, unit_ids, version_id }),
  quitarModeloDeUnidad: (unit_id) => call(TX.CATALOGO_QUITAR_UNIDAD, { unit_id }),
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
