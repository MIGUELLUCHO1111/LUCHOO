import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';
import DBMS from '../../dbms/dbms.js';

export default async function getMenusOptionsProfile(data) {
  const utils = new Utils();
  const config = new Config();
  const dbms = new DBMS();
  const ERROR_CODES = config.ERROR_CODES;

  const { profile } = data;
  if (!profile)
    return utils.handleError({
      message: 'Datos inválidos o incompletos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  const selectQuery = `
      SELECT m.id AS menu_id, m.name AS menu_name, o.id AS option_id, o.name AS option_name, p.id AS profile_id, p.name AS profile_name
      FROM public."menu" m
      JOIN public."option_menu" om ON m.id = om.id_menu
      JOIN public."option" o ON om.id_option = o.id
      JOIN public."option_profile" op ON o.id = op.id_option
      JOIN public."profile" p ON op.id_profile = p.id
      WHERE p.name = $1;
    `;
  try {
    const res = await dbms.executeNamedQuery({
      nameQuery: 'getMenusOptionsProfile',
      params: [profile],
    });
    return res?.rows || [];
  } catch (error) {
    return utils.handleError({
      message: `Error en getMenusOptionsProfile`,
      statusCode: ERROR_CODES.DB_ERROR,
      error,
    });
  }
}
