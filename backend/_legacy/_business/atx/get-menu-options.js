import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';
import DBMS from '../../dbms/dbms.js';

export default async function getMenuOptions(data) {
  const utils = new Utils();
  const dbms = new DBMS();
  const config = new Config();
  const ERROR_CODES = config.ERROR_CODES;

  const { menu } = data;
  if (!menu)
    return utils.handleError({
      message: 'Datos inválidos o incompletos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  try {
    const res = await dbms.executeNamedQuery({
      nameQuery: 'getMenuOptions',
      params: [menu],
    });
    return res?.rows || [];
  } catch (error) {
    return utils.handleError({
      message: `Error en getMenuOptions`,
      statusCode: ERROR_CODES.DB_ERROR,
      error,
    });
  }
}
