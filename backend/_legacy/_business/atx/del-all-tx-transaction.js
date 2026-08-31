import getMethod from './get-method.js';

export default async function delAllTxTransaction(data) {
  const _withTransaction = await getMethod({
    className: 'helpers',
    method: '_withTransaction',
  });
  const _requireConfirmJoin = await getMethod({
    className: 'helpers',
    method: '_requireConfirmJoin',
  });

  if (!data || typeof data !== 'object') {
    const Utils = (await import('../../utils/utils.js')).default;
    const Config = (await import('../../../config/config.js')).default;
    const utils = new Utils();
    const config = new Config();
    const ERROR_CODES = config.ERROR_CODES;

    return utils.handleError({
      message: 'Datos inválidos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  }
  const conf = await _requireConfirmJoin(
    data.confirmDelete,
    'transaction',
    true,
  );
  if (conf !== true) return conf;
  return await _withTransaction(async (client) => {
    await client.query('DELETE FROM public."transaction";');
    return { message: 'Todas las transacciones eliminadas correctamente' };
  }, 'Error en delAllTxTransaction');
}
