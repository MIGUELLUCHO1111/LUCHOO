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
 * Deriva el usuario de acceso a partir de nombre + apellido (login = `name`).
 * Exportado para que la UI pueda mostrarle al admin, antes de guardar, con
 * qu\u00e9 usuario va a poder entrar la persona que est\u00e1 registrando.
 */
export const generateUsername = (first_name, last_name) =>
  `${first_name}${last_name}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

/**
 * Users service (Security -> Users).
 * A user has: first name, last name, business email and role (profile).
 * The admin types the password on registration; the backend hashes it.
 *
 * Transactions (Security/User, todas activas):
 * create 31 / getById 32 / getByEmail 33 / getAll 34 / update 35 / delete 36
 */
const userService = {
  create({ name, first_name, last_name, email, password, profile_id, is_active }) {
    const payload = {
      name: name?.trim() || generateUsername(first_name, last_name),
      first_name,
      last_name,
      email,
      password,
      profile_id: profile_id ? Number(profile_id) : null,
      is_active: is_active !== false,
    };
    return executeTransaction(31, payload).then(unwrap);
  },

  getAll() {
    return executeTransaction(34, {}).then(unwrap);
  },

  getById(id) {
    return executeTransaction(32, { id }).then(unwrap);
  },

  getByEmail(email) {
    return executeTransaction(33, { email }).then(unwrap);
  },

  update(id, data) {
    return executeTransaction(35, { id, ...data }).then(unwrap);
  },

  delete(id) {
    return executeTransaction(36, { id }).then(unwrap);
  },
};

export default userService;