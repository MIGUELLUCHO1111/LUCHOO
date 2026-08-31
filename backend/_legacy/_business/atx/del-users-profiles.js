import getMethod from './get-method.js';

export default async function delUsersProfiles(data) {
  try {
    const delUserProfile = await getMethod({
      className: 'atx',
      method: 'delUserProfile',
    });
    const _forEachJsonMethod = await getMethod({
      className: 'helpers',
      method: '_forEachJsonMethod',
    });

    return await _forEachJsonMethod({
      data,
      filter: (username, arr) => Array.isArray(arr) && arr.length > 0,
      onEach: async ({ key: username, value: arrProfiles }) => {
        const results = [];
        for (const profile of arrProfiles) {
          const out = await delUserProfile({
            username,
            profile,
            confirmDelete: 'DELETE_USER_PROFILE',
          });
          results.push({ ...out, username, profile });
        }
        return results;
      },
    });
  } catch (error) {
    const Utils = (await import('../../utils/utils.js')).default;
    const Config = (await import('../../../config/config.js')).default;
    const utils = new Utils();
    const config = new Config();
    const ERROR_CODES = config.ERROR_CODES;

    return utils.handleError({
      message: 'Error en delUsersProfiles',
      statusCode: ERROR_CODES.DB_ERROR,
      error,
    });
  }
}
