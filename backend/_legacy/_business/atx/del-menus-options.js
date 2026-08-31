import getMethod from "./get-method.js";

export default async function delMenusOptions(data) {
  const _forEachJsonMethod = await getMethod({
    className: 'helpers',
    method: '_forEachJsonMethod',
  });
  const delMenuOption = await getMethod({
    className: 'atx',
    method: 'delMenuOption',
  });

  return await _forEachJsonMethod({
    data,
    filter: (menu, arr) => Array.isArray(arr) && arr.length > 0,
    onEach: async ({ key: menu, value: arrOptions }) => {
      for (const option of arrOptions) {
        await delMenuOption({
          option,
          menu,
          confirmDelete: 'DELETE_OPTION_MENU',
        });
      }
    },
  });
}
