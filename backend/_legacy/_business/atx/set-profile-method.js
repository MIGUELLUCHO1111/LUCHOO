import getMethod from './get-method.js';

export default async function setProfileMethod(data) {
  const _withTransaction = await getMethod({
    className: 'helpers',
    method: '_withTransaction',
  });
  const _ensureEntityByUniqueField = await getMethod({
    className: 'helpers',
    method: '_ensureEntityByUniqueField',
  });
  const _ensureJoin = await getMethod({
    className: 'helpers',
    method: '_ensureJoin',
  });

  const { method, profile } = data;
  if (!method || !profile) {
    const Utils = (await import('../../utils/utils.js')).default;
    const Config = (await import('../../../config/config.js')).default;
    const utils = new Utils();
    const config = new Config();
    const ERROR_CODES = config.ERROR_CODES;

    return utils.handleError({
      message: 'Datos inválidos o incompletos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  }
  return await _withTransaction(async (client) => {
    const methodId = await _ensureEntityByUniqueField(client, 'method', {
      name: method,
    });
    const profileId = await _ensureEntityByUniqueField(client, 'profile', {
      name: profile,
    });
    await _ensureJoin(client, 'method_profile', {
      id_method: methodId,
      id_profile: profileId,
    });
    return { data: [{ id_method: methodId, id_profile: profileId }] };
  }, 'Error en setProfileMethod');
}
