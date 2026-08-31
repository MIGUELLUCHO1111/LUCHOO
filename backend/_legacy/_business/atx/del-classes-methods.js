import getMethod from "./get-method.js";

export default async function delClassesMethods(data) {
  const delClassMethod = await getMethod({
    className: 'atx',
    method: 'delClassMethod',
  });
  const _forEachJsonMethod = await getMethod({
    className: 'helpers',
    method: '_forEachJsonMethod',
  });

  return await _forEachJsonMethod({
    data,
    filter: (className, arr) => Array.isArray(arr) && arr.length > 0,
    onEach: async ({ key: className, value: arrMethods }) => {
      for (const method of arrMethods) {
        await delClassMethod({
          className,
          method,
          confirmDelete: 'DELETE_CLASS_METHOD',
        });
      }
    },
  });
}
