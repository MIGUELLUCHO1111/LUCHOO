import DBMS from 'src/dbms/dbms';

export default async function getProfilesOptions() {
  const dbms = new DBMS();

  try {
    const res = await dbms.executeNamedQuery({
      nameQuery: 'getProfilesOptions',
    });
    return res?.rows || [];
  } catch (error) {
    const Utils = (await import('../../utils/utils.js')).default;
    const Config = (await import('../../../config/config.js')).default;
    const utils = new Utils();
    const config = new Config();
    const ERROR_CODES = config.ERROR_CODES;

    return utils.handleError({
      message: `Error en getProfilesOptions`,
      statusCode: ERROR_CODES.DB_ERROR,
      error,
    });
  }
}
