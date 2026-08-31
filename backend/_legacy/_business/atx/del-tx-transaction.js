import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';
import DBMS from '../../dbms/dbms.js';
import getMethod from './get-method.js';

export default async function delTxTransaction(data) {
  const utils = new Utils();
  const config = new Config();
  const dbms = new DBMS();
  const ERROR_CODES = config.ERROR_CODES;
  const _requireConfirmJoin = await getMethod({
    className: 'helpers',
    method: '_requireConfirmJoin',
  });

  if (!data || typeof data !== 'object')
    return utils.handleError({
      message: 'Datos inválidos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  const conf = await _requireConfirmJoin(data.confirmDelete, 'transaction');
  if (conf !== true) return conf;
  const { tx, subsystem, className, method } = data;
  let queryString = '';
  let params = [];
  if (tx) {
    queryString = 'DELETE FROM public."transaction" WHERE tx = $1::integer;';
    params = [tx];
  } else if (subsystem && className && method) {
    queryString = `DELETE FROM public."transaction" WHERE id_subsystem = (SELECT id FROM public."subsystem" WHERE name = $1)
        AND id_class = (SELECT id FROM public."class" WHERE name = $2)
        AND id_method = (SELECT id FROM public."method" WHERE name = $3);`;
    params = [subsystem, className, method];
  } else {
    return utils.handleError({
      message: 'Debe proporcionar tx o subsystem/className/method',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  }
  try {
    const nameQuery = tx ? 'delTxTransactionById' : 'delTxTransactionByNames';
    const res = await dbms.executeNamedQuery({ nameQuery, params });
    if (res.rowCount === 0)
      return utils.handleError({
        message: 'Transacción no encontrada para eliminar',
        statusCode: ERROR_CODES.NOT_FOUND,
      });
    return { message: 'Transacción eliminada correctamente' };
  } catch (error) {
    return utils.handleError({
      message: 'Error en delTxTransaction',
      statusCode: ERROR_CODES.DB_ERROR,
      error,
    });
  }
}
