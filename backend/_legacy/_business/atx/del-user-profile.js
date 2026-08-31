import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';
import DBMS from '../../dbms/dbms.js';
import getMethod from './get-method.js';

export default async function delUserProfile(data) {
  const utils = new Utils();
  const config = new Config();
  const dbms = new DBMS();
  const ERROR_CODES = config.ERROR_CODES;
  const _requireConfirmJoin = await getMethod({
    className: 'helpers',
    method: '_requireConfirmJoin',
  });

  const { username, profile } = data;
  if (!username || !profile)
    return utils.handleError({
      message: 'Datos inválidos o incompletos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  const conf = await _requireConfirmJoin(data.confirmDelete, 'user_profile');
  if (conf !== true) return conf;

  try {
    await dbms.executeNamedQuery({
      nameQuery: 'delUserProfile',
      params: [username, profile],
    });
  } catch (error) {
    return utils.handleError({
      message: `Error en delUserProfile`,
      statusCode: ERROR_CODES.DB_ERROR,
      error,
    });
  }
}
