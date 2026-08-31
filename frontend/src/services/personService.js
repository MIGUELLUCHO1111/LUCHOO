import { executeTransaction } from "./api";

// El dispatcher envuelve una vez ({statusCode,data,message}) y algunos BO
// devuelven ese mismo envoltorio de nuevo (otros, como createPerson, la fila
// cruda). Bajamos un nivel más solo cuando hace falta.
const unwrap = (res) => {
  const d = res?.data;
  const inner = d?.data;
  if (inner && typeof inner === "object" && !Array.isArray(inner) && inner.data !== undefined) {
    return inner.data;
  }
  return inner;
};

/** Generates an internal document_id (the user does not type a DNI). */
const generateDocumentId = () =>
  `PER-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString().slice(-4)}`;

/**
 * Persons service (Security -> Persons).
 * A person has: first name, last name, job title (degree) and department.
 * The document_id is auto-generated (the DB requires it NOT NULL).
 *
 * Transactions (Security/Person, todas activas):
 * create: 1 / getAll: 91 / getById: 92 / update: 93 / delete: 94
 */
const personService = {
  create({ first_name, last_name, degree, department }) {
    const payload = {
      ci: generateDocumentId(),
      name: first_name,
      lastname: last_name,
      degree: degree || null,
      department: department || null,
      phone: null,
      address: null,
    };
    return executeTransaction(1, payload).then(unwrap);
  },

  getAll() {
    return executeTransaction(91, {}).then(unwrap);
  },

  getById(id) {
    return executeTransaction(92, { id }).then(unwrap);
  },

  update(id, { first_name, last_name, degree, department }) {
    return executeTransaction(93, {
      id,
      name: first_name,
      lastname: last_name,
      degree: degree || null,
      department: department || null,
    }).then(unwrap);
  },

  delete(id) {
    return executeTransaction(94, { id }).then(unwrap);
  },
};

export default personService;