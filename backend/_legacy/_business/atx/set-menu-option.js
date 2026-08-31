import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';
import getMethod from './get-method.js';

export default async function setMenuOption(data) {
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

  const { option, menu } = data;
  if (!option || !menu)
    return utils.handleError({
      message: 'Datos inválidos o incompletos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  return await _withTransaction(async (client) => {
    const optionId = await _ensureEntityByUniqueField(client, 'option', {
      name: option,
    });
    const menuId = await _ensureEntityByUniqueField(client, 'menu', {
      name: menu,
    });
    await _ensureJoin(client, 'option_menu', {
      id_option: optionId,
      id_menu: menuId,
    });
    return { data: [{ id_option: optionId, id_menu: menuId }] };
  }, 'Error en setMenuOption');
}
