import pool from '../../config/db.js';
import Config from '../../config/config.js';
import Utils from '../utils/utils.js';
import Formatter from '../formatter/formatter.js';
import Debugger from '../debugger/debugger.js';

export default class DBMS {
  constructor(validatorInstance = null) {
    this.utils = new Utils();
    this.config = new Config();
    this.validator = validatorInstance;
    this.formatter = new Formatter();
    this.dbgr = new Debugger();

    if (!DBMS.instance) {
      this.pool = pool;
      this.STATUS_CODES = new Config().STATUS_CODES;

      DBMS.instance = this;
    }
    return DBMS.instance;
  }

  async init() {
    this.queries = await this.config.getQueries();
  }

  async connection() {
    const activePool = this.pool || pool;
    return await activePool
      .connect()
      .then((cli) => cli)
      .catch((err) => {
        this.utils.handleError({
          message: 'Error de conexión al cliente de base de datos',
          statusCode: this.STATUS_CODES.DB_ERROR,
          error: err,
        });
      });
  }

  disconnection(client) {
    if (!client) {
      this.utils.handleError({
        message: 'No se proporcionó cliente para la desconexión',
        statusCode: this.STATUS_CODES.BAD_REQUEST,
      });
      return;
    }

    try {
      client.release();
    } catch (err) {
      this.utils.handleError({
        message: 'Error cerrando la conexión del cliente a la base de datos',
        statusCode: this.STATUS_CODES.DB_ERROR,
        error: err,
      });
    }
  }

  async poolDisconnection() {
    try {
      const activePool = this.pool || pool;
      // Evitar finalizar más de una vez
      if (!activePool || activePool.ended || activePool.ending) {
        return;
      }
      await activePool.end();
      console.log('Pool de base de datos finalizado');
    } catch (err) {
      console.warn(
        'Advertencia al finalizar pool de base de datos:',
        err?.message || err,
      );
    }
  }

