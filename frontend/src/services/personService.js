import { executeTransaction } from "./api";

const unwrap = (res) => {
  const d = res?.data;
  const payload = d?.data !== undefined ? d.data : d;
  return payload;
};

/** Generates an internal document_id (the user does not type a DNI). */
const generateDocumentId = () =>
  `PER-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString().slice(-4)}`;

/**
 * Persons service (Security -> Persons).
 * A person has: first name, last name, job title (degree) and department.
 * The document_id is auto-generated (the DB requires it NOT NULL).
 *
 * Transactions:
 * - create:   1  `Security/Person/createPerson`   (live in backend)
 * - getAll:  91  `Security/Persona/getAllPersonas` (pending)
 * - getById: 92  `Security/Persona/getPersonaById` (pending)
 * - update:  93  `Security/Persona/updatePersona`  (pending)
 * - delete:  94  `Security/Persona/deletePersona`  (pending)
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