import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';
import DBMS from '../../dbms/dbms.js';

export default async function getClassMethods(data) {
  const utils = new Utils();
  const config = new Config();
  const dbms = new DBMS();
  const ERROR_CODES = config.ERROR_CODES;

  const { className } = data;
  if (!className)
    return utils.handleError({
      message: 'Datos inválidos o incompletos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });

  try {
    const res = await dbms.executeNamedQuery({
      nameQuery: 'getClassMethods',
      params: [className],
    });
    return res?.rows || [];
  } catch (error) {
    return utils.handleError({
      message: `Error en getClassMethods`,
      statusCode: ERROR_CODES.DB_ERROR,
      error,
    });
  }
}