  async query(arg1, arg2) {
    // Compatibilidad: acepta (queryString, paramsArray) o ({ query, params })
    let queryString = null;
    let params = [];

    if (typeof arg1 === 'string') {
      queryString = arg1;
      params = Array.isArray(arg2) ? arg2 : [];
    } else if (arg1 && typeof arg1 === 'object') {
      queryString = arg1.query;
      params = Array.isArray(arg1.params) ? arg1.params : arg1.params || [];
    }

    if (!queryString) {
      this.utils.handleError({
        message: 'Client was passed a null or undefined query',
        statusCode: this.STATUS_CODES.DB_ERROR,
      });
      return;
    }

    const client = await this.connection();
    try {
      return await client.query(queryString, params);
    } catch (error) {
      // Global instrumentation: if a transaction-related unique violation occurs,
      // print detailed context to help locate the call-site.
      try {
        if (
          (error && error.code === '23505') ||
          (typeof queryString === 'string' &&
            queryString.includes('public."transaction"'))
        ) {
          const info = {
            code: error && error.code,
            detail: error && error.detail,
            message: error && error.message,
            query: queryString,
            params,
            stack: new Error().stack,
          };
          // suppressed debug output in normal runs
        }
      } catch (e) {}
      this.utils.handleError({
        message: error.message || 'Error ejecutando la consulta',
        statusCode: this.STATUS_CODES.DB_ERROR,
        error,
      });
    } finally {
      this.disconnection(client);
    }
  }
  //
  async executeNamedQuery({ nameQuery, params = [] }) {
    if (!this.queries || !this.queries[nameQuery]) {
      this.utils.handleError({
        message: `Consulta nombrada '${nameQuery}' no encontrada`,
        statusCode: this.STATUS_CODES.BAD_REQUEST,
      });
      return;
    }
    const queryDef = this.queries[nameQuery];

    // Compatibilidad retro: permitir string plano o el nuevo objeto { query, structure_params }
    const queryString =
      typeof queryDef === 'string' ? queryDef : queryDef.query;
    const structure =
      typeof queryDef === 'object' && queryDef.structure_params
        ? queryDef.structure_params
        : null;
    const orderArray =
      typeof queryDef === 'object' && Array.isArray(queryDef.orderArray)
        ? queryDef.orderArray
        : null;

    // Soporte de nuevo convenio: si structure_params es por campo (sin root), y llega objeto + orderArray,
    // validar y transformar a arreglo en el orden indicado.
    const isFieldSchema =
      structure && typeof structure === 'object' && !structure.root;
    const isObjectParams =
      params && !Array.isArray(params) && typeof params === 'object';
    if (isFieldSchema && orderArray !== null) {
      // Caso A: params es objeto -> validar y transformar a array ordenado
      if (isObjectParams) {
        if (
          this.validator &&
          typeof this.validator.validateStructuredData === 'function'
        ) {
          const errors = this.validator.validateStructuredData(
            params,
            structure,
          );
          if (errors && errors.length > 0) {
            this.utils.handleError({
              message: `Parámetros inválidos para '${nameQuery}': ${errors.join(
                '. ',
              )}`,
              statusCode: this.STATUS_CODES.BAD_REQUEST,
            });
            return;
          }
        }
        // Transformación usando Formatter
        params = this.formatter.formatObjectParams(
          params,
          orderArray,
          structure,
        );
      }
      // Caso B: params es array -> validar mapeándolo contra el esquema usando orderArray
      else if (Array.isArray(params)) {
        if (orderArray.length === 0 && params.length === 0) {
          // sin parámetros requeridos
        } else {
          if (params.length !== orderArray.length) {
            this.utils.handleError({
              message: `Cantidad de parámetros inválida para '${nameQuery}': se esperaban ${orderArray.length} y se recibieron ${params.length}`,
              statusCode: this.STATUS_CODES.BAD_REQUEST,
            });
            return;
          }
          const obj = {};
          orderArray.forEach((k, i) => (obj[k] = params[i]));
          if (
            this.validator &&
            typeof this.validator.validateStructuredData === 'function'
          ) {
            const errors = this.validator.validateStructuredData(
              obj,
              structure,
            );
            if (errors && errors.length > 0) {
              this.utils.handleError({
                message: `Parámetros inválidos para '${nameQuery}': ${errors.join(
                  '. ',
                )}`,
                statusCode: this.STATUS_CODES.BAD_REQUEST,
              });
              return;
            }
          }
        }
      }
      // Caso C: params primitivo y se espera 1 parámetro
      else if (
        orderArray.length === 1 &&
        (typeof params === 'string' ||
          typeof params === 'number' ||
          typeof params === 'boolean')
      ) {
        const obj = { [orderArray[0]]: params };
        if (
          this.validator &&
          typeof this.validator.validateStructuredData === 'function'
        ) {
          const errors = this.validator.validateStructuredData(obj, structure);
          if (errors && errors.length > 0) {
            this.utils.handleError({
              message: `Parámetros inválidos para '${nameQuery}': ${errors.join(
                '. ',
              )}`,
              statusCode: this.STATUS_CODES.BAD_REQUEST,
            });
            return;
          }
        }
        params = [params];
      }
      // Caso D: sin params
      else if (
        (params == null ||
          (typeof params === 'object' && Object.keys(params).length === 0)) &&
        orderArray.length === 0
      ) {
        params = [];
      } else if (
        (params == null || (Array.isArray(params) && params.length === 0)) &&
        orderArray.length > 0
      ) {
        this.utils.handleError({
          message: `Parámetros requeridos para '${nameQuery}' no fueron proporcionados`,
          statusCode: this.STATUS_CODES.BAD_REQUEST,
        });
        return;
      }
    } else if (
      // Validación retro: si hay root, validar params directamente
      structure &&
      this.validator &&
      typeof this.validator.validateStructuredData === 'function'
    ) {
      const errors = this.validator.validateStructuredData(params, structure);
      if (errors && errors.length > 0) {
        this.utils.handleError({
          message: `Parámetros inválidos para '${nameQuery}': ${errors.join(
            '. ',
          )}`,
          statusCode: this.STATUS_CODES.BAD_REQUEST,
        });
        return;
      }
    }

    try {
      const res = await this.query({ query: queryString, params });
      return res;
    } catch (error) {
      return this.utils.handleError({
        message: `Error ejecutando la consulta nombrada '${nameQuery}'`,
        statusCode: this.STATUS_CODES.DB_ERROR,
        error,
      });
    }
  }

