import getMethod from "./get-method.js";

export default async function delProfilesMethods(data) {
  const _forEachJsonMethod = await getMethod({
    className: 'helpers',
    method: '_forEachJsonMethod',
  });
  const delProfileMethod = await getMethod({
    className: 'atx',
    method: 'delProfileMethod',
  });

  return await _forEachJsonMethod({
    data,
    filter: (profile, arr) => Array.isArray(arr) && arr.length > 0,
    onEach: async ({ key: profile, value: arrMethods }) => {
      for (const method of arrMethods) {
        await delProfileMethod({
          method,
          profile,
          confirmDelete: 'DELETE_METHOD_PROFILE',
        });
      }
    },
  });
}
