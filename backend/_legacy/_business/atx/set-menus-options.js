import getMethod from "./get-method.js";

export default async function setMenusOptions(data) {
  const _ensureEntityByUniqueField = await getMethod({
    className: 'helpers',
    method: '_ensureEntityByUniqueField',
  });
  const _ensureJoin = await getMethod({
    className: 'helpers',
    method: '_ensureJoin',
  });

  const results = await _forEachJsonMethodTx({
    data,
    filter: (menu, arr) => Array.isArray(arr) && arr.length > 0,
    onEach: async ({ key: menu, value: arrOptions }, client) => {
      const menuId = await _ensureEntityByUniqueField(client, 'menu', {
        name: menu,
      });
      const local = [];
      for (const option of arrOptions) {
        const optionId = await _ensureEntityByUniqueField(client, 'option', {
          name: option,
        });
        await _ensureJoin(client, 'option_menu', {
          id_option: optionId,
          id_menu: menuId,
        });
        local.push({ id_option: optionId, id_menu: menuId });
      }
      return local;
    },
    errorMessage: 'Error en setMenusOptions',
  });
  // Avoid using Array.flat for compatibility with older Node versions
  const flat =
    results && Array.isArray(results)
      ? results.reduce((acc, cur) => acc.concat(cur || []), [])
      : [];
  return { data: flat };
}