  async executeJsonNamedQuery(jsonParams) {
    if (!jsonParams || Object.keys(jsonParams).length === 0) {
      this.utils.handleError({
        message:
          'No se proporcionaron parámetros necesarios para executeJsonNamedQuery',
        statusCode: this.STATUS_CODES.BAD_REQUEST,
      });
      return;
    }
    const iterable = Object.keys(jsonParams);
    let result = [];
    for (const key of iterable) {
      let value = jsonParams[key];
      const queryDef = this.queries && this.queries[key];
      const orderArray =
        queryDef && Array.isArray(queryDef.orderArray)
          ? queryDef.orderArray
          : [];

      if (value == null) {
        if (orderArray.length === 0) {
          value = {};
        } else {
          this.utils.handleError({
            message: `No se proporcionaron parámetros para la consulta '${key}'`,
            statusCode: this.STATUS_CODES.BAD_REQUEST,
          });
          continue;
        }
      }

      result.push(
        await this.executeNamedQuery({ nameQuery: key, params: value }),
      );
    }
    return result;
  }

  beginTransaction = async () => {
    try {
      const client = await this.connection();
      await client.query('BEGIN');
      return client;
    } catch (error) {
      this.utils.handleError({
        message: 'Error iniciando la transacción',
        statusCode: this.STATUS_CODES.DB_ERROR,
        error,
      });
    }
  };

  async executeJsonTransaction(
    jsonParams,
    errorMessage = 'Error ejecutando la transacción',
  ) {
    const client = await this.beginTransaction();
    try {
      const result = await this.executeJsonNamedQuery(jsonParams);
      await this.commitTransaction(client);
      return result;
    } catch (error) {
      await this.rollbackTransaction(client);
      this.utils.handleError({
        message: errorMessage,
        statusCode: this.STATUS_CODES.DB_ERROR,
        error,
      });
    } finally {
      this.endTransaction(client);
    }
  }

  commitTransaction = async (client) => {
    try {
      await client.query('COMMIT');
    } catch (error) {
      this.utils.handleError({
        message: 'Error confirmando la transacción',
        statusCode: this.STATUS_CODES.DB_ERROR,
        error,
      });
    }
  };

  rollbackTransaction = async (client) => {
    try {
      await client.query('ROLLBACK');
    } catch (error) {
      this.utils.handleError({
        message: 'Error revirtiendo la transacción',
        statusCode: this.STATUS_CODES.DB_ERROR,
        error,
      });
    }
  };

  endTransaction = async (client) => {
    this.disconnection(client);
  };

  get = async ({ tableName, dbSchema = 'public' }) => {
    const queryString = `SELECT * FROM ${dbSchema}.${tableName}`;
    const values = [];

    try {
      const result = await this.query({
        query: queryString,
        params: values,
      }).then((res) => res);
      if (result && result.rows && result.rows.length > 0)
        return { data: result.rows };
      else
        return {
          statusCode: this.STATUS_CODES.NOT_FOUND,
          message: 'No se encontraron registros',
        };
    } catch (error) {
      this.utils.handleError({
        message: `Error fetching ${tableName} on getAllFrom`,
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        error,
      });
      return {
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        message: 'Error del servidor',
      };
    }
  };

  getWhere = async ({ tableName, data, dbSchema = 'public' }) => {
    const keys = Object.keys(data.keyValueData || {});
    const values = Object.values(data.keyValueData || {});
    const queryString = `SELECT * FROM ${dbSchema}.${tableName} WHERE ${keys
      .map((f, i) => `${f} = $${i + 1}`)
      .join(' AND ')};`;

    if (values.length === 0 || keys.length === 0) {
      return {
        statusCode: this.STATUS_CODES.BAD_REQUEST,
        message: 'No se proporcionaron datos necesarios para la consulta',
      };
    }

    try {
      const result = await this.query({
        query: queryString,
        params: values,
      }).then((res) => res);
      if (result && result.rows && result.rows.length > 0)
        return { data: result.rows };
      else
        return {
          statusCode: this.STATUS_CODES.NOT_FOUND,
          message: 'No se encontraron registros',
        };
    } catch (error) {
      this.utils.handleError({
        message: `Error fetching ${tableName} on getWhere`,
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        error,
      });
      return {
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        message: 'Error del servidor',
        error,
      };
    }
  };

