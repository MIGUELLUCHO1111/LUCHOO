import { executeTransaction } from "./api";

// Seguridad > Actividad de usuarios (066). Transacciones 195 y 196.
const TX = {
  LISTAR_ACTIVIDAD_USUARIOS: 195,
  OBTENER_ACTIVIDAD_USUARIO: 196,
};

const unwrap = (res) => {
  const d = res?.data;
  if (d?.data?.data !== undefined) return d.data.data;
  return d?.data ?? d;
};

const activityService = {
  listarUsuarios() {
    return executeTransaction(TX.LISTAR_ACTIVIDAD_USUARIOS, {}).then(unwrap);
  },
  detalleUsuario(user_id, days = 14) {
    return executeTransaction(TX.OBTENER_ACTIVIDAD_USUARIO, { user_id, days }).then(unwrap);
  },
};

export default activityService;
