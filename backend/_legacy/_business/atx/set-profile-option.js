import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';

export default async function setProfileOption(data) {
  const utils = new Utils();
  const config = new Config();
  const ERROR_CODES = config.ERROR_CODES;

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

  const { option, profile } = data;
  if (!option || !profile)
    return utils.handleError({
      message: 'Datos inválidos o incompletos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  return await _withTransaction(async (client) => {
    const optionId = await _ensureEntityByUniqueField(client, 'option', {
      name: option,
    });
    const profileId = await _ensureEntityByUniqueField(client, 'profile', {
      name: profile,
    });
    await _ensureJoin(client, 'option_profile', {
      id_option: optionId,
      id_profile: profileId,
    });
    return { data: [{ id_option: optionId, id_profile: profileId }] };
  }, 'Error en setProfileOption');
}