  insert = async ({ tableName, data, dbSchema = 'public' }) => {
    const keys = Object.keys(data.keyValueData || {});
    const values = Object.values(data.keyValueData || {});
    const queryString = `
      INSERT INTO ${dbSchema}.${tableName} (${keys.join(', ')})
      VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')});
    `;

    if (values.length === 0 || keys.length === 0) {
      return {
        statusCode: this.STATUS_CODES.BAD_REQUEST,
        message: 'No se proporcionaron datos necesarios para la consulta',
      };
    }

    try {
      const result = await this.query({
        query: queryString,
        params: values,
      }).then((res) => res);

      if (result && result.rowCount > 0) {
        return { message: 'Registro insertado correctamente' };
      } else {
        return {
          statusCode: this.STATUS_CODES.NOT_FOUND,
          message:
            'No se encontraron registros que coincidan con los criterios',
        };
      }
    } catch (error) {
      this.utils.handleError({
        message: `Error inserting into ${tableName}`,
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        error,
      });
      return {
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        message: 'Error del servidor',
        error,
      };
    }
  };

  updateById = async ({ tableName, data, dbSchema = 'public' }) => {
    const { userId } = data;
    const keys = Object.keys(data.keyValueData || {});
    const values = Object.values(data.keyValueData || {});
    const queryString = `
      UPDATE ${dbSchema}.${tableName}
      SET ${keys.map((key, i) => `${key} = $${i + 1}`).join(', ')}
      WHERE id = $${keys.length + 1};
    `;

    if (values.length === 0 || keys.length === 0 || !userId) {
      return {
        statusCode: this.STATUS_CODES.BAD_REQUEST,
        message: 'No se proporcionaron datos necesarios para la consulta',
      };
    }

    try {
      const result = await this.query({
        query: queryString,
        params: [...values, userId],
      }).then((res) => res);
      if (result && result.rowCount > 0) {
        return { message: 'Registro actualizado correctamente' };
      } else {
        return {
          statusCode: this.STATUS_CODES.NOT_FOUND,
          message:
            'No se encontraron registros que coincidan con los criterios',
        };
      }
    } catch (error) {
      this.utils.handleError({
        message: `Error updating ${tableName} by id`,
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        error,
      });
      return {
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        message: 'Error del servidor',
        error,
      };
    }
  };

  updateByUsername = async ({ tableName, data, dbSchema = 'public' }) => {
    const { username } = data;
    const keys = Object.keys(data.keyValueData || {});
    const values = Object.values(data.keyValueData || {});
    const queryString = `
      UPDATE ${dbSchema}.${tableName}
      SET ${keys.map((key, i) => `${key} = $${i + 1}`).join(', ')}
      WHERE username = $${keys.length + 1};
    `;

    if (values.length === 0 || keys.length === 0 || !username) {
      return {
        statusCode: this.STATUS_CODES.BAD_REQUEST,
        message: 'No se proporcionaron datos necesarios para la consulta',
      };
    }

    try {
      const result = await this.query({
        query: queryString,
        params: [...values, username],
      }).then((res) => res);
      if (result && result.rowCount > 0) {
        return { message: 'Registro actualizado correctamente' };
      } else {
        return {
          statusCode: this.STATUS_CODES.NOT_FOUND,
          message:
            'No se encontraron registros que coincidan con los criterios',
        };
      }
    } catch (error) {
      this.utils.handleError({
        message: `Error updating ${tableName} by username`,
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        error,
      });
      return {
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        message: 'Error del servidor',
        error,
      };
    }
  };

  deleteByUsername = async ({ tableName, data, dbSchema = 'public' }) => {
    const { username } = data;
    const queryString = `DELETE FROM ${dbSchema}.${tableName} WHERE username = $1;`;

    if (!username) {
      return {
        statusCode: this.STATUS_CODES.BAD_REQUEST,
        message: 'No se proporcionaron datos necesarios para la consulta',
      };
    }
    if (tableName.includes('_')) {
      const expected = `DELETE_${tableName.toUpperCase()}`;
      if (!data.confirmDelete || data.confirmDelete !== expected) {
        return {
          statusCode: this.STATUS_CODES.BAD_REQUEST,
          message: `Confirmación requerida '${expected}' para eliminar de tabla join ${tableName}`,
        };
      }
    }

    try {
      const result = await this.query({
        query: queryString,
        params: [username],
      }).then((res) => res);
      if (result && result.rowCount > 0) {
        return { message: 'Registro eliminado correctamente' };
      } else {
        return {
          statusCode: this.STATUS_CODES.NOT_FOUND,
          message:
            'No se encontraron registros que coincidan con los criterios',
        };
      }
    } catch (error) {
      this.utils.handleError({
        message: `Error deleting from ${tableName} by username`,
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        error,
      });
      return {
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        message: 'Error del servidor',
        error,
      };
    }
  };

