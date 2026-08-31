import getMethod from './get-method.js';

export default async function replaceMenuOptionProfile(data) {
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

  const { menu, option, profile } = data;
  if (!menu || !option || !profile) {
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
    await client.query('DELETE FROM public."option_menu";');
    await client.query('DELETE FROM public."option_profile";');
    await client.query('DELETE FROM public."menu";');
    await client.query('DELETE FROM public."option";');

    const menuId = await _ensureEntityByUniqueField(client, 'menu', {
      name: menu,
    });
    const optionId = await _ensureEntityByUniqueField(client, 'option', {
      name: option,
    });
    await _ensureJoin(client, 'option_menu', {
      id_menu: menuId,
      id_option: optionId,
    });
    const profileId = await _ensureEntityByUniqueField(client, 'profile', {
      name: profile,
    });
    await _ensureJoin(client, 'option_profile', {
      id_option: optionId,
      id_profile: profileId,
    });
    return { message: 'Menú/opción/perfil reemplazado correctamente' };
  }, 'Error en replaceMenuOptionProfile');
}
