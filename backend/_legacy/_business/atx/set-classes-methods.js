import getMethod from "./get-method.js";

export default async function setClassesMethods(data) {
  const setClassMethod = await getMethod({
    className: 'atx',
    method: 'setClassMethod',
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
        await setClassMethod({ className, method });
      }
    },
  });
}
