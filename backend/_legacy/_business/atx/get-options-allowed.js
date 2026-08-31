import DBMS from '../../dbms/dbms.js';
import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';

// Devuelve un arreglo con los nombres de las opciones permitidas para un perfil dado
export default async function getOptionsAllowed(data) {
  const dbms = new DBMS();
  const utils = new Utils();
  const config = new Config();
  const ERROR_CODES = config.ERROR_CODES;

  const { profile } = data || {};
  if (!profile) {
    return utils.handleError({
      message: 'Datos inválidos o incompletos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  }
  try {
    // Reutiliza la consulta nombrada ya existente para perfil→opciones
    const res = await dbms.executeNamedQuery({
      nameQuery: 'getProfileOptions',
      params: [profile],
    });
    const rows = res?.rows || [];
    // Normaliza salida a lista de nombres de opciones
    return rows.map((r) => r.option_name);
  } catch (error) {
    return utils.handleError({
      message: `Error en getOptionsAllowed`,
      statusCode: ERROR_CODES.DB_ERROR,
      error,
    });
  }
}
