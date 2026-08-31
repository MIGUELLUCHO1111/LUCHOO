import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';

export default async function getProfileOptions(data) {
  const utils = new Utils();
  const config = new Config();
  const ERROR_CODES = config.ERROR_CODES;

  const { profile } = data;
  if (!profile)
    return utils.handleError({
      message: 'Datos inválidos o incompletos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });

  try {
    const res = await dbms.executeNamedQuery({
      nameQuery: 'getProfileOptions',
      params: [profile],
    });
    return res?.rows || [];
  } catch (error) {
    return utils.handleError({
      message: `Error en getProfileOptions`,
      statusCode: ERROR_CODES.DB_ERROR,
      error,
    });
  }
}
