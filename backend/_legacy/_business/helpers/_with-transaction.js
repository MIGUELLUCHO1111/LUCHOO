import DBMS from '../../dbms/dbms.js';
import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';

export default async function _withTransaction(
  callback,
  errorMessage = 'Error en transacción genérica',
) {
  const dbms = new DBMS();
  const utils = new Utils();
  const config = new Config();
  const ERROR_CODES = config.ERROR_CODES;
  // Wrapper to run a callback inside a DB transaction using DBMS.beginTransaction/commit/rollback
  const client = await dbms.beginTransaction();
  if (!client) {
    return utils.handleError({
      message: 'No se pudo iniciar la transacción',
      statusCode: ERROR_CODES.DB_ERROR,
    });
  }
  try {
    const result = await callback(client);
    await dbms.commitTransaction(client);
    return result;
  } catch (error) {
    try {
      await dbms.rollbackTransaction(client);
    } catch (e) {
      // ignore rollback errors but keep original error handling
    }
    return utils.handleError({
      message: errorMessage,
      statusCode: ERROR_CODES.DB_ERROR,
      error,
    });
  } finally {
    try {
      await dbms.endTransaction(client);
    } catch (e) {}
  }
}
