import getMethod from './get-method.js';

export default async function delMenuOptionsProfile(data) {
  const delMenuOption = await getMethod({
    className: 'atx',
    method: 'delMenuOption',
  });
  const delProfileOption = await getMethod({
    className: 'atx',
    method: 'delProfileOption',
  });

  const { profile, menu, arrOptions } = data;
  if (!profile || !menu || !arrOptions) {
    const Utils = (await import('../../utils/utils.js')).default;
    const Config = (await import('../../../config/config.js')).default;
    const utils = new Utils();
    const config = new Config();
    const ERROR_CODES = config.ERROR_CODES;

    return utils.handleError({
      message: 'Datos inválidos o faltantes',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  }
  for (const option of arrOptions) {
    // Eliminar vínculo option_menu
    await delMenuOption({
      option,
      menu,
      confirmDelete: 'DELETE_OPTION_MENU',
    });
    // Eliminar vínculo option_profile
    await delProfileOption({
      option,
      profile,
      confirmDelete: 'DELETE_OPTION_PROFILE',
    });
  }
}