  deleteById = async ({ tableName, data, dbSchema = 'public' }) => {
    const { userId } = data;
    const queryString = `DELETE FROM ${dbSchema}.${tableName} WHERE id = $1;`;

    if (!userId) {
      return {
        statusCode: this.STATUS_CODES.BAD_REQUEST,
        message: 'No se proporcionaron datos necesarios para la consulta',
      };
    }
    if (tableName.includes('_')) {
      const expected = `DELETE_${tableName.toUpperCase()}`;
      if (!data.confirmDelete || data.confirmDelete !== expected) {
        return {
          statusCode: this.STATUS_CODES.BAD_REQUEST,
          message: `Confirmación requerida '${expected}' para eliminar de tabla join ${tableName}`,
        };
      }
    }

    try {
      const result = await this.query({
        query: queryString,
        params: [userId],
      }).then((res) => res);
      if (result && result.rowCount > 0) {
        return { message: 'Registro eliminado correctamente' };
      } else {
        return {
          statusCode: this.STATUS_CODES.NOT_FOUND,
          message:
            'No se encontraron registros que coincidan con los criterios',
        };
      }
    } catch (error) {
      this.utils.handleError({
        message: `Error deleting from ${tableName} by id`,
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        error,
      });
      return {
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        message: 'Error del servidor',
        error,
      };
    }
  };

  deleteAll = async ({ tableName, data, dbSchema = 'public' }) => {
    if (
      !data.confirmDelete ||
      data.confirmDelete !== `DELETE_ALL_${tableName.toUpperCase()}`
    ) {
      return {
        statusCode: this.STATUS_CODES.BAD_REQUEST,
        message: `Confirmación no válida para eliminar toda la tabla ${tableName}`,
      };
    }

    const queryString = `DELETE FROM ${dbSchema}.${tableName};`;
    try {
      const result = await this.query({ query: queryString }).then(
        (res) => res,
      );
      if (result && result.rowCount > 0)
        return {
          message: `Todos los ${tableName} han sido eliminados correctamente`,
        };
      else
        return {
          statusCode: this.STATUS_CODES.NOT_FOUND,
          message:
            'No se encontraron registros que coincidan con los criterios',
        };
    } catch (error) {
      this.utils.handleError({
        message: `Error deleting all from ${tableName}`,
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        error,
      });
      return {
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        message: 'Error del servidor',
        error,
      };
    }
  };

  deleteWhere = async ({ tableName, data, dbSchema = 'public' }) => {
    const keys = Object.keys(data.keyValueData || {});
    const values = Object.values(data.keyValueData || {});
    const queryString = `DELETE FROM ${dbSchema}.${tableName} WHERE ${keys
      .map((f, i) => `${f} = $${i + 1}`)
      .join(' AND ')};`;

    if (values.length === 0 || keys.length === 0) {
      return {
        statusCode: this.STATUS_CODES.BAD_REQUEST,
        message: 'No se proporcionaron datos necesarios para la consulta',
      };
    }
    if (tableName.includes('_')) {
      const expected = `DELETE_${tableName.toUpperCase()}`;
      if (!data.confirmDelete || data.confirmDelete !== expected) {
        return {
          statusCode: this.STATUS_CODES.BAD_REQUEST,
          message: `Confirmación requerida '${expected}' para eliminar de tabla join ${tableName}`,
        };
      }
    }

    try {
      const result = await this.query({
        query: queryString,
        params: values,
      }).then((res) => res);
      if (result && result.rowCount > 0)
        return {
          message: 'Registros eliminados correctamente',
        };
      else
        return {
          statusCode: this.STATUS_CODES.NOT_FOUND,
          message:
            'No se encontraron registros que coincidan con los criterios',
        };
    } catch (error) {
      this.utils.handleError({
        message: `Error deleting from ${tableName} with where clause`,
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        error,
      });
      return {
        statusCode: this.STATUS_CODES.INTERNAL_SERVER_ERROR,
        message: 'Error del servidor',
        error,
      };
    }
  };
}
