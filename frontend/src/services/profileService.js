import { executeTransaction } from "./api";

const unwrap = (res) => {
  const d = res?.data;
  const payload = d?.data !== undefined ? d.data : d;
  return payload;
};

/**
 * Servicio de Perfiles / Roles (seguridad → perfiles).
 * Gestiona los roles y su asignación a usuarios (user_profile).
 *
 * Transacciones:
 * - create:  2  `Security/Profile/createProfile`       (activa; solo nombre hoy)
 * - getByName: 4 `Security/Profile/getProfileByName`   (activa)
 * - assign:  3  `Security/Profile/assignProfileToUser` (activa)
 * - getAll: 101 (propuesta) / update: 102 / delete: 103 / remove: 104 / getUser: 105
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
    return executeTransaction(101, {}).then(unwrap);
  },

  getById(id) {
    return executeTransaction(102, { id }).then(unwrap);
  },

  update(id, data) {
    return executeTransaction(102, { id, ...data }).then(unwrap);
  },

  delete(id) {
    return executeTransaction(103, { id }).then(unwrap);
  },

  removeFromUser(user_id, profile_id) {
    return executeTransaction(104, { user_id, profile_id }).then(unwrap);
  },

  getProfilesByUser(user_id) {
    return executeTransaction(105, { user_id }).then(unwrap);
  },
};

export default profileService;