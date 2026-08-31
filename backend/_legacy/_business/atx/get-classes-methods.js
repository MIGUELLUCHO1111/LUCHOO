import DBMS from '../../dbms/dbms.js';

export default async function getClassesMethods() {
  try {
    const dbms = new DBMS();
    const res = await dbms.executeNamedQuery({
      nameQuery: 'getClassesMethods',
    });
    return res?.rows || [];
  } catch (error) {
    const Utils = (await import('../../utils/utils.js')).default;
    const Config = (await import('../../../config/config.js')).default;
    const utils = new Utils();
    const config = new Config();
    const ERROR_CODES = config.ERROR_CODES;

    return utils.handleError({
      message: `Error en getClassesMethods`,
      statusCode: ERROR_CODES.DB_ERROR,
      error,
    });
  }
}
