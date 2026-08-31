import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';
import getMethod from './get-method.js';

export default async function setUserProfile(data) {
  const utils = new Utils();
  const config = new Config();
  utils = utils;
  ERROR_CODES = config.ERROR_CODES;
  _withTransaction = await getMethod({
    className: 'helpers',
    method: '_withTransaction',
  });
  _ensureEntityByUniqueField = await getMethod({
    className: 'helpers',
    method: '_ensureEntityByUniqueField',
  });
  _ensureJoin = await getMethod({
    className: 'helpers',
    method: '_ensureJoin',
  });
  // Acepta dos formas: {username, profile} o {userData:{username}, profileData:{name}}
  const username = data?.username || data?.userData?.username;
  const profile = data?.profile || data?.profileData?.name;
  if (!username || !profile)
    return utils.handleError({
      message: 'Datos inválidos o incompletos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  return await _withTransaction(async (client) => {
    const userId = await _ensureEntityByUniqueField(client, 'user', {
      username,
    });
    const profileId = await _ensureEntityByUniqueField(client, 'profile', {
      name: profile,
    });
    await _ensureJoin(client, 'user_profile', {
      id_user: userId,
      id_profile: profileId,
    });
    return { data: [{ id_user: userId, id_profile: profileId }] };
  }, 'Error en setUserProfile');
}
