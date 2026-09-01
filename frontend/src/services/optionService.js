import { executeTransaction } from "./api";

// El dispatcher envuelve una vez ({statusCode,data,message}) y el BO devuelve
// ese mismo envoltorio de nuevo. Bajamos un nivel más solo cuando hace falta.
const unwrap = (res) => {
  const d = res?.data;
  const inner = d?.data;
  if (inner && typeof inner === "object" && !Array.isArray(inner) && inner.data !== undefined) {
    return inner.data;
  }
  return inner;
};

/**
 * Servicio de Secciones (Security/Option): qué páginas puede ver cada perfil.
 * Transacciones: getAll: 101 / getByProfile: 102 / assign: 103 / remove: 104
 */
const optionService = {
  getAll() {
    return executeTransaction(101, {}).then(unwrap);
  },

  getByProfile(profile_id) {
    return executeTransaction(102, { profile_id }).then(unwrap);
  },

  assignToProfile(option_id, profile_id) {
    return executeTransaction(103, { option_id, profile_id }).then(unwrap);
  },

  removeFromProfile(option_id, profile_id) {
    return executeTransaction(104, { option_id, profile_id }).then(unwrap);
  },
};

export default optionService;
