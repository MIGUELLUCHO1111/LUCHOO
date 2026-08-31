import DBMS from '../../dbms/dbms.js';
import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';

export default async function getUserProfiles(data) {
  const dbms = new DBMS();
  const utils = new Utils();
  const config = new Config();
  const ERROR_CODES = config.ERROR_CODES;

  const { username } = data || {};
  if (!username)
    return utils.handleError({
      message: 'Datos inválidos o incompletos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });

  try {
    const res = await dbms.executeNamedQuery({
      nameQuery: 'getUserProfiles',
      params: [username],
    });
    return res?.rows || [];
  } catch (error) {
    return utils.handleError({
      message: 'Error en getUserProfiles',
      statusCode: ERROR_CODES.DB_ERROR,
      error,
    });
  }
}
