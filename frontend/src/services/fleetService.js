import { executeTransaction } from "./api";

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
};

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
};

export default fleetService;
