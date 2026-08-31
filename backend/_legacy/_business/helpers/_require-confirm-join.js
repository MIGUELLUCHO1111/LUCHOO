// Confirmación para operaciones de borrado en tablas join
export default async function _requireConfirmJoin(token, table) {
  const base = table.toUpperCase();
  const expected = `DELETE_${base}`;
  const expectedAll = `DELETE_ALL_${base}`;
  if (token === expected || token === expectedAll) return true;

  const Utils = (await import('../../utils/utils.js')).default;
  const Config = (await import('../../../config/config.js')).default;
  const utils = new Utils();
  const config = new Config();
  const ERROR_CODES = config.ERROR_CODES;

  return utils.handleError({
    message: `Confirmación inválida para ${table}`,
    statusCode: ERROR_CODES.BAD_REQUEST,
  });
}
