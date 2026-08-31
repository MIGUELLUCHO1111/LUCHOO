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
 * Servicio de Perfiles / Roles (seguridad → perfiles).
 * Gestiona los roles y su asignación a usuarios (user_profile).
 *
 * Transacciones (Security/Profile, todas activas). El id real de cada
 * transacción lo asigna Postgres por orden de inserción (no por el número
 * escrito en permission.csv), así que estos valores están verificados
 * directamente contra la tabla `transaction`:
 * create: 2 / assign: 3 / getByName: 4
 * getAll: 95 / getById: 96 / update: 97 / delete: 98 / remove: 99 / getByUser: 100
 */
const profileService = {
  create({ name, description }) {
    return executeTransaction(2, { profile_name: name, description }).then(unwrap);
  },

  getByName(name) {
    return executeTransaction(4, { profile_name: name }).then(unwrap);
  },

  assignToUser(user_id, profile_id) {
    return executeTransaction(3, { user_id, profile_id }).then(unwrap);
  },

  getAll() {
    return executeTransaction(95, {}).then(unwrap);
  },

  getById(id) {
    return executeTransaction(96, { id }).then(unwrap);
  },

  update(id, data) {
    return executeTransaction(97, { id, ...data }).then(unwrap);
  },

  delete(id) {
    return executeTransaction(98, { id }).then(unwrap);
  },

  removeFromUser(user_id, profile_id) {
    return executeTransaction(99, { user_id, profile_id }).then(unwrap);
  },

  getProfilesByUser(user_id) {
    return executeTransaction(100, { user_id }).then(unwrap);
  },
};

export default profileService;