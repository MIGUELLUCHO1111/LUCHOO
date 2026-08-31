import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';
import DBMS from '../../dbms/dbms.js';
import getMethod from './get-method.js';

export default async function delClassMethod(data) {
  const utils = new Utils();
  const config = new Config();
  const dbms = new DBMS();
  const ERROR_CODES = config.ERROR_CODES;
  const _requireConfirmJoin = await getMethod({
    className: 'atx',
    method: '_requireConfirmJoin',
  });

  const { className, method } = data;
  if (!className || !method)
    return utils.handleError({
      message: 'Datos inválidos o incompletos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  const conf = await _requireConfirmJoin(data.confirmDelete, 'class_method');
  if (conf !== true) return conf;

  try {
    await dbms.executeNamedQuery({
      nameQuery: 'delClassMethod',
      params: [className, method],
    });
  } catch (error) {
    return utils.handleError({
      message: `Error en delClassMethod`,
      statusCode: ERROR_CODES.DB_ERROR,
      error,
    });
  }
}
