import { executeTransaction } from "./api";

const unwrap = (res) => {
  const d = res?.data;
  const payload = d?.data !== undefined ? d.data : d;
  return payload;
};

/**
 * Derives a unique username from first + last name (current login = `name`).
 */
const generateUsername = (first_name, last_name) =>
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
 * Transactions (present in permission.csv, BO pending):
 * create 31 / getById 32 / getByEmail 33 / getAll 34 / update 35 / delete 36
 */
const userService = {
  create({ first_name, last_name, email, password, profile_id, is_active }) {
    const payload = {
      name: generateUsername(first_name, last_name),
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