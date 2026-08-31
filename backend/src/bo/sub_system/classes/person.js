import DBMS from '../../../dbms/dbms.js';
import Utils from '../../../utils/utils.js';
import Config from '../../../../config/config.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

export class Person {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  createPerson = async (data = {}) => {
    const { ci, name, lastname, phone = null, address = null } = data;

    if (!ci || !name || !lastname) {
      throw new Error(
        JSON.stringify({
          message: "Campos requeridos: 'ci', 'name', 'lastname'",
          statusCode: STATUS_CODES.BAD_REQUEST,
        }),
      );
    }

    await this.dbmsReady;

    try {
      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'createPerson',
        params: { ci, name, lastname, phone, address },
      });
      return result.rows[0];
    } catch (error) {
      const { code, detail } = extractDbError(error);

      if (code === '23505' || /Ya existe la llave/i.test(detail || '')) {
        throw new Error(
          JSON.stringify({
            message: `Ya existe una persona con la cédula '${ci}'`,
            statusCode: STATUS_CODES.CONFLICT,
          }),
        );
      }

      throw error;
    }
  };
}

function extractDbError(error, depth = 0) {
  if (!error || typeof error !== 'object' || depth > 6) return {};

  let { code, detail } = error;
  if (code) return { code, detail };

  // El DBMS anida el error original como JSON string dentro de .message
  if (typeof error.message === 'string' && error.message.trimStart().startsWith('{')) {
    try {
      const inner = extractDbError(JSON.parse(error.message), depth + 1);
      if (inner.code) return inner;
    } catch (_) {
      /* mensaje no estructurado */
    }
  }

  // ... o como objeto dentro de .error
  if (error.error) {
    const inner = extractDbError(error.error, depth + 1);
    if (inner.code) return inner;
  }

  return { code, detail };
}
